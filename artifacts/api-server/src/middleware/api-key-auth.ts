import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers["x-api-key"];
  if (!raw || typeof raw !== "string") {
    res.status(401).json({
      error: "Missing API key",
      hint: "Add the header: X-API-Key: sk-ml-<your-key>",
    });
    return;
  }

  const hash = hashKey(raw);
  const [record] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, hash), eq(apiKeysTable.isActive, true)))
    .limit(1);

  if (!record) {
    res.status(401).json({ error: "Invalid or revoked API key" });
    return;
  }

  // Update last_used_at (fire-and-forget, don't block the request)
  db.update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, record.id))
    .catch(() => {});

  next();
}
