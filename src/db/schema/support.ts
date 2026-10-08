import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { customers } from "./commerce";
import { platformUsers } from "./platform";

// تم إضافة "escalated" لحالة التذكرة
export const supportThreadStatusEnum = pgEnum("support_thread_status", ["open", "pending", "closed", "escalated"]);
// تم إضافة "system" لمرسل الرسالة
export const supportSenderRoleEnum = pgEnum("support_sender_role", ["customer", "merchant", "ai", "system"]);
export const supportCategoryEnum = pgEnum("support_category", ["shipping", "return", "payment", "product", "urgent", "general"]);
export const supportPriorityEnum = pgEnum("support_priority", ["low", "normal", "high", "urgent"]);
export const supportSentimentEnum = pgEnum("support_sentiment", ["positive", "neutral", "negative", "angry"]);

export const supportThreads = pgTable(
  "support_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    assignedTo: uuid("assigned_to").references(() => platformUsers.id, { onDelete: "set null" }),

    guestName: text("guest_name"),
    guestPhone: text("guest_phone"),
    guestEmail: text("guest_email"),
    guestTokenHash: text("guest_token_hash").notNull(),

    subject: text("subject"),
    status: supportThreadStatusEnum("status").notNull().default("open"),
    category: supportCategoryEnum("category").notNull().default("general"),
    priority: supportPriorityEnum("priority").notNull().default("normal"),
    sentiment: supportSentimentEnum("sentiment").notNull().default("neutral"),

    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessagePreview: text("last_message_preview"),
    
    slaExpiresAt: timestamp("sla_expires_at", { withTimezone: true }),
    internalNotes: jsonb("internal_notes").$type<{ note: string; addedBy: string; addedAt: string }[]>().notNull().default([]),

    unreadForMerchant: integer("unread_for_merchant").notNull().default(0),
    unreadForCustomer: integer("unread_for_customer").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("support_threads_guest_token_uq").on(t.storeId, t.guestTokenHash),
    index("support_threads_store_status_idx").on(t.storeId, t.status, t.lastMessageAt),
    index("support_threads_sla_idx").on(t.storeId, t.slaExpiresAt),
  ]
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").notNull().references(() => supportThreads.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),

    senderRole: supportSenderRoleEnum("sender_role").notNull(),
    senderName: text("sender_name"),
    text: text("text").notNull(),
    attachments: jsonb("attachments").$type<{ url: string; type: string; name?: string }[]>().notNull().default([]),
    isInternal: boolean("is_internal").notNull().default(false),

    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("support_messages_thread_idx").on(t.threadId, t.createdAt),
    index("support_messages_store_idx").on(t.storeId),
  ]
);