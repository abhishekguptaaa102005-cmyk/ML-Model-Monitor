import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "mlmonitor-admin-2024";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateKey(prefix = "sk-ml"): string {
  return `${prefix}-${randomBytes(24).toString("hex")}`;
}

router.post("/admin/login", (req, res) => {
  const { password } = req.body ?? {};
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }
  res.json({ success: true, message: "Admin authenticated" });
});

router.post("/admin/api-keys", async (req, res) => {
  const { password, name, isAdmin } = req.body ?? {};
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rawKey = generateKey(isAdmin ? "sk-admin" : "sk-ml");
  const [record] = await db.insert(apiKeysTable).values({
    name: name ?? "Unnamed key",
    keyHash: hashKey(rawKey),
    keyPrefix: rawKey.slice(0, 12),
    isAdmin: isAdmin ?? false,
  }).returning();

  res.json({ id: record.id, name: record.name, key: rawKey, prefix: record.keyPrefix, isAdmin: record.isAdmin });
});

router.get("/admin/api-keys", async (req, res) => {
  const { password } = req.query as Record<string, string>;
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const keys = await db.select({
    id: apiKeysTable.id,
    name: apiKeysTable.name,
    keyPrefix: apiKeysTable.keyPrefix,
    isAdmin: apiKeysTable.isAdmin,
    isActive: apiKeysTable.isActive,
    createdAt: apiKeysTable.createdAt,
    lastUsedAt: apiKeysTable.lastUsedAt,
  }).from(apiKeysTable).orderBy(apiKeysTable.createdAt);
  res.json(keys.map(k => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null })));
});

router.delete("/admin/api-keys/:id", async (req, res) => {
  const { password } = req.body ?? {};
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db.update(apiKeysTable).set({ isActive: false }).where(eq(apiKeysTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

export { hashKey, generateKey };
export default router;
