import { Router, type IRouter } from "express";
import { db, usersTable, sessionsTable, magicLinksTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import {
  RequestMagicLinkBody,
  VerifyMagicLinkBody,
  GetMeResponse,
  RequestMagicLinkResponse,
  VerifyMagicLinkResponse,
  LogoutResponse,
} from "@workspace/api-zod";
import { getUserFromRequest } from "../lib/auth";
import { authRateLimit } from "../lib/security";

const router: IRouter = Router();

function generateReferralCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "bee-";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  res.json(GetMeResponse.parse({ id: user.id, email: user.email, createdAt: user.createdAt.toISOString() }));
});

// Strict rate limit on auth mutation endpoints
router.post("/auth/magic-link", authRateLimit, async (req, res): Promise<void> => {
  const parsed = RequestMagicLinkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email } = parsed.data;

  // Validate email length to prevent abuse
  if (email.length > 254) { res.status(400).json({ error: "Invalid email" }); return; }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    const referralCode = generateReferralCode() + "-" + Math.random().toString(36).slice(2, 6);
    [user] = await db.insert(usersTable).values({ email, referralCode }).returning();
  }

  const token = crypto.randomUUID() + "-" + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(magicLinksTable).values({ userId: user.id, token, expiresAt });
  req.log.info({ userId: user.id }, "Magic link created");

  res.json(RequestMagicLinkResponse.parse({ message: "Magic link sent to your email. Check your inbox." }));
});

router.post("/auth/verify", authRateLimit, async (req, res): Promise<void> => {
  const parsed = VerifyMagicLinkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { token } = parsed.data;

  // Validate token format before hitting DB
  if (typeof token !== "string" || token.length > 128) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [link] = await db
    .select()
    .from(magicLinksTable)
    .where(and(eq(magicLinksTable.token, token), eq(magicLinksTable.used, false), gt(magicLinksTable.expiresAt, new Date())));

  if (!link) { res.status(401).json({ error: "Invalid or expired token" }); return; }
  await db.update(magicLinksTable).set({ used: true }).where(eq(magicLinksTable.id, link.id));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, link.userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }

  const sessionToken = crypto.randomUUID() + "-" + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token: sessionToken, expiresAt });

  res.json(
    VerifyMagicLinkResponse.parse({
      user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
      sessionToken,
    }),
  );
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (sessionToken) await db.delete(sessionsTable).where(eq(sessionsTable.token, sessionToken));
  res.json(LogoutResponse.parse({ ok: true }));
});

export default router;
