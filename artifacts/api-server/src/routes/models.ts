import { Router } from "express";
import { db } from "@workspace/db";
import { modelVersionsTable, insertModelVersionSchema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListModelsResponseItem, CreateModelBody } from "@workspace/api-zod";
import { z } from "zod/v4";

const router = Router();

router.get("/models", async (req, res) => {
  const models = await db.select().from(modelVersionsTable).orderBy(modelVersionsTable.deployedAt);
  const result = models.map((m) => ({
    id: m.id,
    name: m.name,
    version: m.version,
    status: m.status,
    deployedAt: m.deployedAt.toISOString(),
    dailyUsers: m.dailyUsers,
    description: m.description ?? null,
  }));
  res.json(result);
});

router.post("/models", async (req, res) => {
  const parsed = CreateModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, version, description, dailyUsers } = parsed.data;
  const [model] = await db.insert(modelVersionsTable).values({
    name,
    version,
    description: description ?? null,
    dailyUsers: dailyUsers ?? 0,
  }).returning();
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
  const [model] = await db.select().from(modelVersionsTable).where(eq(modelVersionsTable.id, modelId));
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

export default router;
