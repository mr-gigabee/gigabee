import { db, earningsLedgerTable } from "@workspace/db";
import { and, eq, lte } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Runs every 5 minutes.
 * Flips earnings from `pending` → `available` once their availableAt timestamp passes.
 * Without this, workers can never reach a withdrawable balance.
 */
async function releaseMaturedEarnings() {
  try {
    const result = await db
      .update(earningsLedgerTable)
      .set({ status: "available" })
      .where(
        and(
          eq(earningsLedgerTable.status, "pending"),
          lte(earningsLedgerTable.availableAt, new Date()),
        ),
      )
      .returning({ id: earningsLedgerTable.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "Earnings matured: pending → available");
    }
  } catch (err) {
    logger.error({ err }, "releaseMaturedEarnings failed");
  }
}

export function startScheduler() {
  // Run immediately on startup (catches any backlog from restarts)
  void releaseMaturedEarnings();

  // Then every 5 minutes
  const interval = setInterval(() => void releaseMaturedEarnings(), 5 * 60 * 1000);

  logger.info("Scheduler started (earnings release every 5 min)");

  return () => clearInterval(interval);
}
