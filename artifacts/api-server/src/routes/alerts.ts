import { Router } from "express";
import { db } from "@workspace/db";
import { alertsTable, modelVersionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ListAlertsQueryParams, ResolveAlertParams } from "@workspace/api-zod";

const router = Router();

router.get("/alerts", async (req, res) => {
  const parsed = ListAlertsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { status = "all", modelId } = parsed.data;

  const conditions = [];
  if (status !== "all") conditions.push(eq(alertsTable.status, status as "active" | "resolved"));
  if (modelId) conditions.push(eq(alertsTable.modelId, modelId));

  const alerts = await db
    .select({
      id: alertsTable.id,
      modelId: alertsTable.modelId,
      modelName: modelVersionsTable.name,
      severity: alertsTable.severity,
      type: alertsTable.type,
      message: alertsTable.message,
      triggeredAt: alertsTable.triggeredAt,
      resolvedAt: alertsTable.resolvedAt,
      status: alertsTable.status,
      runbookUrl: alertsTable.runbookUrl,
    })
    .from(alertsTable)
    .innerJoin(modelVersionsTable, eq(alertsTable.modelId, modelVersionsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(alertsTable.triggeredAt);

  res.json(
    alerts.map((a) => ({
      ...a,
      triggeredAt: a.triggeredAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
    }))
  );
});

router.patch("/alerts/:alertId/resolve", async (req, res) => {
  const parsed = ResolveAlertParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid alert ID" });
    return;
  }
  const { alertId } = parsed.data;

  const [existing] = await db
    .select({ id: alertsTable.id })
    .from(alertsTable)
    .where(eq(alertsTable.id, alertId));
  if (!existing) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  const [updated] = await db
    .update(alertsTable)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(alertsTable.id, alertId))
    .returning();

  const [model] = await db
    .select({ name: modelVersionsTable.name })
    .from(modelVersionsTable)
    .where(eq(modelVersionsTable.id, updated.modelId));

  res.json({
    id: updated.id,
    modelId: updated.modelId,
    modelName: model?.name ?? "",
    severity: updated.severity,
    type: updated.type,
    message: updated.message,
    triggeredAt: updated.triggeredAt.toISOString(),
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    status: updated.status,
    runbookUrl: updated.runbookUrl,
  });
});

export default router;
