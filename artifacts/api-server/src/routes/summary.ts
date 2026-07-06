import { Router } from "express";
import { db } from "@workspace/db";
import {
  modelVersionsTable,
  alertsTable,
  driftMetricsTable,
  featureDriftScoresTable,
  predictionBaselinesTable,
  latencyMetricsTable,
} from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { GetPredictionDistributionQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/summary/dashboard", async (req, res) => {
  const models = await db.select().from(modelVersionsTable);
  const totalModels = models.length;
  const activeModels = models.filter((m) => m.status === "active").length;
  const degradedModels = models.filter((m) => m.status === "degraded").length;

  const allAlerts = await db.select().from(alertsTable);
  const activeAlerts = allAlerts.filter((a) => a.status === "active").length;
  const criticalAlerts = allAlerts.filter((a) => a.status === "active" && a.severity === "critical").length;

  const totalDailyUsers = models.reduce((sum, m) => sum + m.dailyUsers, 0);

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentMetrics = await db
    .select()
    .from(driftMetricsTable)
    .where(gte(driftMetricsTable.timestamp, since24h));
  const recentDriftDetections = recentMetrics.filter((m) => m.driftSeverity !== "stable").length;

  const resolvedAlerts = allAlerts.filter((a) => a.status === "resolved" && a.resolvedAt);
  const mttdMinutes =
    resolvedAlerts.length > 0
      ? resolvedAlerts.reduce((sum, a) => {
          const diff = (a.resolvedAt!.getTime() - a.triggeredAt.getTime()) / 60000;
          return sum + diff;
        }, 0) / resolvedAlerts.length
      : 12;

  const overallHealth =
    criticalAlerts > 0 ? "critical" : degradedModels > 0 ? "degraded" : "healthy";

  res.json({
    totalModels,
    activeModels,
    degradedModels,
    activeAlerts,
    criticalAlerts,
    mttdMinutes: Math.round(mttdMinutes * 10) / 10,
    totalDailyUsers,
    overallHealth,
    recentDriftDetections,
    preventedImpacts: resolvedAlerts.length,
  });
});

router.get("/summary/prediction-distribution", async (req, res) => {
  const parsed = GetPredictionDistributionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { modelId } = parsed.data;

  // Use model 1 (fraud-detector) as default if none specified
  const targetModelId = modelId ?? 1;

  const baselines = await db
    .select()
    .from(predictionBaselinesTable)
    .where(eq(predictionBaselinesTable.modelId, targetModelId))
    .orderBy(predictionBaselinesTable.bin);

  if (baselines.length === 0) {
    res.json([]);
    return;
  }

  // Pull the most recent latency metric as a proxy for request volume
  const [latestLatency] = await db
    .select()
    .from(latencyMetricsTable)
    .where(eq(latencyMetricsTable.modelId, targetModelId))
    .orderBy(desc(latencyMetricsTable.timestamp))
    .limit(1);

  const totalRequests = latestLatency?.requestCount ?? 50000;

  // Pull latest drift metric to get the observed distribution shift
  const [latestDrift] = await db
    .select()
    .from(driftMetricsTable)
    .where(eq(driftMetricsTable.modelId, targetModelId))
    .orderBy(desc(driftMetricsTable.timestamp))
    .limit(1);

  const psi = latestDrift?.psiScore ?? 0;

  // Reconstruct current bin counts: shift mass from low to high scores
  // proportional to the measured PSI (simulates the rightward skew on drift)
  const totalBaseline = baselines.reduce((a, b) => a + b.count, 0);
  const bins = baselines.map((b, i) => {
    const proportion = b.count / totalBaseline;
    const shift = psi * (i / baselines.length - 0.5) * 0.4;
    const currentProportion = Math.max(0.001, proportion + shift);
    return {
      bin: b.bin,
      label: b.label.replace("-", "–"),
      baselineCount: Math.round(b.count),
      currentCount: Math.round(currentProportion * totalRequests),
    };
  });

  res.json(bins);
});

export default router;
