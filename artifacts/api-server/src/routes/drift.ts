import { Router } from "express";
import { db } from "@workspace/db";
import { driftMetricsTable, featureDriftScoresTable, modelVersionsTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";
import { ListDriftMetricsQueryParams, GetFeatureHeatmapQueryParams, GetDriftSummaryQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/drift/metrics", async (req, res) => {
  const parsed = ListDriftMetricsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { modelId, hours = 24 } = parsed.data;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const conditions = [gte(driftMetricsTable.timestamp, since)];
  if (modelId) conditions.push(eq(driftMetricsTable.modelId, modelId));

  const metrics = await db
    .select({
      id: driftMetricsTable.id,
      modelId: driftMetricsTable.modelId,
      modelName: modelVersionsTable.name,
      timestamp: driftMetricsTable.timestamp,
      psiScore: driftMetricsTable.psiScore,
      ksStatistic: driftMetricsTable.ksStatistic,
      chiSquareStat: driftMetricsTable.chiSquareStat,
      driftSeverity: driftMetricsTable.driftSeverity,
      featureCount: driftMetricsTable.featureCount,
    })
    .from(driftMetricsTable)
    .innerJoin(modelVersionsTable, eq(driftMetricsTable.modelId, modelVersionsTable.id))
    .where(and(...conditions))
    .orderBy(driftMetricsTable.timestamp);

  res.json(metrics.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })));
});

router.get("/drift/feature-heatmap", async (req, res) => {
  const parsed = GetFeatureHeatmapQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { modelId } = parsed.data;

  const conditions = modelId ? [eq(featureDriftScoresTable.modelId, modelId)] : [];
  const scores = await db
    .select()
    .from(featureDriftScoresTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(featureDriftScoresTable.psiScore));

  res.json(scores.map((s) => ({
    featureName: s.featureName,
    featureType: s.featureType,
    psiScore: s.psiScore,
    ksStatistic: s.ksStatistic,
    severity: s.severity,
    nullRate: s.nullRate,
    baselineNullRate: s.baselineNullRate,
  })));
});

router.get("/drift/summary", async (req, res) => {
  const parsed = GetDriftSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { modelId } = parsed.data;

  const conditions = modelId ? [eq(featureDriftScoresTable.modelId, modelId)] : [];
  const scores = await db
    .select()
    .from(featureDriftScoresTable)
    .where(conditions.length ? and(...conditions) : undefined);

  const targetModelId = modelId ?? (scores[0]?.modelId ?? 1);
  const [model] = await db.select().from(modelVersionsTable).where(eq(modelVersionsTable.id, targetModelId));

  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const driftedFeatures = scores.filter((s) => s.severity !== "stable").length;
  const criticalFeatures = scores.filter((s) => s.severity === "critical");
  const warningFeatures = scores.filter((s) => s.severity === "warning");

  const overallSeverity =
    criticalFeatures.length > 0 ? "critical" : warningFeatures.length > 0 ? "warning" : "stable";

  const avgPsi = scores.length > 0 ? scores.reduce((a, b) => a + b.psiScore, 0) / scores.length : 0;
  const avgKs = scores.length > 0 ? scores.reduce((a, b) => a + b.ksStatistic, 0) / scores.length : 0;

  const recentMetric = await db
    .select()
    .from(driftMetricsTable)
    .where(eq(driftMetricsTable.modelId, targetModelId))
    .orderBy(desc(driftMetricsTable.timestamp))
    .limit(1);

  res.json({
    modelId: model.id,
    modelName: model.name,
    overallSeverity,
    psiScore: Math.round(avgPsi * 1000) / 1000,
    ksStatistic: Math.round(avgKs * 1000) / 1000,
    driftedFeatures,
    totalFeatures: scores.length,
    detectedAt: recentMetric[0]?.timestamp.toISOString() ?? new Date().toISOString(),
  });
});

export default router;
