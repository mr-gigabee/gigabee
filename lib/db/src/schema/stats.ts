import { pgTable, pgEnum, uuid, boolean, bigint, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { workersTable } from "./workers";
import { jobsTable } from "./jobs";

export const checkKindEnum = pgEnum("check_kind", ["canary", "mirror", "throughput"]);

export const integrityChecksTable = pgTable("integrity_checks", {
  id:        bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  jobId:     uuid("job_id").notNull().references(() => jobsTable.id),
  workerId:  uuid("worker_id").notNull().references(() => workersTable.id),
  kind:      checkKindEnum("kind").notNull(),
  passed:    boolean("passed").notNull(),
  score:     numeric("score", { precision: 6, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const statsSnapshotsTable = pgTable("stats_snapshots", {
  ts:             timestamp("ts", { withTimezone: true }).primaryKey(),
  workersOnline:  integer("workers_online").notNull(),
  jobs1h:         integer("jobs_1h").notNull(),
  tokens1h:       bigint("tokens_1h", { mode: "number" }).notNull(),
  honeyPaidTotal: bigint("honey_paid_total", { mode: "number" }).notNull(),
});

export type IntegrityCheck  = typeof integrityChecksTable.$inferSelect;
export type StatsSnapshot   = typeof statsSnapshotsTable.$inferSelect;
