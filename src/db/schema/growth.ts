import { pgTable, uuid, text, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { merchants } from "./platform";
import { stores } from "./stores";

export const merchantReferrals = pgTable(
  "merchant_referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerMerchantId: uuid("referrer_merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    referredMerchantId: uuid("referred_merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    referralCodeUsed: text("referral_code_used").notNull(),
    status: text("status").notNull().default("pending"), // pending, activated, rejected
    fraudScore: integer("fraud_score").notNull().default(0),
    ipAddress: text("ip_address"),
    deviceFingerprint: text("device_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("merchant_referrals_referred_uq").on(t.referredMerchantId),
    index("merchant_referrals_referrer_idx").on(t.referrerMerchantId, t.status),
  ]
);

export const referralRewards = pgTable(
  "referral_rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    referralId: uuid("referral_id").notNull().references(() => merchantReferrals.id, { onDelete: "cascade" }),
    rewardType: text("reward_type").notNull(), // free_month, cash_bonus
    amountPiasters: integer("amount_piasters").notNull().default(0),
    isClaimed: boolean("is_claimed").notNull().default(false),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("referral_rewards_merchant_idx").on(t.merchantId, t.isClaimed)]
);

export const marketingCampaigns = pgTable(
  "marketing_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // cart_recovery_wave_1, cart_recovery_wave_2, cart_recovery_wave_3
    targetId: text("target_id").notNull(), // cartId or customerId
    status: text("status").notNull().default("scheduled"), // scheduled, sent, failed, recovered
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("marketing_campaigns_store_idx").on(t.storeId, t.type),
    index("marketing_campaigns_schedule_idx").on(t.status, t.scheduledFor),
  ]
);