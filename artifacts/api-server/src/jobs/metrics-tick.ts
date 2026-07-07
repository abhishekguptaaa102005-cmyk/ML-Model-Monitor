import { db } from "@workspace/db";
import { driftMetricsTable, latencyMetricsTable, modelVersionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

function jitter(v: number, pct = 0.06) {
  return v * (1 + (Math.random() - 0.5) * 2 * pct);
}

async function tick() {
  try {
    const models = await db.select().from(modelVersionsTable);
    const activeModels = models.filter((m) => m.status !== "shadow");

    for (const model of activeModels) {
      const [lastDrift] = await db
        .select()
        .from(driftMetricsTable)
        .where(eq(driftMetricsTable.modelId, model.id))
        .orderBy(desc(driftMetricsTable.timestamp))
        .limit(1);

      const [lastLatency] = await db
        .select()
        .from(latencyMetricsTable)
        .where(eq(latencyMetricsTable.modelId, model.id))
        .orderBy(desc(latencyMetricsTable.timestamp))
        .limit(1);

      const prevPsi = lastDrift?.psiScore ?? 0.05;
      const psi = Math.min(0.40, Math.max(0.01, jitter(prevPsi + (Math.random() - 0.45) * 0.01)));
      const ks = Math.min(0.15, Math.max(0.01, jitter((lastDrift?.ksStatistic ?? 0.03) + (Math.random() - 0.45) * 0.005)));
      const driftSeverity = psi >= 0.25 ? "critical" : psi >= 0.10 ? "warning" : "stable";

      await db.insert(driftMetricsTable).values({
        modelId: model.id,
        timestamp: new Date(),
        psiScore: Math.round(psi * 1000) / 1000,
        ksStatistic: Math.round(ks * 1000) / 1000,
        chiSquareStat: Math.round(psi * 4.2 * 1000) / 1000,
        driftSeverity: driftSeverity as "stable" | "warning" | "critical",
        featureCount: lastDrift?.featureCount ?? 5,
      });

      const prevP50 = lastLatency?.p50Ms ?? (model.name.includes("churn") ? 230 : 90);
      const p50 = Math.max(20, jitter(prevP50 + (Math.random() - 0.48) * 3));
      const p95 = jitter(p50 * (model.name.includes("churn") ? 1.9 : 2.3));
      const p99 = jitter(p50 * (model.name.includes("churn") ? 2.6 : 3.6));

      await db.insert(latencyMetricsTable).values({
        modelId: model.id,
        timestamp: new Date(),
        p50Ms: Math.round(p50 * 10) / 10,
        p95Ms: Math.round(p95 * 10) / 10,
        p99Ms: Math.round(p99 * 10) / 10,
        requestCount: Math.round(jitter((model.dailyUsers || 1000) / 24, 0.15)),
        errorRate: Math.round(Math.random() * 0.003 * 10000) / 10000,
      });
    }

    logger.info({ models: activeModels.length }, "Metrics tick complete");
  } catch (err) {
    logger.error({ err }, "Metrics tick failed");
  }
}

const TICK_INTERVAL_MS = 60 * 60 * 1000;

export function startMetricsTick() {
  setInterval(tick, TICK_INTERVAL_MS);
  logger.info({ intervalMs: TICK_INTERVAL_MS }, "Metrics tick job started");
}
