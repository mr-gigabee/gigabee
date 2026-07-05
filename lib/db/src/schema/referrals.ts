import { pgTable, uuid, bigint, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// referral_code is stored inline on usersTable.referral_code — no separate table.

export const referralsTable = pgTable("referrals", {
  id:            uuid("id").primaryKey().defaultRandom(),
  referrerId:    uuid("referrer_id").notNull().references(() => usersTable.id),
  refereeId:     uuid("referee_id").notNull().unique().references(() => usersTable.id),
  activatedAt:   timestamp("activated_at", { withTimezone: true }),
  expiresAt:     timestamp("expires_at", { withTimezone: true }),
  earnedUsdMicro: bigint("earned_usd_micro", { mode: "number" }).notNull().default(0),
  capUsdMicro:   bigint("cap_usd_micro", { mode: "number" }).notNull().default(100_000_000),
});

export type Referral = typeof referralsTable.$inferSelect;
