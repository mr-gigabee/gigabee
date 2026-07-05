import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  db,
  payoutsTable,
  earningsLedgerTable,
  usersTable,
  balancesTable,
  creditLedgerTable,
  jobsTable,
} from "@workspace/db";
import { eq, desc, sql, and, inArray, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendUsdcFromTreasury, validateTreasuryKey } from "../lib/solana/treasury";
import { orchestrator } from "../lib/orchestrator";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminToken = process.env["ADMIN_TOKEN"];
  if (!adminToken) {
    res.status(503).json({ error: "Admin not configured. Set ADMIN_TOKEN env var." });
    return;
  }
  const auth = req.headers["authorization"] ?? "";
  if (auth !== `Admin ${adminToken}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const toUsd = (micro: number | string) => Number(micro) / 1_000_000;

// GET /api/admin/overview
router.get("/admin/overview", requireAdmin, async (_req, res): Promise<void> => {
  const pendingStatuses = ["requested", "held", "review", "screening", "batched"] as const;

  const [pending] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(usd_micro), 0)`,
    })
    .from(payoutsTable)
    .where(inArray(payoutsTable.status, [...pendingStatuses]));

  const [paid] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(usd_micro), 0)`,
    })
    .from(payoutsTable)
    .where(eq(payoutsTable.status, "sent"));

  const [allEarnings] = await db
    .select({ total: sql<number>`coalesce(sum(usd_micro), 0)` })
    .from(earningsLedgerTable);

  const workerMicro = Number(allEarnings?.total ?? 0);
  const platformMicro = Math.round((workerMicro / 75) * 25);

  const treasuryReady = validateTreasuryKey();

  res.json({
    pendingCount:       pending?.count ?? 0,
    pendingUsd:         toUsd(Number(pending?.total ?? 0)),
    paidCount:          paid?.count ?? 0,
    paidUsd:            toUsd(Number(paid?.total ?? 0)),
    workerEarningsUsd:  toUsd(workerMicro),
    platformRevenueUsd: toUsd(platformMicro),
    treasuryReady:      treasuryReady.ok,
    treasuryError:      treasuryReady.ok ? null : treasuryReady.reason,
  });
});

// GET /api/admin/payouts?filter=pending|all|sent|failed
router.get("/admin/payouts", requireAdmin, async (req, res): Promise<void> => {
  const filter = (req.query["filter"] as string) ?? "all";

  const whereClause =
    filter === "pending"
      ? inArray(payoutsTable.status, ["requested", "held", "review", "screening", "batched"])
      : filter === "sent"
      ? eq(payoutsTable.status, "sent")
      : filter === "failed"
      ? eq(payoutsTable.status, "failed")
      : undefined;

  const rows = await db
    .select({
      id:            payoutsTable.id,
      email:         usersTable.email,
      walletAddress: payoutsTable.walletAddress,
      usdMicro:      payoutsTable.usdMicro,
      status:        payoutsTable.status,
      txHash:        payoutsTable.txHash,
      requestedAt:   payoutsTable.requestedAt,
      sentAt:        payoutsTable.sentAt,
      holdUntil:     payoutsTable.holdUntil,
    })
    .from(payoutsTable)
    .leftJoin(usersTable, eq(payoutsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(payoutsTable.requestedAt))
    .limit(200);

  res.json(
    rows.map(r => ({
      id:            r.id,
      email:         r.email ?? "(unknown)",
      walletAddress: r.walletAddress,
      amountUsd:     toUsd(r.usdMicro),
      status:        r.status,
      txHash:        r.txHash ?? null,
      requestedAt:   r.requestedAt.toISOString(),
      sentAt:        r.sentAt?.toISOString() ?? null,
      holdUntil:     r.holdUntil?.toISOString() ?? null,
    })),
  );
});

// POST /api/admin/payouts/:id/approve
// Automatically sends USDC from treasury and records the tx hash.
router.post("/admin/payouts/:id/approve", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };

  const [payout] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, id));
  if (!payout) { res.status(404).json({ error: "Payout not found" }); return; }
  if (payout.status === "sent") { res.status(400).json({ error: "Already sent" }); return; }

  // Check hold period
  if (payout.holdUntil && new Date(payout.holdUntil) > new Date()) {
    res.status(400).json({
      error: `Payout is on hold until ${payout.holdUntil.toISOString()}`,
    });
    return;
  }

  const transfer = await sendUsdcFromTreasury({
    recipientWallet: payout.walletAddress,
    amountUsd:       toUsd(payout.usdMicro),
  });

  if (!transfer.ok) {
    logger.error({ payoutId: id, reason: transfer.reason }, "Auto-transfer failed");
    res.status(502).json({ error: `Transfer failed: ${transfer.reason}` });
    return;
  }

  const now = new Date();

  await db
    .update(payoutsTable)
    .set({ status: "sent", txHash: transfer.txHash, sentAt: now })
    .where(eq(payoutsTable.id, id));

  await db
    .update(earningsLedgerTable)
    .set({ status: "paid", payoutId: id })
    .where(
      and(
        eq(earningsLedgerTable.userId, payout.userId),
        eq(earningsLedgerTable.status, "available"),
      ),
    );

  logger.info({ payoutId: id, txHash: transfer.txHash, userId: payout.userId }, "Payout sent");
  res.json({ ok: true, id, txHash: transfer.txHash });
});

// POST /api/admin/payouts/:id/reject
router.post("/admin/payouts/:id/reject", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };

  const [payout] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, id));
  if (!payout) { res.status(404).json({ error: "Payout not found" }); return; }
  if (payout.status === "sent") { res.status(400).json({ error: "Cannot reject a sent payout" }); return; }

  await db
    .update(payoutsTable)
    .set({ status: "failed" })
    .where(eq(payoutsTable.id, id));

  logger.info({ payoutId: id, userId: payout.userId }, "Payout rejected");
  res.json({ ok: true, id });
});

// POST /api/admin/grant-credits
// Body: { userId, credits }
router.post("/admin/grant-credits", requireAdmin, async (req, res): Promise<void> => {
  const { userId, credits } = req.body as { userId?: string; credits?: number };
  if (!userId || typeof credits !== "number" || credits <= 0) {
    res.status(400).json({ error: "userId (string) and credits (positive number) are required." });
    return;
  }

  await db
    .update(balancesTable)
    .set({ credits: sql`credits + ${credits}` })
    .where(eq(balancesTable.userId, userId));

  await db.insert(creditLedgerTable).values({
    userId,
    delta: credits,
    reason: "admin_adjust",
  });

  logger.info({ userId, credits }, "Admin granted credits");
  res.json({ ok: true, userId, creditsAdded: credits });
});

// GET /api/admin/usage — real-time network usage stats
router.get("/admin/usage", requireAdmin, async (_req, res): Promise<void> => {
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Total tokens generated all-time
  const [tokensRow] = await db
    .select({
      total: sql<string>`coalesce(sum(coalesce(${jobsTable.promptTokens},0) + coalesce(${jobsTable.completionTokens},0)), 0)::bigint`,
    })
    .from(jobsTable);

  // Credits received (topup entries only)
  const [receivedRow] = await db
    .select({ total: sql<string>`coalesce(sum(delta), 0)::bigint` })
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.reason, "topup"));

  // Credits spent (job_charge entries — delta is negative, so abs it)
  const [spentRow] = await db
    .select({ total: sql<string>`coalesce(sum(abs(delta)), 0)::bigint` })
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.reason, "job_charge"));

  // Total free credits given out
  const [freeRow] = await db
    .select({ total: sql<string>`coalesce(sum(delta), 0)::bigint` })
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.reason, "free_allowance"));

  // Total users
  const [usersRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);

  // Total jobs all-time
  const [jobsTotalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable);

  // Jobs by model (last 30 days)
  const jobsByModel = await db
    .select({
      model:   jobsTable.model,
      jobs:    sql<number>`count(*)::int`,
      credits: sql<number>`coalesce(sum(${jobsTable.creditsCharged}), 0)::int`,
      tokens:  sql<number>`coalesce(sum(coalesce(${jobsTable.promptTokens},0) + coalesce(${jobsTable.completionTokens},0)), 0)::int`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.model)
    .orderBy(sql`count(*) desc`);

  // Daily jobs + credits for last 14 days
  const daily = await db
    .select({
      day:     sql<string>`date(${jobsTable.createdAt})::text`,
      jobs:    sql<number>`count(*)::int`,
      credits: sql<number>`coalesce(sum(${jobsTable.creditsCharged}), 0)::int`,
      tokens:  sql<number>`coalesce(sum(coalesce(${jobsTable.promptTokens},0) + coalesce(${jobsTable.completionTokens},0)), 0)::int`,
    })
    .from(jobsTable)
    .where(gte(jobsTable.createdAt, since14d))
    .groupBy(sql`date(${jobsTable.createdAt})`)
    .orderBy(sql`date(${jobsTable.createdAt})`);

  // Jobs by status
  const byStatus = await db
    .select({
      status: jobsTable.status,
      count:  sql<number>`count(*)::int`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.status);

  res.json({
    tokensAllTime:   Number(tokensRow?.total ?? 0),
    creditsReceived: Number(receivedRow?.total ?? 0),
    creditsSpent:    Number(spentRow?.total ?? 0),
    creditsFree:     Number(freeRow?.total ?? 0),
    totalUsers:      usersRow?.count ?? 0,
    totalJobs:       jobsTotalRow?.count ?? 0,
    workersOnline:   orchestrator.getOnlineWorkerCount(),
    jobsByModel:     jobsByModel.map(r => ({
      model:   r.model,
      jobs:    r.jobs,
      credits: r.credits,
      tokens:  r.tokens,
    })),
    daily: daily.map(r => ({
      day:     r.day,
      jobs:    r.jobs,
      credits: r.credits,
      tokens:  r.tokens,
    })),
    byStatus: byStatus.map(r => ({ status: r.status, count: r.count })),
  });
});

export default router;
