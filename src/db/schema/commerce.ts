import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, smallint, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { orderStatusEnum, paymentMethodEnum, paymentStatusEnum, discountTypeEnum } from "./enums";
import { stores } from "./stores";
import { products, productVariants } from "./catalog";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    googleId: text("google_id"),
    avatarUrl: text("avatar_url"),
    altPhone: text("alt_phone"),
    governorate: text("governorate"),
    city: text("city"),
    address: text("address"),
    notes: text("notes"),
    ordersCount: integer("orders_count").notNull().default(0),
    totalSpentPiasters: integer("total_spent_piasters").notNull().default(0),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    isBlocked: boolean("is_blocked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_store_phone_uq").on(t.storeId, t.phone),
    index("customers_store_email_idx").on(t.storeId, t.email),
  ]
);

export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    governorate: text("governorate").notNull(),
    feePiasters: integer("fee_piasters").notNull(),
    codExtraPiasters: integer("cod_extra_piasters").notNull().default(0),
    etaMinDays: smallint("eta_min_days").notNull().default(2),
    etaMaxDays: smallint("eta_max_days").notNull().default(5),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("shipping_store_gov_uq").on(t.storeId, t.governorate)]
);

export const discounts = pgTable(
  "discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    type: discountTypeEnum("type").notNull(),
    value: integer("value").notNull(),
    minSubtotalPiasters: integer("min_subtotal_piasters"),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    perCustomerLimit: integer("per_customer_limit"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    isAutoApply: boolean("is_auto_apply").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("discounts_store_code_uq").on(t.storeId, t.code),
    check(
      "discounts_uses_nonnegative",
      sql`${t.usedCount} >= 0 AND (${t.maxUses} IS NULL OR ${t.usedCount} <= ${t.maxUses})`
    ),
  ]
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    status: orderStatusEnum("status").notNull().default("new"),

    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    customerAltPhone: text("customer_alt_phone"),
    governorate: text("governorate").notNull(),
    city: text("city"),
    address: text("address").notNull(),
    landmark: text("landmark"),
    customerNotes: text("customer_notes"),

    subtotalPiasters: integer("subtotal_piasters").notNull(),
    shippingPiasters: integer("shipping_piasters").notNull(),
    codFeePiasters: integer("cod_fee_piasters").notNull().default(0),
    discountPiasters: integer("discount_piasters").notNull().default(0),
    discountCode: text("discount_code"),
    totalPiasters: integer("total_piasters").notNull(),

    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),

    // دمج الإيصال ذرياً مع الطلب
    transferSenderPhone: text("transfer_sender_phone"),
    transferScreenshotUrl: text("transfer_screenshot_url"),

    courierName: text("courier_name"),
    trackingNumber: text("tracking_number"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    internalNotes: text("internal_notes"),
    source: text("source").notNull().default("storefront"),
    isTest: boolean("is_test").notNull().default(false),
    statusHistory: jsonb("status_history").$type<{ status: string; at: string; note?: string }[]>().notNull().default([]),
    visitorId: text("visitor_id"),
    idempotencyKey: text("idempotency_key"),
    whatsappContactedAt: timestamp("whatsapp_contacted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_store_code_uq").on(t.storeId, t.code),
    uniqueIndex("orders_store_idempotency_uq").on(t.storeId, t.idempotencyKey),
    index("orders_store_status_idx").on(t.storeId, t.status),
    index("orders_store_created_idx").on(t.storeId, t.createdAt),
    index("orders_phone_idx").on(t.storeId, t.customerPhone),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    variantLabel: text("variant_label"),
    imageUrl: text("image_url"),
    unitPiasters: integer("unit_piasters").notNull(),
    quantity: integer("quantity").notNull(),
    totalPiasters: integer("total_piasters").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.storeId, t.productId)]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    amountPiasters: integer("amount_piasters").notNull(),
    senderPhone: text("sender_phone"),
    screenshotUrl: text("screenshot_url"),
    screenshotHash: text("screenshot_hash"),
    status: paymentStatusEnum("status").notNull().default("under_review"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_store_status_idx").on(t.storeId, t.status),
    uniqueIndex("payments_order_under_review_uq").on(t.orderId).where(sql`status = 'under_review'`),
  ]
);

export const platformPayments = pgTable(
  "platform_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    method: paymentMethodEnum("method").notNull(),
    amountPiasters: integer("amount_piasters").notNull(),
    senderPhone: text("sender_phone"),
    screenshotUrl: text("screenshot_url"),
    screenshotHash: text("screenshot_hash"),
    status: paymentStatusEnum("status").notNull().default("under_review"),
    aiVerification: jsonb("ai_verification").$type<Record<string, unknown>>(),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("platform_payments_status_idx").on(t.status),
    index("platform_payments_store_idx").on(t.storeId),
    uniqueIndex("platform_payments_store_under_review_uq").on(t.storeId).where(sql`status = 'under_review'`),
  ]
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    rating: smallint("rating").notNull().default(5),
    body: text("body"),
    audioUrl: text("audio_url"),
    audioDurationSeconds: smallint("audio_duration_seconds"),
    imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
    isApproved: boolean("is_approved").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_product_idx").on(t.storeId, t.productId), index("reviews_approved_idx").on(t.storeId, t.isApproved)]
);

export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    phone: text("phone"),
    name: text("name"),
    items: jsonb("items").$type<{ productId: string; variantId?: string; name: string; qty: number; unitPiasters: number; imageUrl?: string }[]>().notNull(),
    subtotalPiasters: integer("subtotal_piasters").notNull(),
    recoveredOrderId: uuid("recovered_order_id"),
    whatsappContactedAt: timestamp("whatsapp_contacted_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("abandoned_store_visitor_uq").on(t.storeId, t.visitorId)]
);