import { Router } from "express";
import { db } from "@workspace/db";
import {
  modelVersionsTable,
  alertsTable,
  driftMetricsTable,
  featureDriftScoresTable,
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

  const bins = [
    { bin: "0.0-0.1", label: "0.0–0.1", baselineCount: 1200, currentCount: 1180 },
    { bin: "0.1-0.2", label: "0.1–0.2", baselineCount: 3400, currentCount: 3250 },
    { bin: "0.2-0.3", label: "0.2–0.3", baselineCount: 5800, currentCount: 5200 },
    { bin: "0.3-0.4", label: "0.3–0.4", baselineCount: 8200, currentCount: 7100 },
    { bin: "0.4-0.5", label: "0.4–0.5", baselineCount: 11500, currentCount: 9800 },
    { bin: "0.5-0.6", label: "0.5–0.6", baselineCount: 10800, currentCount: 12400 },
    { bin: "0.6-0.7", label: "0.6–0.7", baselineCount: 7600, currentCount: 9200 },
    { bin: "0.7-0.8", label: "0.7–0.8", baselineCount: 4200, currentCount: 5800 },
    { bin: "0.8-0.9", label: "0.8–0.9", baselineCount: 2100, currentCount: 3100 },
    { bin: "0.9-1.0", label: "0.9–1.0", baselineCount: 900, currentCount: 1500 },
  ];

  res.json(bins);
});

export default router;
