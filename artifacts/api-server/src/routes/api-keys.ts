/**
 * API key management  —  /api/api-keys
 *
 * Keys authenticate requests to /api/v1/* as an alternative to session tokens.
 * Format: giga_<32-char lowercase hex>
 * Auth:   SHA-256 hash stored in DB; full key shown once on creation.
 * Limit:  3 active keys per user.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { createHash, randomBytes } from "crypto";
import { db, usersTable, apiKeysTable } from "@workspace/db";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

const MAX_KEYS_PER_USER = 3;

function generateKey(): { raw: string; hash: string; prefix: string } {
  const raw = "giga_" + randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

// ── GET /api/api-keys ─────────────────────────────────────────────────────────
// List all non-revoked keys for the authenticated user.

router.get("/api-keys", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthedRequest).user;

  const keys = await db
    .select({
      id: apiKeysTable.id,
      keyPrefix: apiKeysTable.keyPrefix,
      label: apiKeysTable.label,
      createdAt: apiKeysTable.createdAt,
      lastUsedAt: apiKeysTable.lastUsedAt,
    })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.userId, user.id), isNull(apiKeysTable.revokedAt)))
    .orderBy(apiKeysTable.createdAt);

  res.json({ keys });
});

// ── POST /api/api-keys ────────────────────────────────────────────────────────
// Create a new API key. Returns the raw key once — it cannot be retrieved again.

router.post("/api-keys", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const label: string | undefined = typeof req.body?.label === "string" ? req.body.label.trim().slice(0, 80) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.userId, user.id), isNull(apiKeysTable.revokedAt)));

  if (total >= MAX_KEYS_PER_USER) {
    res.status(400).json({ error: `You have reached the limit of ${MAX_KEYS_PER_USER} active API keys.` });
    return;
  }

  const { raw, hash, prefix } = generateKey();

  const [created] = await db
    .insert(apiKeysTable)
    .values({
      userId: user.id,
      keyHash: hash,
      keyPrefix: prefix,
      label: label || null,
    })
    .returning({
      id: apiKeysTable.id,
      keyPrefix: apiKeysTable.keyPrefix,
      label: apiKeysTable.label,
      createdAt: apiKeysTable.createdAt,
    });

  res.status(201).json({
    key: raw,
    id: created.id,
    keyPrefix: created.keyPrefix,
    label: created.label,
    createdAt: created.createdAt,
  });
});

// ── DELETE /api/api-keys/:id ──────────────────────────────────────────────────
// Revoke a key owned by the authenticated user.

router.delete("/api-keys/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const id = req.params.id as string;

  const [key] = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, user.id), isNull(apiKeysTable.revokedAt)));

  if (!key) {
    res.status(404).json({ error: "API key not found or already revoked." });
    return;
  }

  await db
    .update(apiKeysTable)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeysTable.id, id));

  res.json({ ok: true });
});

export default router;
