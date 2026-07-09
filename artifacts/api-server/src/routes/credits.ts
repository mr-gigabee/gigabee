import { Router, type IRouter } from "express";
import { db, creditLedgerTable, balancesTable, depositsTable, referralsTable } from "@workspace/db";
import { eq, desc, and, gt, gte, count, sql } from "drizzle-orm";
import {
  GetCreditsBalanceResponse,
  GetCreditTransactionsResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { ensureBalance } from "../lib/billing";
import { verifyGbPayment, getGbPrice, CREDIT_PACKAGES } from "../lib/solana/verify";

const router: IRouter = Router();

const TX_MAX_AGE_MS        = 24 * 60 * 60 * 1000; // 24 h
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;       // 1 h
const RATE_LIMIT_MAX       = 5;                     // max deposits per window

// GET /credits/balance
router.get("/credits/balance", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const balance = await ensureBalance(user.id);
  res.json(
    GetCreditsBalanceResponse.parse({
      credits: balance.credits,
      usdValue: balance.credits * 0.01,
    }),
  );
});

// GET /credits/packages  — returns packages with live $GB amounts
router.get("/credits/packages", async (_req, res): Promise<void> => {
  let gbPrice: number | null = null;
  try {
    gbPrice = await getGbPrice();
  } catch {
    // continue with gbPrice = null — frontend will handle gracefully
  }

  const packages = Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => {
    const gbAmount = gbPrice ? Math.ceil(pkg.usdAmount / gbPrice) : null;
    const bonus = pkg.credits - pkg.usdAmount * 100; // credits above 1:1
    return {
      id,
      label:         pkg.label,
      usdAmount:     pkg.usdAmount,
      gbAmount,
      credits:       pkg.credits,
      bonus:         bonus > 0 ? bonus : 0,
      pricePerCredit: (pkg.usdAmount / pkg.credits).toFixed(4),
    };
  });

  res.json({
    packages,
    gbPrice,
    treasuryWallet: process.env["TREASURY_WALLET"] ?? "4ojZUbahagMhCsnPgVqNmHWydfL5u97LYHG3ZjfZDouy",
  });
});

// POST /credits/verify-tx
router.post("/credits/verify-tx", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const { txSignature, packageId } = req.body as { txSignature?: string; packageId?: string };

  if (!txSignature || typeof txSignature !== "string" || txSignature.trim().length < 60) {
    res.status(400).json({ error: "Invalid txSignature" });
    return;
  }
  if (!packageId || typeof packageId !== "string") {
    res.status(400).json({ error: "packageId is required" });
    return;
  }

  const pkg = CREDIT_PACKAGES[packageId];
  if (!pkg) {
    res.status(400).json({ error: `Unknown packageId: ${packageId}` });
    return;
  }

  const sig = txSignature.trim();

  // ── 1. Rate limit ────────────────────────────────────────────────────────
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(depositsTable)
    .where(and(
      eq(depositsTable.userId, user.id),
      gte(depositsTable.confirmedAt, windowStart),
    ));
  if (recent >= RATE_LIMIT_MAX) {
    res.status(429).json({ error: "Too many purchases in a short time. Try again later." });
    return;
  }

  // ── 2. Idempotency — TX hash must be globally unique ────────────────────
  const [existing] = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.txHash, sig));

  if (existing) {
    if (existing.userId !== user.id) {
      req.log.warn({ userId: user.id, sig, claimedBy: existing.userId }, "TX hijack attempt");
      res.status(409).json({ error: "This transaction has already been claimed by another account." });
      return;
    }
    if (existing.status === "confirmed") {
      res.json({ ok: true, credits: pkg.credits, alreadyProcessed: true });
    } else {
      res.status(409).json({ error: "Transaction already being processed." });
    }
    return;
  }

  // ── 3. On-chain verification (live price, ±5% tolerance) ─────────────────
  const result = await verifyGbPayment({ txSignature: sig, expectedUsdAmount: pkg.usdAmount });
  if (!result.ok) {
    res.status(422).json({ error: result.reason });
    return;
  }

  // ── 4. TX age — reject if older than 24 hours ───────────────────────────
  if (result.blockTime !== null) {
    if (Date.now() - result.blockTime * 1000 > TX_MAX_AGE_MS) {
      res.status(422).json({ error: "Transaction is older than 24 hours and cannot be processed." });
      return;
    }
  }

  // ── 5. Sender ownership — must match the logged-in wallet ───────────────
  if (!user.solanaAddress) {
    res.status(403).json({ error: "No wallet linked to your account. Please reconnect your wallet." });
    return;
  }
  if (result.sender.toLowerCase() !== user.solanaAddress.toLowerCase()) {
    req.log.warn({ userId: user.id, sender: result.sender, wallet: user.solanaAddress }, "TX sender mismatch");
    res.status(403).json({
      error: "Transaction was not sent from your connected wallet. Send $GB from the same wallet you used to log in.",
    });
    return;
  }

  // ── 6. Credit atomically ─────────────────────────────────────────────────
  const gbMicro = Math.round(result.actualGbAmount * 1_000_000);
  await db.transaction(async (tx) => {
    const [deposit] = await tx
      .insert(depositsTable)
      .values({
        userId: user.id,
        chain: "solana",
        address: result.sender,
        txHash: sig,
        usdcMicro: gbMicro,
        creditsGranted: pkg.credits,
        status: "confirmed",
        confirmedAt: new Date(),
      })
      .returning();

    await tx
      .update(balancesTable)
      .set({ credits: sql`credits + ${pkg.credits}`, updatedAt: new Date() })
      .where(eq(balancesTable.userId, user.id));

    await tx.insert(creditLedgerTable).values({
      userId: user.id,
      delta: pkg.credits,
      reason: "topup",
      depositId: deposit.id,
    });
  });

  req.log.info({ userId: user.id, sig, packageId, credits: pkg.credits, gbAmount: result.actualGbAmount }, "Credits granted");

  // ── 7. Referral commission (5 %, capped $100) ────────────────────────────
  try {
    const CAP_MICRO = 100_000_000;
    const [referral] = await db
      .select()
      .from(referralsTable)
      .where(and(eq(referralsTable.refereeId, user.id), gt(referralsTable.expiresAt, new Date())));

    if (referral) {
      const usdMicro = Math.round(pkg.usdAmount * 1_000_000);
      const commission = Math.min(
        Math.floor(usdMicro * 0.05),
        CAP_MICRO - referral.earnedUsdMicro,
      );
      if (commission > 0) {
        await db.transaction(async (tx) => {
          await tx.update(referralsTable)
            .set({ earnedUsdMicro: referral.earnedUsdMicro + commission })
            .where(eq(referralsTable.id, referral.id));
          await tx.update(balancesTable)
            .set({ honeyUsdMicro: sql`honey_usd_micro + ${commission}`, updatedAt: new Date() })
            .where(eq(balancesTable.userId, referral.referrerId));
        });
        req.log.info({ referrerId: referral.referrerId, commission }, "Referral commission credited");
      }
    }
  } catch (err) {
    req.log.error({ err }, "Referral commission error (non-fatal)");
  }

  res.json({ ok: true, credits: pkg.credits, alreadyProcessed: false });
});

// GET /credits/transactions
router.get("/credits/transactions", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const rows = await db
    .select()
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.userId, user.id))
    .orderBy(desc(creditLedgerTable.createdAt))
    .limit(50);

  res.json(
    GetCreditTransactionsResponse.parse(
      rows.map((r) => ({
        id: String(r.id),
        type: r.delta > 0 ? "topup" : "debit",
        credits: r.delta,
        description: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

export { ensureBalance };
export default router;
