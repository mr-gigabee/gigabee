import { createHash } from "crypto";
import { db, usersTable, sessionsTable, apiKeysTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export async function getUserFromRequest(req: Request): Promise<typeof usersTable.$inferSelect | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  if (token.startsWith("giga_")) {
    const hash = createHash("sha256").update(token).digest("hex");

    const [key] = await db
      .select({ id: apiKeysTable.id, userId: apiKeysTable.userId })
      .from(apiKeysTable)
      .where(and(eq(apiKeysTable.keyHash, hash), isNull(apiKeysTable.revokedAt)));

    if (!key) return null;

    db.update(apiKeysTable)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeysTable.id, key.id))
      .catch(() => {});

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, key.userId));
    return user ?? null;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.token, token), gt(sessionsTable.expiresAt, new Date())));
  if (!session) return null;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  return user ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as AuthedRequest).user = user;
  next();
}

export type AuthedRequest = Request & { user: typeof usersTable.$inferSelect };
