import { pgTable, pgEnum, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const kycStatusEnum = pgEnum("kyc_status", ["none", "required", "verified"]);

export const usersTable = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  authProvider: text("auth_provider").notNull().default("magic_link"),
  solanaAddress: text("solana_address").unique(),
  handle:       text("handle").unique(),
  referralCode: text("referral_code").notNull().unique(),
  referredBy:   uuid("referred_by"),
  kycStatus:    kycStatusEnum("kyc_status").notNull().default("none"),
  status:       text("status").notNull().default("active"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeysTable = pgTable("api_keys", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      uuid("user_id").notNull().references(() => usersTable.id),
  keyHash:     text("key_hash").notNull().unique(),
  keyPrefix:   text("key_prefix").notNull(),
  label:       text("label"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt:  timestamp("last_used_at", { withTimezone: true }),
  revokedAt:   timestamp("revoked_at", { withTimezone: true }),
});

export const magicLinksTable = pgTable("magic_links", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  used:      boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("sessions", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User    = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
