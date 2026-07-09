import { Router, type IRouter } from "express";
import { db, earningsLedgerTable, payoutsTable, balancesTable, workersTable, jobsTable } from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { signEarningReceipt } from "../lib/receipts";
import {
  RequestWithdrawalBody,
  GetEarningsBalanceResponse,
  GetEarningsSummaryResponse,
  GetEarningsHistoryResponse,
  RequestWithdrawalResponse,
  GetPayoutHistoryResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

// Helper: micro-dollars → USD float
const toUsd = (micro: number) => micro / 1_000_000;

router.get("/earnings/balance", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;

  let [bal] = await db.select().from(balancesTable).where(eq(balancesTable.userId, user.id));
  if (!bal) {
    [bal] = await db.insert(balancesTable).values({ userId: user.id }).returning();
  }

  // Available = sum of earnings_ledger where status=available
  const [availResult] = await db
    .select({ total: sql<number>`coalesce(sum(usd_micro), 0)` })
    .from(earningsLedgerTable)
    .where(and(eq(earningsLedgerTable.userId, user.id), eq(earningsLedgerTable.status, "available")));

  // Pending = status=pending
  const [pendResult] = await db
    .select({ total: sql<number>`coalesce(sum(usd_micro), 0)` })
    .from(earningsLedgerTable)
    .where(and(eq(earningsLedgerTable.userId, user.id), eq(earningsLedgerTable.status, "pending")));

  res.json(
    GetEarningsBalanceResponse.parse({
      honeyUsd:    toUsd(Number(availResult?.total ?? 0)),
      pendingUsd:  toUsd(Number(pendResult?.total ?? 0)),
      lifetimeUsd: toUsd(Number(bal.honeyUsdMicro ?? 0)),
    }),
  );
});

router.get("/earnings/summary", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allTime] = await db
    .select({
      total: sql<number>`coalesce(sum(usd_micro), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(earningsLedgerTable)
    .where(eq(earningsLedgerTable.userId, user.id));

  const [thisMonth] = await db
    .select({
      total: sql<number>`coalesce(sum(usd_micro), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(earningsLedgerTable)
    .where(and(eq(earningsLedgerTable.userId, user.id), gte(earningsLedgerTable.createdAt, startOfMonth)));

  const [avail] = await db
    .select({ total: sql<number>`coalesce(sum(usd_micro), 0)` })
    .from(earningsLedgerTable)
    .where(and(eq(earningsLedgerTable.userId, user.id), eq(earningsLedgerTable.status, "available")));

  // avg tps from worker
  const [worker] = await db.select().from(workersTable).where(eq(workersTable.userId, user.id));

  res.json(
    GetEarningsSummaryResponse.parse({
      balanceUsd:        toUsd(Number(avail?.total ?? 0)),
      thisMonthUsd:      toUsd(Number(thisMonth?.total ?? 0)),
      allTimeUsd:        toUsd(Number(allTime?.total ?? 0)),
      jobsThisMonth:     thisMonth?.count ?? 0,
      jobsAllTime:       allTime?.count ?? 0,
      avgTokensPerSecond: worker ? parseFloat(worker.measuredTps) : 0,
    }),
  );
});

router.get("/earnings/history", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const rows = await db
    .select({
      id:               earningsLedgerTable.id,
      jobId:            earningsLedgerTable.jobId,
      usdMicro:         earningsLedgerTable.usdMicro,
      createdAt:        earningsLedgerTable.createdAt,
      model:            jobsTable.model,
      promptTokens:     jobsTable.promptTokens,
      completionTokens: jobsTable.completionTokens,
    })
    .from(earningsLedgerTable)
    .leftJoin(jobsTable, eq(earningsLedgerTable.jobId, jobsTable.id))
    .where(eq(earningsLedgerTable.userId, user.id))
    .orderBy(desc(earningsLedgerTable.createdAt))
    .limit(50);

  res.json(
    GetEarningsHistoryResponse.parse(
      rows.map(r => ({
        id:           String(r.id),
        jobId:        r.jobId,
        amountUsd:    toUsd(r.usdMicro),
        tokensServed: (r.promptTokens ?? 0) + (r.completionTokens ?? 0),
        model:        r.model ?? "bee-hover",
        createdAt:    r.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/earnings/withdraw", requireAuth, async (req, res): Promise<void> => {
  const user   = (req as AuthedRequest).user;
  const parsed = RequestWithdrawalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { amountUsd, walletAddress } = parsed.data;
  const requestedMicro = Math.round(amountUsd * 1_000_000);

  const MIN_WITHDRAWAL_MICRO = 25_000_000; // $25.00
  if (requestedMicro < MIN_WITHDRAWAL_MICRO) {
    res.status(400).json({ error: "Minimum withdrawal is $25.00 in $GB" });
    return;
  }

  // Sum available earnings
  const [availResult] = await db
    .select({ total: sql<number>`coalesce(sum(usd_micro), 0)` })
    .from(earningsLedgerTable)
    .where(and(eq(earningsLedgerTable.userId, user.id), eq(earningsLedgerTable.status, "available")));

  const availMicro = Number(availResult?.total ?? 0);
  if (availMicro < requestedMicro) {
    res.status(400).json({ error: "Insufficient available balance" });
    return;
  }

  // Determine if this is the user's first withdrawal
  const [existingPayouts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payoutsTable)
    .where(eq(payoutsTable.userId, user.id));

  const isFirst = (existingPayouts?.count ?? 0) === 0;
  const holdUntil = isFirst ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
  const status = requestedMicro > 1_000_000_000 ? "review" : isFirst ? "held" : "requested";
  const estimatedArrival = holdUntil?.toISOString() ?? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  const [payout] = await db
    .insert(payoutsTable)
    .values({ userId: user.id, walletAddress, usdMicro: requestedMicro, status: status as any, holdUntil })
    .returning();

  res.json(
    RequestWithdrawalResponse.parse({
      id:               payout.id,
      status:           payout.status,
      amountUsd,
      estimatedArrival,
      txHash:           null,
    }),
  );
});

router.get("/earnings/payouts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const rows = await db
    .select()
    .from(payoutsTable)
    .where(eq(payoutsTable.userId, user.id))
    .orderBy(desc(payoutsTable.requestedAt));

  res.json(
    GetPayoutHistoryResponse.parse(
      rows.map(p => ({
        id:            p.id,
        amountUsd:     toUsd(p.usdMicro),
        status:        p.status,
        walletAddress: p.walletAddress,
        txHash:        p.txHash ?? null,
        createdAt:     p.requestedAt.toISOString(),
        completedAt:   p.sentAt?.toISOString() ?? null,
      })),
    ),
  );
});

/**
 * GET /earnings/receipts
 * Returns HMAC-signed proofs for all of this worker's earnings (#6 micro-settlement).
 * Workers can independently verify their accumulated balance is authentic.
 */
router.get("/earnings/receipts", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;

  const [worker] = await db
    .select({ id: workersTable.id })
    .from(workersTable)
    .where(eq(workersTable.userId, user.id));

  if (!worker) {
    res.json({ receipts: [] });
    return;
  }

  const rows = await db
    .select({
      id:        earningsLedgerTable.id,
      jobId:     earningsLedgerTable.jobId,
      usdMicro:  earningsLedgerTable.usdMicro,
      createdAt: earningsLedgerTable.createdAt,
    })
    .from(earningsLedgerTable)
    .where(eq(earningsLedgerTable.workerId, worker.id))
    .orderBy(desc(earningsLedgerTable.createdAt))
    .limit(100);

  const receipts = rows.map((r) => ({
    id:        String(r.id),
    jobId:     r.jobId,
    usdMicro:  r.usdMicro,
    createdAt: r.createdAt.toISOString(),
    receipt:   signEarningReceipt({
      workerId:    worker.id,
      jobId:       r.jobId,
      usdMicro:    r.usdMicro,
      timestampMs: r.createdAt.getTime(),
    }),
  }));

  res.json({ receipts });
});

export default router;
