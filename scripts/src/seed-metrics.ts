import { db, eq } from "@workspace/db";
import {
  driftMetricsTable,
  latencyMetricsTable,
  modelVersionsTable,
} from "@workspace/db";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function jitter(value: number, pct = 0.08) {
  return value * (1 + (Math.random() - 0.5) * 2 * pct);
}

async function deleteJunkModels() {
  const models = await db.select().from(modelVersionsTable);
  const realNames = new Set(["fraud-detector", "churn-predictor", "recommend-engine"]);
  const junk = models.filter((m) => !realNames.has(m.name));
  for (const m of junk) {
    await db.delete(modelVersionsTable).where(eq(modelVersionsTable.id, m.id));
    console.log(`Deleted junk model: "${m.name}" (id=${m.id})`);
  }
}

async function seedDriftMetrics() {
  const now = Date.now();
  const hoursBack = 24;

  // fraud-detector (id=1): starts stable, drifts toward warning/critical mid-day
  // churn-predictor (id=2): stays at warning throughout
  const modelProfiles: Array<{
    modelId: number;
    psiStart: number;
    psiEnd: number;
    ksStart: number;
    ksEnd: number;
    featureCount: number;
  }> = [
    { modelId: 1, psiStart: 0.04, psiEnd: 0.32, ksStart: 0.03, ksEnd: 0.11, featureCount: 8 },
    { modelId: 2, psiStart: 0.12, psiEnd: 0.22, ksStart: 0.05, ksEnd: 0.09, featureCount: 5 },
  ];

  const rows = [];
  for (const profile of modelProfiles) {
    for (let h = hoursBack; h >= 0; h--) {
      const t = (hoursBack - h) / hoursBack;
      const psi = jitter(lerp(profile.psiStart, profile.psiEnd, t));
      const ks = jitter(lerp(profile.ksStart, profile.ksEnd, t));
      const chi = jitter(psi * 4.2);
      const severity =
        psi >= 0.25 ? "critical" : psi >= 0.1 ? "warning" : "stable";
      rows.push({
        modelId: profile.modelId,
        timestamp: new Date(now - h * 60 * 60 * 1000),
        psiScore: Math.round(psi * 1000) / 1000,
        ksStatistic: Math.round(ks * 1000) / 1000,
        chiSquareStat: Math.round(chi * 1000) / 1000,
        driftSeverity: severity as "stable" | "warning" | "critical",
        featureCount: profile.featureCount,
      });
    }
  }

  await db.insert(driftMetricsTable).values(rows);
  console.log(`Inserted ${rows.length} drift metric rows`);
}

async function seedLatencyMetrics() {
  const now = Date.now();
  const hoursBack = 24;

  // fraud-detector (id=1): normal latency, slight uptick end of day
  // churn-predictor (id=2): elevated, spikes over SLA midway
  const modelProfiles: Array<{
    modelId: number;
    p50Start: number;
    p50End: number;
    p95Mult: number;
    p99Mult: number;
    reqCount: number;
  }> = [
    { modelId: 1, p50Start: 82, p50End: 96, p95Mult: 2.3, p99Mult: 3.6, reqCount: 52000 },
    { modelId: 2, p50Start: 200, p50End: 260, p95Mult: 1.9, p99Mult: 2.7, reqCount: 18500 },
  ];

  const rows = [];
  for (const profile of modelProfiles) {
    for (let h = hoursBack; h >= 0; h--) {
      const t = (hoursBack - h) / hoursBack;
      // add a mid-day spike using a sine curve
      const spike = Math.sin(t * Math.PI) * 0.35;
      const p50 = jitter(lerp(profile.p50Start, profile.p50End, t) * (1 + spike));
      const p95 = jitter(p50 * profile.p95Mult);
      const p99 = jitter(p50 * profile.p99Mult);
      const errorRate = jitter(0.002 + spike * 0.008);
      rows.push({
        modelId: profile.modelId,
        timestamp: new Date(now - h * 60 * 60 * 1000),
        p50Ms: Math.round(p50 * 10) / 10,
        p95Ms: Math.round(p95 * 10) / 10,
        p99Ms: Math.round(p99 * 10) / 10,
        requestCount: Math.round(jitter(profile.reqCount / 24, 0.15)),
        errorRate: Math.round(errorRate * 10000) / 10000,
      });
    }
  }

  await db.insert(latencyMetricsTable).values(rows);
  console.log(`Inserted ${rows.length} latency metric rows`);
}

async function main() {
  console.log("Seeding demo metrics…");
  await deleteJunkModels();
  await seedDriftMetrics();
  await seedLatencyMetrics();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
