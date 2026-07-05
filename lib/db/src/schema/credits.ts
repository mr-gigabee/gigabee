import { pgTable, pgEnum, uuid, text, integer, bigint, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// 1 credit = $0.01, stored as plain integer.
// Balances: usd values stored as bigint micro-dollars ($1.00 = 1_000_000).

export const ledgerReasonEnum = pgEnum("ledger_reason", [
  "topup",
  "job_charge",
  "job_refund",
  "referral_bonus",
  "free_allowance",
  "admin_adjust",
]);

// Append-only ledger — never UPDATE or DELETE.
export const creditLedgerTable = pgTable("credit_ledger", {
  id:        bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId:    uuid("user_id").notNull().references(() => usersTable.id),
  delta:     integer("delta").notNull(),                 // positive = credit, negative = debit
  reason:    ledgerReasonEnum("reason").notNull(),
  jobId:     uuid("job_id"),                            // set for job_charge / job_refund
  depositId: uuid("deposit_id"),                        // set for topup
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Balance cache — source of truth is creditLedgerTable.
// Updated in the same DB transaction as the ledger insert.
export const balancesTable = pgTable("balances", {
  userId:        uuid("user_id").primaryKey().references(() => usersTable.id),
  credits:       integer("credits").notNull().default(0),
  honeyUsdMicro: bigint("honey_usd_micro", { mode: "number" }).notNull().default(0),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// USDC deposit tracking — idempotent on tx_hash.
export const depositsTable = pgTable("deposits", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         uuid("user_id").notNull().references(() => usersTable.id),
  chain:          text("chain").notNull().default("solana"),
  address:        text("address").notNull(),
  txHash:         text("tx_hash").unique(),              // idempotency key
  usdcMicro:      bigint("usdc_micro", { mode: "number" }),
  creditsGranted: integer("credits_granted"),
  status:         text("status").notNull().default("watching"),
  confirmedAt:    timestamp("confirmed_at", { withTimezone: true }),
});

export type Balance = typeof balancesTable.$inferSelect;
export type Deposit = typeof depositsTable.$inferSelect;
