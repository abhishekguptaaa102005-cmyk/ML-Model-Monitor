import { Router } from "express";
import { db } from "@workspace/db";
import { latencyMetricsTable, modelVersionsTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";
import { ListLatencyMetricsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/latency/metrics", async (req, res) => {
  const parsed = ListLatencyMetricsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { modelId, hours = 24 } = parsed.data;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const conditions = [gte(latencyMetricsTable.timestamp, since)];
  if (modelId) conditions.push(eq(latencyMetricsTable.modelId, modelId));

  const metrics = await db
    .select({
      id: latencyMetricsTable.id,
      modelId: latencyMetricsTable.modelId,
      modelName: modelVersionsTable.name,
      timestamp: latencyMetricsTable.timestamp,
      p50Ms: latencyMetricsTable.p50Ms,
      p95Ms: latencyMetricsTable.p95Ms,
      p99Ms: latencyMetricsTable.p99Ms,
      requestCount: latencyMetricsTable.requestCount,
      errorRate: latencyMetricsTable.errorRate,
    })
    .from(latencyMetricsTable)
    .innerJoin(modelVersionsTable, eq(latencyMetricsTable.modelId, modelVersionsTable.id))
    .where(and(...conditions))
    .orderBy(latencyMetricsTable.timestamp);

  res.json(metrics.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })));
});

router.get("/latency/current", async (req, res) => {
  const models = await db.select().from(modelVersionsTable);
  const result = [];

  for (const model of models) {
    const [latest] = await db
      .select()
      .from(latencyMetricsTable)
      .where(eq(latencyMetricsTable.modelId, model.id))
      .orderBy(desc(latencyMetricsTable.timestamp))
      .limit(1);

    if (latest) {
      const status =
        latest.p99Ms > 500 ? "critical" : latest.p99Ms > 350 ? "warning" : "normal";
      result.push({
        modelId: model.id,
        modelName: model.name,
        p50Ms: latest.p50Ms,
        p95Ms: latest.p95Ms,
        p99Ms: latest.p99Ms,
        status,
      });
    }
  }

  res.json(result);
});

export default router;
