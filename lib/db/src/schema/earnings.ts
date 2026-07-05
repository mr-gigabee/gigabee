import { pgTable, pgEnum, uuid, text, integer, bigint, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { workersTable } from "./workers";
import { jobsTable } from "./jobs";

// All money in micro-dollars: $1.00 = 1_000_000 usd_micro.

export const earningStatusEnum = pgEnum("earning_status", [
  "pending",
  "available",
  "forfeited",
  "paid",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "requested",
  "screening",
  "held",
  "batched",
  "sent",
  "failed",
  "review",
]);

// Append-only earnings ledger — never UPDATE or DELETE rows.
export const earningsLedgerTable = pgTable("earnings_ledger", {
  id:          bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  workerId:    uuid("worker_id").notNull().references(() => workersTable.id),
  userId:      uuid("user_id").notNull().references(() => usersTable.id),
  jobId:       uuid("job_id").notNull().unique().references(() => jobsTable.id),
  usdMicro:    bigint("usd_micro", { mode: "number" }).notNull(),
  ratePct:     integer("rate_pct").notNull(),
  status:      earningStatusEnum("status").notNull().default("pending"),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  payoutId:    uuid("payout_id"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payoutsTable = pgTable("payouts", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().references(() => usersTable.id),
  walletAddress:   text("wallet_address").notNull(),
  usdMicro:        bigint("usd_micro", { mode: "number" }).notNull(),
  status:          payoutStatusEnum("status").notNull().default("requested"),
  screeningResult: jsonb("screening_result"),
  holdUntil:       timestamp("hold_until", { withTimezone: true }),
  batchId:         uuid("batch_id"),
  txHash:          text("tx_hash"),
  requestedAt:     timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt:          timestamp("sent_at", { withTimezone: true }),
});

export const payoutBatchesTable = pgTable("payout_batches", {
  id:            uuid("id").primaryKey().defaultRandom(),
  chain:         text("chain").notNull().default("solana"),
  totalUsdMicro: bigint("total_usd_micro", { mode: "number" }).notNull(),
  payoutCount:   integer("payout_count").notNull(),
  txHash:        text("tx_hash"),
  executedAt:    timestamp("executed_at", { withTimezone: true }),
});

export type EarningEntry = typeof earningsLedgerTable.$inferSelect;
export type Payout       = typeof payoutsTable.$inferSelect;
export type PayoutBatch  = typeof payoutBatchesTable.$inferSelect;
