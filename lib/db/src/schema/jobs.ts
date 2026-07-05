import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { workersTable } from "./workers";

export const jobTierEnum = pgEnum("job_tier", ["hover", "glide"]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "dispatched",
  "streaming",
  "done",
  "failed",
  "refunded",
]);

// No content columns by design — stores metadata only.
export const jobsTable = pgTable("jobs", {
  id:               uuid("id").primaryKey().defaultRandom(),
  userId:           uuid("user_id").notNull().references(() => usersTable.id),
  workerId:         uuid("worker_id").references(() => workersTable.id, { onDelete: "set null" }),
  tier:             jobTierEnum("tier").notNull(),
  model:            text("model").notNull(),
  status:           jobStatusEnum("status").notNull().default("queued"),
  creditsCharged:   integer("credits_charged").notNull(),
  promptTokens:     integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  ttfbMs:           integer("ttfb_ms"),
  durationMs:       integer("duration_ms"),
  isCanary:         boolean("is_canary").notNull().default(false),
  mirroredOf:       uuid("mirrored_of"),
  failureReason:    text("failure_reason"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:      timestamp("completed_at", { withTimezone: true }),
});

export type Job = typeof jobsTable.$inferSelect;
