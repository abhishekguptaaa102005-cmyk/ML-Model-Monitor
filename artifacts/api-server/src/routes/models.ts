import { Router } from "express";
import { db } from "@workspace/db";
import {
  modelVersionsTable,
  featureStatsTable,
  featureDriftScoresTable,
  alertsTable,
  driftMetricsTable,
  latencyMetricsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateModelBody } from "@workspace/api-zod";

const router = Router();

export async function seedDefaultFeatures(modelId: number, modelName: string) {
  const lowerName = modelName.toLowerCase();

  type FeatureType = "continuous" | "categorical";
  let defaults: Array<{ name: string; type: FeatureType }> = [];

  if (lowerName.includes("fraud") || lowerName.includes("transaction")) {
    defaults = [
      { name: "transaction_amount", type: "continuous" },
      { name: "hour_of_day", type: "continuous" },
      { name: "merchant_category", type: "categorical" },
      { name: "country_code", type: "categorical" },
      { name: "card_present", type: "categorical" },
      { name: "device_type", type: "categorical" },
      { name: "days_since_last_txn", type: "continuous" },
      { name: "age", type: "continuous" },
    ];
  } else if (lowerName.includes("churn") || lowerName.includes("retention")) {
    defaults = [
      { name: "tenure_months", type: "continuous" },
      { name: "plan_type", type: "categorical" },
      { name: "nps_score", type: "continuous" },
      { name: "support_tickets", type: "continuous" },
      { name: "last_login_days", type: "continuous" },
    ];
  } else if (lowerName.includes("recommend") || lowerName.includes("reco")) {
    defaults = [
      { name: "user_age", type: "continuous" },
      { name: "category_preference", type: "categorical" },
      { name: "session_duration_s", type: "continuous" },
      { name: "click_through_rate", type: "continuous" },
      { name: "purchase_history_count", type: "continuous" },
    ];
  } else {
    defaults = [
      { name: "feature_1", type: "continuous" },
      { name: "feature_2", type: "continuous" },
      { name: "feature_3", type: "categorical" },
      { name: "feature_4", type: "categorical" },
      { name: "feature_5", type: "continuous" },
    ];
  }

  const nullRate = () => Math.round(Math.random() * 0.03 * 1000) / 1000;

  await db.insert(featureStatsTable).values(
    defaults.map((f) => ({
      modelId,
      featureName: f.name,
      featureType: f.type,
      nullRate: nullRate(),
      baselineNullRate: nullRate(),
      schemaMismatch: false,
    }))
  );

  await db.insert(featureDriftScoresTable).values(
    defaults.map((f) => {
      const psi = Math.round(Math.random() * 0.08 * 1000) / 1000;
      const ks = Math.round(Math.random() * 0.04 * 1000) / 1000;
      return {
        modelId,
        featureName: f.name,
        featureType: f.type,
        psiScore: psi,
        ksStatistic: ks,
        severity: (psi >= 0.25 ? "critical" : psi >= 0.1 ? "warning" : "stable") as
          | "stable"
          | "warning"
          | "critical",
        nullRate: nullRate(),
        baselineNullRate: nullRate(),
      };
    })
  );
}

function buildSuggestions(
  driftSeverity: string,
  psi: number,
  p99: number,
  slaBreached: boolean,
  criticalAlerts: number,
  unhealthyFeatures: number,
  modelStatus: string
): Array<{ priority: "critical" | "warning" | "info"; category: string; text: string }> {
  const suggestions: Array<{ priority: "critical" | "warning" | "info"; category: string; text: string }> = [];

  if (driftSeverity === "critical" || psi >= 0.25) {
    suggestions.push({
      priority: "critical",
      category: "Data Drift",
      text: `PSI ${psi.toFixed(3)} is above the critical threshold (0.25). Retrain on recent data as soon as possible.`,
    });
  } else if (psi >= 0.1) {
    suggestions.push({
      priority: "warning",
      category: "Data Drift",
      text: `PSI ${psi.toFixed(3)} is in the warning zone (0.10–0.25). Check feature distributions and plan a retrain if drift persists for 24–48h.`,
    });
  } else {
    suggestions.push({
      priority: "info",
      category: "Data Drift",
      text: "PSI is stable (<0.10). No action needed right now.",
    });
  }

  if (slaBreached || p99 > 500) {
    suggestions.push({
      priority: "critical",
      category: "Latency",
      text: `P99 latency (${p99.toFixed(0)}ms) is over the 500ms SLA. Check CPU/memory, review batch sizes, or scale horizontally.`,
    });
  } else if (p99 > 350) {
    suggestions.push({
      priority: "warning",
      category: "Latency",
      text: `P99 latency (${p99.toFixed(0)}ms) is creeping up toward the SLA limit. Keep an eye on server capacity.`,
    });
  }

  if (criticalAlerts > 0) {
    suggestions.push({
      priority: "critical",
      category: "Active Alerts",
      text: `${criticalAlerts} critical alert${criticalAlerts > 1 ? "s" : ""} need attention. Triage before the monitoring window closes.`,
    });
  }

  if (unhealthyFeatures > 0) {
    suggestions.push({
      priority: "warning",
      category: "Feature Health",
      text: `${unhealthyFeatures} feature${unhealthyFeatures > 1 ? "s have" : " has"} unusually high null rates. Check upstream data pipelines for recent changes.`,
    });
  }

  if (modelStatus === "degraded") {
    suggestions.push({
      priority: "warning",
      category: "Model Status",
      text: "Model is degraded. Review recent deploys — roll back if performance hasn't recovered within your SLO window.",
    });
  }

  suggestions.push({
    priority: "info",
    category: "Monitoring Hygiene",
    text: "Consider setting up automated retraining triggers at PSI > 0.20 and refreshing baselines monthly to catch drift early.",
  });

  return suggestions;
}

router.get("/models", async (req, res) => {
  const models = await db.select().from(modelVersionsTable).orderBy(modelVersionsTable.deployedAt);
  res.json(
    models.map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      status: m.status,
      deployedAt: m.deployedAt.toISOString(),
      dailyUsers: m.dailyUsers,
      description: m.description ?? null,
    }))
  );
});

router.post("/models", async (req, res) => {
  const parsed = CreateModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, version, description, dailyUsers } = parsed.data;
  const [model] = await db
    .insert(modelVersionsTable)
    .values({ name, version, description: description ?? null, dailyUsers: dailyUsers ?? 0 })
    .returning();

  await seedDefaultFeatures(model.id, model.name);

  res.status(201).json({
    id: model.id,
    name: model.name,
    version: model.version,
    status: model.status,
    deployedAt: model.deployedAt.toISOString(),
    dailyUsers: model.dailyUsers,
    description: model.description ?? null,
  });
});

router.get("/models/:modelId", async (req, res) => {
  const modelId = parseInt(req.params.modelId);
  if (isNaN(modelId)) {
    res.status(400).json({ error: "Invalid model ID" });
    return;
  }
  const [model] = await db
    .select()
    .from(modelVersionsTable)
    .where(eq(modelVersionsTable.id, modelId));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.json({
    id: model.id,
    name: model.name,
    version: model.version,
    status: model.status,
    deployedAt: model.deployedAt.toISOString(),
    dailyUsers: model.dailyUsers,
    description: model.description ?? null,
  });
});

router.get("/models/:modelId/report", async (req, res) => {
  const modelId = parseInt(req.params.modelId);
  if (isNaN(modelId)) {
    res.status(400).json({ error: "Invalid model ID" });
    return;
  }

  const [model] = await db
    .select()
    .from(modelVersionsTable)
    .where(eq(modelVersionsTable.id, modelId));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const [features, driftScores, allAlerts, latestLatency] = await Promise.all([
    db.select().from(featureStatsTable).where(eq(featureStatsTable.modelId, modelId)),
    db
      .select()
      .from(featureDriftScoresTable)
      .where(eq(featureDriftScoresTable.modelId, modelId))
      .orderBy(desc(featureDriftScoresTable.psiScore)),
    db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.modelId, modelId))
      .orderBy(desc(alertsTable.triggeredAt))
      .limit(10),
    db
      .select()
      .from(latencyMetricsTable)
      .where(eq(latencyMetricsTable.modelId, modelId))
      .orderBy(desc(latencyMetricsTable.timestamp))
      .limit(1),
  ]);

  const activeAlerts = allAlerts.filter((a) => a.status === "active");
  const criticalAlerts = activeAlerts.filter((a) => a.severity === "critical");

  const avgPsi = driftScores.length > 0
    ? driftScores.reduce((s, d) => s + d.psiScore, 0) / driftScores.length : 0;
  const avgKs = driftScores.length > 0
    ? driftScores.reduce((s, d) => s + d.ksStatistic, 0) / driftScores.length : 0;
  const driftedCount = driftScores.filter((d) => d.severity !== "stable").length;
  const driftSeverity =
    driftScores.some((d) => d.severity === "critical") ? "critical"
    : driftScores.some((d) => d.severity === "warning") ? "warning" : "stable";

  const lat = latestLatency[0];
  const p99 = lat?.p99Ms ?? 0;
  const slaBreached = p99 > 500;
  const latStatus = !lat ? "no_data" : slaBreached ? "critical" : p99 > 350 ? "warning" : "normal";

  const unhealthyFeatures = features.filter(
    (f) => f.baselineNullRate > 0 && f.nullRate > f.baselineNullRate * 2
  ).length;

  const overallHealth =
    criticalAlerts.length > 0 || driftSeverity === "critical" || slaBreached
      ? "critical"
      : model.status === "degraded" || driftSeverity === "warning" || latStatus === "warning"
      ? "degraded"
      : "healthy";

  let healthScore = 100;
  if (driftSeverity === "critical") healthScore -= 30;
  else if (driftSeverity === "warning") healthScore -= 15;
  if (slaBreached) healthScore -= 25;
  else if (latStatus === "warning") healthScore -= 10;
  if (criticalAlerts.length > 0) healthScore -= criticalAlerts.length * 10;
  if (unhealthyFeatures > 0) healthScore -= unhealthyFeatures * 5;
  if (model.status === "degraded") healthScore -= 10;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const suggestions = buildSuggestions(
    driftSeverity, avgPsi, p99, slaBreached, criticalAlerts.length, unhealthyFeatures, model.status
  );

  res.json({
    model: {
      id: model.id,
      name: model.name,
      version: model.version,
      status: model.status,
      deployedAt: model.deployedAt.toISOString(),
      dailyUsers: model.dailyUsers,
      description: model.description ?? null,
    },
    healthScore,
    overallHealth,
    drift: {
      overallSeverity: driftSeverity,
      psiScore: Math.round(avgPsi * 1000) / 1000,
      ksStatistic: Math.round(avgKs * 1000) / 1000,
      driftedFeatures: driftedCount,
      totalFeatures: driftScores.length,
      topDriftedFeatures: driftScores.slice(0, 5).map((d) => ({
        featureName: d.featureName,
        psiScore: d.psiScore,
        ksStatistic: d.ksStatistic,
        severity: d.severity,
      })),
    },
    latency: {
      p50Ms: lat?.p50Ms ?? 0,
      p95Ms: lat?.p95Ms ?? 0,
      p99Ms: lat?.p99Ms ?? 0,
      status: latStatus,
      slaBreached,
    },
    features: features.map((f) => ({
      id: f.id,
      modelId: f.modelId,
      featureName: f.featureName,
      featureType: f.featureType,
      nullRate: f.nullRate,
      baselineNullRate: f.baselineNullRate,
      schemaMismatch: f.schemaMismatch,
      lastUpdated: f.lastUpdated.toISOString(),
    })),
    alerts: {
      activeCount: activeAlerts.length,
      criticalCount: criticalAlerts.length,
      recent: allAlerts.slice(0, 5).map((a) => ({
        id: a.id,
        modelId: a.modelId,
        modelName: model.name,
        severity: a.severity,
        type: a.type,
        message: a.message,
        triggeredAt: a.triggeredAt.toISOString(),
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
        status: a.status,
        runbookUrl: a.runbookUrl ?? null,
      })),
    },
    suggestions,
  });
});

export default router;
