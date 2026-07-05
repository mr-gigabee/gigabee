import { pgTable, pgEnum, uuid, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const workerTypeEnum = pgEnum("worker_type", ["browser", "native", "image"]);

export const workersTable = pgTable("workers", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         uuid("user_id").notNull().references(() => usersTable.id),
  type:           workerTypeEnum("type").notNull(),
  models:         text("models").array().notNull(),       // e.g. ['bea-hover', 'bea-glide']
  measuredTps:    numeric("measured_tps", { precision: 10, scale: 2 }).notNull().default("0"),
  accuracy:       numeric("accuracy", { precision: 6, scale: 4 }).notNull().default("1.0"),
  reputation:     numeric("reputation", { precision: 10, scale: 6 }).notNull().default("1.0"),
  staked:         boolean("staked").notNull().default(false),
  jobsCompleted:  integer("jobs_completed").notNull().default(0),
  jobsFailed:     integer("jobs_failed").notNull().default(0),
  suspendedAt:    timestamp("suspended_at", { withTimezone: true }),
  lastSeenAt:     timestamp("last_seen_at", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Worker = typeof workersTable.$inferSelect;
