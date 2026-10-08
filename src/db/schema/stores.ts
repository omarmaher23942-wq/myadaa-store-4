import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { storeStatusEnum } from "./enums";
import { merchants, platformUsers } from "./platform";
import type { StoreBlueprint } from "@/blueprint/schema";

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    subdomain: text("subdomain").notNull(),
    customDomain: text("custom_domain"),
    name: text("name").notNull(),
    status: storeStatusEnum("status").notNull().default("intake"),
    plan: text("plan").notNull().default("launch"),
    // "امتلك متجرك": بعد أن يستلم التاجر متجره على حساباته (GitHub + Vercel + Neon) يصبح
    // ownedUrl عنوان نسخته الخاصة، ويُحوَّل إليه نطاق المتجر الفرعي، وتُحذف بيانات التجربة
    // من المنصة بعد purgeAfter (مهلة أمان لإعادة النقل إن لزم).
    ownedUrl: text("owned_url"),
    // مستودع GitHub الخاص الذي أنشأناه للتاجر بكود متجره (owner/name).
    ownedRepo: text("owned_repo"),
    ownedAt: timestamp("owned_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true }),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewDeadlineAt: timestamp("review_deadline_at", { withTimezone: true }),
    paymentInvitedAt: timestamp("payment_invited_at", { withTimezone: true }),
    doomAt: timestamp("doom_at", { withTimezone: true }),

    buildStartedAt: timestamp("build_started_at", { withTimezone: true }),
    deliverAt: timestamp("deliver_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    // عداد الـ 180 دقيقة التجريبية النشطة
    demoStartedAt: timestamp("demo_started_at", { withTimezone: true }),
    demoExpiresAt: timestamp("demo_expires_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    purgeAt: timestamp("purge_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),

    reviewedBy: uuid("reviewed_by").references(() => platformUsers.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),

    acceptingOrders: boolean("accepting_orders").notNull().default(true),
    vacationMessage: text("vacation_message"),
    showcaseOptIn: boolean("showcase_opt_in").notNull().default(true),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stores_subdomain_uq").on(t.subdomain),
    uniqueIndex("stores_custom_domain_uq").on(t.customDomain),
    index("stores_merchant_idx").on(t.merchantId),
    index("stores_status_idx").on(t.status),
    index("stores_trial_ends_idx").on(t.trialEndsAt),
    index("stores_demo_expires_idx").on(t.demoExpiresAt),
    index("stores_review_deadline_idx").on(t.reviewDeadlineAt),
    index("stores_doom_at_idx").on(t.doomAt),
    index("stores_purge_after_idx").on(t.purgeAfter),
  ]
);

export const storeBlueprints = pgTable("store_blueprints", {
  storeId: uuid("store_id").primaryKey().references(() => stores.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  data: jsonb("data").$type<StoreBlueprint>().notNull(),
  updatedBy: text("updated_by").notNull().default("system"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storeSnapshots = pgTable(
  "store_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    data: jsonb("data").$type<StoreBlueprint>().notNull(),
    label: text("label"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("snapshots_store_version_uq").on(t.storeId, t.version),
    index("snapshots_store_idx").on(t.storeId),
  ]
);