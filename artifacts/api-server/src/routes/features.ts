import { Router } from "express";
import { db } from "@workspace/db";
import { featureStatsTable, modelVersionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ListFeaturesQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/features", async (req, res) => {
  const parsed = ListFeaturesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { modelId } = parsed.data;

  const conditions = modelId ? [eq(featureStatsTable.modelId, modelId)] : [];
  const features = await db
    .select()
    .from(featureStatsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(featureStatsTable.featureName);

  res.json(
    features.map((f) => ({
      id: f.id,
      modelId: f.modelId,
      featureName: f.featureName,
      featureType: f.featureType,
      nullRate: f.nullRate,
      baselineNullRate: f.baselineNullRate,
      schemaMismatch: f.schemaMismatch,
      lastUpdated: f.lastUpdated.toISOString(),
    }))
  );
});

export default router;
