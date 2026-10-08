import { pgTable, uuid, text, timestamp, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const SYSTEM_EVENT_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
export type SystemEventLevel = (typeof SYSTEM_EVENT_LEVELS)[number];

/** النطاقات المعتمدة لعمود scope. */
export const SYSTEM_EVENT_CATEGORIES = [
  "auth", "onboarding", "store", "billing", "ai", "ops", "system", "security",
  "order", "payment", "webhook",
] as const;
export type SystemEventCategory = (typeof SYSTEM_EVENT_CATEGORIES)[number];

/** سجل أحداث النظام (Audit + Debug): من فعل ماذا ومتى */
export const systemEvents = pgTable("system_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  level: text("level").notNull().default("info"),       // info | warn | error
  scope: text("scope").notNull(),                       // auth | order | store | ai | webhook | payment
  storeId: uuid("store_id"),
  actor: text("actor"),                                 // merchant:<id> | platform:<id> | system | ai
  message: text("message").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("system_events_scope_idx").on(t.scope, t.createdAt), index("system_events_store_idx").on(t.storeId)]);

/** Magic Links أحادية الاستخدام (تفعيل حساب التاجر بعد الدفع، أو استعادة كلمة المرور) */
export const magicLinks = pgTable("magic_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose").notNull(),                   // activate | reset
  merchantId: uuid("merchant_id").notNull(),
  storeId: uuid("store_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("magic_links_token_uq").on(t.tokenHash)]);

/** Feature Flags تُدار من أدمن المنصة بدون Deploy */
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  config: jsonb("config").$type<Record<string, unknown>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
