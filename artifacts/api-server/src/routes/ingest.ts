import { Router } from "express";
import { db } from "@workspace/db";
import {
  modelVersionsTable,
  driftMetricsTable,
  latencyMetricsTable,
  featureDriftScoresTable,
  featureStatsTable,
  alertsTable,
  predictionBaselinesTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { IngestMetricsBody, SetBaselineBody } from "@workspace/api-zod";
import { requireApiKey } from "../middleware/api-key-auth";

const router = Router();

// PSI = Σ(p_cur - p_base)·ln(p_cur/p_base); <0.10 stable, <0.25 warning, ≥0.25 critical
function computePSI(currentCounts: number[], baselineCounts: number[]): number {
  const eps = 1e-6;
  const totalCurrent = currentCounts.reduce((a, b) => a + b, 0) || 1;
  const totalBaseline = baselineCounts.reduce((a, b) => a + b, 0) || 1;

  let psi = 0;
  for (let i = 0; i < currentCounts.length; i++) {
    const pCurrent = (currentCounts[i] + eps) / (totalCurrent + eps * currentCounts.length);
    const pBaseline = (baselineCounts[i] + eps) / (totalBaseline + eps * baselineCounts.length);
    psi += (pCurrent - pBaseline) * Math.log(pCurrent / pBaseline);
  }
  return Math.round(psi * 10000) / 10000;
}

// KS = max|CDF_cur(x) - CDF_base(x)| — max divergence between cumulative distributions
function computeKS(currentCounts: number[], baselineCounts: number[]): number {
  const totalCurrent = currentCounts.reduce((a, b) => a + b, 0) || 1;
  const totalBaseline = baselineCounts.reduce((a, b) => a + b, 0) || 1;

  let cdfCurrent = 0;
  let cdfBaseline = 0;
  let maxDiff = 0;

  for (let i = 0; i < currentCounts.length; i++) {
    cdfCurrent += currentCounts[i] / totalCurrent;
    cdfBaseline += baselineCounts[i] / totalBaseline;
    maxDiff = Math.max(maxDiff, Math.abs(cdfCurrent - cdfBaseline));
  }
  return Math.round(maxDiff * 10000) / 10000;
}

function psiSeverity(psi: number): "stable" | "warning" | "critical" {
  if (psi >= 0.25) return "critical";
  if (psi >= 0.10) return "warning";
  return "stable";
}

// ─── POST /ingest/metrics ─────────────────────────────────────────────────────

router.post("/ingest/metrics", requireApiKey, async (req, res) => {
  const parsed = IngestMetricsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    return;
  }
  const { modelId, latency, predictionBins, features } = parsed.data;

  // Verify model exists
  const [model] = await db
    .select()
    .from(modelVersionsTable)
    .where(eq(modelVersionsTable.id, modelId));
  if (!model) {
    res.status(404).json({ error: `Model ${modelId} not found` });
    return;
  }

  const alertsCreated: number[] = [];
  let latencyMetricId: number | null = null;

  // ── 1. Store latency ──────────────────────────────────────────────────────
  if (latency) {
    const [lm] = await db.insert(latencyMetricsTable).values({
      modelId,
      p50Ms: latency.p50Ms,
      p95Ms: latency.p95Ms,
      p99Ms: latency.p99Ms,
      requestCount: latency.requestCount,
      errorRate: latency.errorRate ?? 0,
    }).returning({ id: latencyMetricsTable.id });
    latencyMetricId = lm.id;

    // Auto-alert on p99 SLA breach (>500ms = critical, >350ms = warning)
    if (latency.p99Ms > 500) {
      const [existing] = await db
        .select({ id: alertsTable.id })
        .from(alertsTable)
        .where(and(
          eq(alertsTable.modelId, modelId),
          eq(alertsTable.type, "latency"),
          eq(alertsTable.status, "active"),
        ))
        .limit(1);

      if (!existing) {
        const severity = latency.p99Ms > 700 ? "critical" : "warning";
        const [alert] = await db.insert(alertsTable).values({
          modelId,
          severity,
          type: "latency",
          message: `p99 latency ${latency.p99Ms.toFixed(0)}ms exceeds 500ms SLA threshold. ` +
            `p50=${latency.p50Ms.toFixed(0)}ms p95=${latency.p95Ms.toFixed(0)}ms. ` +
            `${latency.requestCount} requests in window.`,
          runbookUrl: "https://runbooks.internal/latency-sla",
        }).returning({ id: alertsTable.id });
        alertsCreated.push(alert.id);
      }
    }
  }

  // ── 2. Compute prediction drift (PSI + KS vs stored baseline) ────────────
  let globalPsi = 0;
  let globalKs = 0;
  let driftSeverity: "stable" | "warning" | "critical" = "stable";
  let driftMetricId = 0;

  if (predictionBins && predictionBins.length > 0) {
    // Load baseline for this model, ordered by bin
    const baselines = await db
      .select()
      .from(predictionBaselinesTable)
      .where(eq(predictionBaselinesTable.modelId, modelId))
      .orderBy(predictionBaselinesTable.bin);

    if (baselines.length > 0) {
      // Build aligned arrays: match incoming bins to baseline bins by key
      const baselineMap = new Map(baselines.map((b) => [b.bin, b.count]));
      const alignedCurrent: number[] = [];
      const alignedBaseline: number[] = [];

      for (const b of predictionBins) {
        alignedCurrent.push(b.count);
        alignedBaseline.push(baselineMap.get(b.bin) ?? 0);
      }

      globalPsi = computePSI(alignedCurrent, alignedBaseline);
      globalKs = computeKS(alignedCurrent, alignedBaseline);
      driftSeverity = psiSeverity(globalPsi);

      // Auto-alert on drift crossing thresholds
      if (driftSeverity !== "stable") {
        const [existing] = await db
          .select({ id: alertsTable.id })
          .from(alertsTable)
          .where(and(
            eq(alertsTable.modelId, modelId),
            eq(alertsTable.type, "prediction_skew"),
            eq(alertsTable.status, "active"),
          ))
          .limit(1);

        if (!existing) {
          const [alert] = await db.insert(alertsTable).values({
            modelId,
            severity: driftSeverity,
            type: "prediction_skew",
            message: `Prediction distribution drift detected. PSI=${globalPsi.toFixed(3)} ` +
              `(threshold: 0.25=critical). KS=${globalKs.toFixed(3)}. ` +
              `Check feature distributions for upstream data changes.`,
            runbookUrl: "https://runbooks.internal/prediction-skew",
          }).returning({ id: alertsTable.id });
          alertsCreated.push(alert.id);
        }
      }
    }
  }

  // ── 3. Per-feature drift (null rate shift → PSI proxy + null-rate alert) ──
  const featureDrifts: Array<{
    name: string;
    psiScore: number;
    ksStatistic: number;
    severity: "stable" | "warning" | "critical";
  }> = [];

  if (features && features.length > 0) {
    for (const feat of features) {
      // Load stored baseline for this feature
      const [existing] = await db
        .select()
        .from(featureStatsTable)
        .where(and(
          eq(featureStatsTable.modelId, modelId),
          eq(featureStatsTable.featureName, feat.name),
        ))
        .limit(1);

      const baselineNullRate = existing?.baselineNullRate ?? feat.nullRate;

      // Null-rate drift as a 2-bin PSI: null vs non-null proportion
      const currentCounts = [feat.nullRate * 1000, (1 - feat.nullRate) * 1000];
      const baselineCounts = [baselineNullRate * 1000, (1 - baselineNullRate) * 1000];
      const featurePsi = computePSI(currentCounts, baselineCounts);
      const featureKs = computeKS(currentCounts, baselineCounts);
      const featureSeverity = psiSeverity(featurePsi);

      featureDrifts.push({
        name: feat.name,
        psiScore: featurePsi,
        ksStatistic: featureKs,
        severity: featureSeverity,
      });

      // Upsert feature_drift_scores
      const driftExists = await db
        .select({ id: featureDriftScoresTable.id })
        .from(featureDriftScoresTable)
        .where(and(
          eq(featureDriftScoresTable.modelId, modelId),
          eq(featureDriftScoresTable.featureName, feat.name),
        ))
        .limit(1);

      if (driftExists.length > 0) {
        await db.update(featureDriftScoresTable)
          .set({
            psiScore: featurePsi,
            ksStatistic: featureKs,
            severity: featureSeverity,
            nullRate: feat.nullRate,
            lastUpdated: new Date(),
          })
          .where(and(
            eq(featureDriftScoresTable.modelId, modelId),
            eq(featureDriftScoresTable.featureName, feat.name),
          ));
      } else {
        await db.insert(featureDriftScoresTable).values({
          modelId,
          featureName: feat.name,
          featureType: feat.type as "continuous" | "categorical",
          psiScore: featurePsi,
          ksStatistic: featureKs,
          severity: featureSeverity,
          nullRate: feat.nullRate,
          baselineNullRate,
        });
      }

      // Upsert feature_stats
      const statsExists = await db
        .select({ id: featureStatsTable.id })
        .from(featureStatsTable)
        .where(and(
          eq(featureStatsTable.modelId, modelId),
          eq(featureStatsTable.featureName, feat.name),
        ))
        .limit(1);

      if (statsExists.length > 0) {
        await db.update(featureStatsTable)
          .set({
            nullRate: feat.nullRate,
            schemaMismatch: feat.schemaMismatch ?? false,
            lastUpdated: new Date(),
          })
          .where(and(
            eq(featureStatsTable.modelId, modelId),
            eq(featureStatsTable.featureName, feat.name),
          ));
      } else {
        await db.insert(featureStatsTable).values({
          modelId,
          featureName: feat.name,
          featureType: feat.type as "continuous" | "categorical",
          nullRate: feat.nullRate,
          baselineNullRate,
          schemaMismatch: feat.schemaMismatch ?? false,
        });
      }

      // Auto-alert on null rate spike (>5× baseline = critical, >2× = warning)
      const ratio = baselineNullRate > 0 ? feat.nullRate / baselineNullRate : 0;
      if (ratio > 2 || feat.schemaMismatch) {
        const severity = ratio > 5 || feat.schemaMismatch ? "critical" : "warning";
        const [existing2] = await db
          .select({ id: alertsTable.id })
          .from(alertsTable)
          .where(and(
            eq(alertsTable.modelId, modelId),
            eq(alertsTable.type, "null_rate"),
            eq(alertsTable.status, "active"),
          ))
          .limit(1);

        if (!existing2) {
          const msg = feat.schemaMismatch
            ? `Schema mismatch on feature "${feat.name}". Possible upstream type change.`
            : `Feature "${feat.name}" null rate ${(feat.nullRate * 100).toFixed(1)}% ` +
              `vs baseline ${(baselineNullRate * 100).toFixed(1)}% (${ratio.toFixed(1)}× spike).`;
          const [alert] = await db.insert(alertsTable).values({
            modelId,
            severity,
            type: feat.schemaMismatch ? "schema_mismatch" : "null_rate",
            message: msg,
            runbookUrl: feat.schemaMismatch
              ? "https://runbooks.internal/schema-mismatch"
              : "https://runbooks.internal/null-rate-spike",
          }).returning({ id: alertsTable.id });
          alertsCreated.push(alert.id);
        }
      }
    }

    // Aggregate feature drift into the global PSI/KS if no prediction bins provided
    if (!predictionBins || predictionBins.length === 0) {
      if (featureDrifts.length > 0) {
        globalPsi = Math.round(
          (featureDrifts.reduce((a, b) => a + b.psiScore, 0) / featureDrifts.length) * 10000,
        ) / 10000;
        globalKs = Math.round(
          (featureDrifts.reduce((a, b) => a + b.ksStatistic, 0) / featureDrifts.length) * 10000,
        ) / 10000;
        driftSeverity = psiSeverity(globalPsi);
      }
    }
  }

  // ── 4. Insert drift_metrics row ───────────────────────────────────────────
  const [dm] = await db.insert(driftMetricsTable).values({
    modelId,
    psiScore: globalPsi,
    ksStatistic: globalKs,
    chiSquareStat: globalKs * 18.3,        // chi² ≈ KS² × n (scaled proxy)
    driftSeverity,
    featureCount: features?.length ?? 0,
  }).returning({ id: driftMetricsTable.id });
  driftMetricId = dm.id;

  res.json({
    driftMetricId,
    latencyMetricId,
    driftSeverity,
    psiScore: globalPsi,
    ksStatistic: globalKs,
    alertsCreated: alertsCreated.length,
    featureDrifts,
  });
});

// ─── POST /ingest/baseline ────────────────────────────────────────────────────

router.post("/ingest/baseline", requireApiKey, async (req, res) => {
  const parsed = SetBaselineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const { modelId, bins } = parsed.data;

  const [model] = await db
    .select({ id: modelVersionsTable.id })
    .from(modelVersionsTable)
    .where(eq(modelVersionsTable.id, modelId));
  if (!model) {
    res.status(404).json({ error: `Model ${modelId} not found` });
    return;
  }

  // Delete existing baselines for this model, then reinsert
  await db
    .delete(predictionBaselinesTable)
    .where(eq(predictionBaselinesTable.modelId, modelId));

  const totalCount = bins.reduce((a, b) => a + b.count, 0) || 1;
  const rows = bins.map((b) => ({
    modelId,
    bin: b.bin,
    label: b.bin,
    count: b.count,
    proportion: b.count / totalCount,
  }));

  await db.insert(predictionBaselinesTable).values(rows);

  res.json({ stored: rows.length });
});

export default router;
