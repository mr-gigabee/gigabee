import { Router, type IRouter } from "express";
import { db, workersTable, balancesTable } from "@workspace/db";
import { eq, gte, sql } from "drizzle-orm";
import {
  RegisterWorkerBody,
  WorkerHeartbeatBody,
  RegisterWorkerResponse,
  GetMyWorkerResponse,
  WorkerHeartbeatResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../lib/auth";

const router: IRouter = Router();

// Reputation formula (spec): normalize(measuredTps) × accuracy² × (staked ? 1.15 : 1)
// We skip normalize() here since we only have one worker in dev; use raw tps.
function computeReputation(w: typeof workersTable.$inferSelect): number {
  const tps      = parseFloat(w.measuredTps);
  const accuracy = parseFloat(w.accuracy);
  const stakeMultiplier = w.staked ? 1.15 : 1.0;
  return Math.min(10.0, (tps / 100) * Math.pow(accuracy, 2) * stakeMultiplier);
}

function formatWorker(w: typeof workersTable.$inferSelect) {
  const isOnline = w.lastSeenAt && w.lastSeenAt > new Date(Date.now() - 2 * 60 * 1000);
  return {
    id:            w.id,
    type:          w.type,
    status:        w.suspendedAt ? "offline" : isOnline ? "idle" : "offline",
    reputationScore: parseFloat(w.reputation),
    totalJobsServed: w.jobsCompleted,
    totalTokensGenerated: 0,
    capabilities: {
      model:          w.models[0] ?? "bee-hover",
      tokensPerSecond: parseFloat(w.measuredTps),
      vramMb:         null,
      gpuName:        null,
    },
    createdAt: w.createdAt.toISOString(),
    lastSeen:  w.lastSeenAt?.toISOString() ?? null,
  };
}

router.post("/workers/register", requireAuth, async (req, res): Promise<void> => {
  const user   = (req as AuthedRequest).user;
  const parsed = RegisterWorkerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { type, capabilities } = parsed.data;
  const models      = [capabilities.model];
  const measuredTps = capabilities.tokensPerSecond.toString();

  // Ensure balance row exists for this worker's user (for honey payouts)
  const [existingBalance] = await db.select().from(balancesTable).where(eq(balancesTable.userId, user.id));
  if (!existingBalance) {
    await db.insert(balancesTable).values({ userId: user.id, credits: 0 });
  }

  const [existing] = await db.select().from(workersTable).where(eq(workersTable.userId, user.id));
  if (existing) {
    const [updated] = await db
      .update(workersTable)
      .set({ type, models, measuredTps, lastSeenAt: new Date() })
      .where(eq(workersTable.userId, user.id))
      .returning();
    res.status(200).json(RegisterWorkerResponse.parse(formatWorker(updated)));
    return;
  }

  const [worker] = await db
    .insert(workersTable)
    .values({ userId: user.id, type, models, measuredTps, lastSeenAt: new Date() })
    .returning();

  res.status(201).json(RegisterWorkerResponse.parse(formatWorker(worker)));
});

router.get("/workers/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthedRequest).user;
  const [worker] = await db.select().from(workersTable).where(eq(workersTable.userId, user.id));
  if (!worker) { res.status(404).json({ error: "No worker registered" }); return; }
  res.json(GetMyWorkerResponse.parse(formatWorker(worker)));
});

router.post("/workers/heartbeat", requireAuth, async (req, res): Promise<void> => {
  const parsed = WorkerHeartbeatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { workerId } = parsed.data;
  const [worker] = await db
    .update(workersTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(workersTable.id, workerId))
    .returning();

  if (!worker) { res.status(404).json({ error: "Worker not found" }); return; }

  // Recompute reputation on heartbeat
  const reputation = computeReputation(worker).toFixed(6);
  await db.update(workersTable).set({ reputation }).where(eq(workersTable.id, workerId));

  res.json(WorkerHeartbeatResponse.parse({ ok: true }));
});

export default router;
