import { Router, type IRouter } from "express";
import { db, usersTable, referralsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetReferralCodeResponse, GetReferralStatsResponse } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/referrals/code", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const link = `https://gigabee.io/join?ref=${user.referralCode}`;
  res.json(GetReferralCodeResponse.parse({ code: user.referralCode, link }));
});

router.post("/auth/claim-referral", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const { referralCode } = req.body ?? {};

  if (typeof referralCode !== "string" || !referralCode.trim()) {
    res.status(400).json({ error: "referralCode is required" });
    return;
  }

  const [referrer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.referralCode, referralCode.trim()));

  if (!referrer) {
    res.status(404).json({ error: "Referral code not found" });
    return;
  }

  if (referrer.id === user.id) {
    res.status(400).json({ error: "Cannot refer yourself" });
    return;
  }

  const [existing] = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.refereeId, user.id));

  if (existing) {
    res.json({ ok: true, alreadyClaimed: true });
    return;
  }

  const expiresAt = new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000);
  await db.insert(referralsTable).values({
    referrerId: referrer.id,
    refereeId:  user.id,
    activatedAt: new Date(),
    expiresAt,
  });

  req.log.info({ referrerId: referrer.id, refereeId: user.id }, "referral claimed");
  res.json({ ok: true, alreadyClaimed: false });
});

router.get("/referrals/stats", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;

  const referrals = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, user.id));

  const totalReferred    = referrals.length;
  const activeReferrals  = referrals.filter(r => r.activatedAt !== null).length;
  const earningsUsd      = referrals.reduce((s, r) => s + r.earnedUsdMicro / 1_000_000, 0);
  const earningsCap      = totalReferred * 100; // $100 cap per referee

  res.json(
    GetReferralStatsResponse.parse({
      totalReferred,
      activeReferrals,
      earningsUsd,
      earningsCap,
      referrals: referrals.map(r => ({
        id:             r.id,
        joinedAt:       r.activatedAt?.toISOString() ?? new Date().toISOString(),
        spendUsd:       0,
        yourEarningsUsd: r.earnedUsdMicro / 1_000_000,
        active:         r.activatedAt !== null,
      })),
    }),
  );
});

export default router;
