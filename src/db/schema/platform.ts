import { pgTable, uuid, text, timestamp, boolean, smallint, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { platformRoleEnum } from "./enums";

export const platformUsers = pgTable(
  "platform_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: platformRoleEnum("role").notNull().default("admin"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("platform_users_email_uq").on(t.email)]
);

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    googleId: text("google_id"),
    avatarUrl: text("avatar_url"),
    phone: text("phone"),
    username: text("username"),
    passwordHash: text("password_hash"),
    isActivated: boolean("is_activated").notNull().default(false),
    messengerPsid: text("messenger_psid"),
    instagramIgsid: text("instagram_igsid"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("merchants_username_uq").on(t.username),
    uniqueIndex("merchants_email_uq").on(t.email),
    uniqueIndex("merchants_google_id_uq").on(t.googleId),
    index("merchants_phone_idx").on(t.phone),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    subjectType: text("subject_type").notNull(), // 'merchant' | 'platform' | 'customer'
    subjectId: uuid("subject_id").notNull(),
    storeId: uuid("store_id"),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_uq").on(t.tokenHash),
    index("sessions_subject_idx").on(t.subjectType, t.subjectId),
    index("sessions_store_idx").on(t.storeId),
  ]
);

export const platformReviews = pgTable(
  "platform_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    storeId: uuid("store_id"),
    storeName: text("store_name").notNull(),
    authorName: text("author_name").notNull(),
    authorRole: text("author_role").default("صاحب المتجر"),
    avatarUrl: text("avatar_url"),
    rating: smallint("rating").notNull().default(5),
    content: text("content").notNull(),
    audioUrl: text("audio_url"),
    audioDurationSeconds: integer("audio_duration_seconds"),
    isApproved: boolean("is_approved").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("platform_reviews_approved_idx").on(t.isApproved),
    index("platform_reviews_featured_idx").on(t.isFeatured),
  ]
);