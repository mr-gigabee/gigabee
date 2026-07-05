import {
  db,
  creditLedgerTable,
  balancesTable,
  jobsTable,
  earningsLedgerTable,
  workersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export async function ensureBalance(userId: string) {
  let [balance] = await db
    .select()
    .from(balancesTable)
    .where(eq(balancesTable.userId, userId));

  if (!balance) {
    await db.transaction(async (tx) => {
      [balance] = await tx
        .insert(balancesTable)
        .values({ userId, credits: 10 })
        .returning();
      await tx.insert(creditLedgerTable).values({
        userId,
        delta: 10,
        reason: "free_allowance",
      });
    });
  }

  return balance;
}

export type ChargeResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: "insufficient_credits" };

export async function chargeAndCreateJob(params: {
  jobId?: string;
  userId: string;
  tier: "hover" | "glide";
  model: string;
  creditsRequired: number;
}): Promise<ChargeResult> {
  let newJobId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const balance = await ensureBalance(params.userId);

      if (balance.credits < params.creditsRequired) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      await tx
        .update(balancesTable)
        .set({
          credits: balance.credits - params.creditsRequired,
          updatedAt: new Date(),
        })
        .where(eq(balancesTable.userId, params.userId));

      const [ledgerRow] = await tx
        .insert(creditLedgerTable)
        .values({
          userId: params.userId,
          delta: -params.creditsRequired,
          reason: "job_charge",
        })
        .returning();

      const jobValues: {
        userId: string;
        tier: "hover" | "glide";
        model: string;
        status: "queued";
        creditsCharged: number;
        id?: string;
      } = {
        userId: params.userId,
        tier: params.tier,
        model: params.model,
        status: "queued",
        creditsCharged: params.creditsRequired,
      };
      if (params.jobId) jobValues.id = params.jobId;

      const [job] = await tx
        .insert(jobsTable)
        .values(jobValues)
        .returning();

      await tx
        .update(creditLedgerTable)
        .set({ jobId: job.id })
        .where(eq(creditLedgerTable.id, ledgerRow.id));

      newJobId = job.id;
    });

    return { ok: true, jobId: newJobId! };
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_CREDITS") {
      return { ok: false, reason: "insufficient_credits" };
    }
    throw err;
  }
}

export async function refundJob(
  jobId: string,
  userId: string,
  credits: number,
) {
  await db.transaction(async (tx) => {
    await tx
      .update(balancesTable)
      .set({
        credits: sql`credits + ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(balancesTable.userId, userId));

    await tx.insert(creditLedgerTable).values({
      userId,
      jobId,
      delta: credits,
      reason: "job_refund",
    });

    await tx
      .update(jobsTable)
      .set({ status: "refunded" })
      .where(eq(jobsTable.id, jobId));
  });
}

export async function recordJobCompletion(params: {
  jobId: string;
  workerId?: string;
  creditsCharged: number;
  promptTokens: number;
  completionTokens: number;
  ttfbMs?: number;
  durationMs?: number;
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(jobsTable)
      .set({
        status: "done",
        workerId: params.workerId ?? null,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        ttfbMs: params.ttfbMs ?? null,
        durationMs: params.durationMs ?? null,
        completedAt: new Date(),
      })
      .where(eq(jobsTable.id, params.jobId));

    if (params.workerId) {
      const [worker] = await tx
        .select()
        .from(workersTable)
        .where(eq(workersTable.id, params.workerId));

      if (worker) {
        const ratePct = worker.staked ? 85 : 75;
        const usdMicro = Math.round(
          (params.creditsCharged * 10_000 * ratePct) / 100,
        );
        const availableAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await tx.insert(earningsLedgerTable).values({
          workerId: worker.id,
          userId: worker.userId,
          jobId: params.jobId,
          usdMicro,
          ratePct,
          availableAt,
        });

        await tx
          .update(workersTable)
          .set({
            jobsCompleted: worker.jobsCompleted + 1,
            lastSeenAt: new Date(),
          })
          .where(eq(workersTable.id, worker.id));

        if (worker.userId) {
          await tx
            .update(balancesTable)
            .set({
              honeyUsdMicro: sql`honey_usd_micro + ${usdMicro}`,
              updatedAt: new Date(),
            })
            .where(eq(balancesTable.userId, worker.userId));
        }
      }
    }
  });
}
