import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { stores } from "./stores";
import { merchants } from "./platform";

export const channelEnum = pgEnum("channel", ["messenger", "instagram"]);

/**
 * مراحل المحادثة. "proof" أُضيفت لبروتوكول الاستقبال العميق (الأسئلة الشائعة الحقيقية وآراء العملاء).
 * أي قيمة جديدة هنا تحتاج migration: ALTER TYPE conv_stage ADD VALUE.
 */
export const convStageEnum = pgEnum("conv_stage", [
  "greeting",
  "discovery",
  "persuasion",
  "trial_offer",
  "link_sent",       // رابط الاستمارة أُرسل
  "form_submitted",  // الاستمارة وصلت
  "brief",
  "products",
  "proof",
  "policies",
  "summary",
  "handoff",
  "building",
  "delivered",
  "trial",
  "payment",
  "activated",
  "frozen",
  "lost",
  "human",
]);

export type IntakeOptionDef = {
  name: string;
  kind: "color" | "size" | "custom";
  values: { label: string; hex?: string; described?: string }[];
};

export type IntakeVariant = {
  /** بنفس ترتيب optionDefs */
  optionValues: string[];
  pricePiasters: number | null;
  stock: number | null;
  available: boolean;
  sku?: string;
  imageUrls: string[];
};

export type IntakeProduct = {
  name: string;
  price: number;
  compareAt?: number;
  description?: string;
  category?: string;
  imageUrl: string;
  imageUrls?: string[];
  /** نص قديم للتوافق: يُستخدم فقط عند غياب optionDefs */
  options?: string;
  stock?: number;
  /** مخزون غير محدود (لا يُتتبع). */
  unlimitedStock?: boolean;
  sellingPoint?: string;
  bestSeller?: boolean;
  /** جديد: من الاستمارة */
  sourceId?: string;
  aiDraft?: boolean;
  attributes?: { label: string; value: string }[];
  optionDefs?: IntakeOptionDef[];
  variants?: IntakeVariant[];
  ownerDirectives?: { instruction: string; imageUrls: string[] }[];
};

/** أصول مرئية جمعها الوكيل */
export type IntakeAssets = {
  logoUrl?: string;
  coverUrls?: string[];
  /** لقطات شاشة لآراء العملاء */
  testimonialUrls?: string[];
  /** الاسم القديم (قراءة فقط للتوافق مع سجلات سابقة) */
  testimonialsUrls?: string[];
  videoUrls?: string[];
};

/** محادثة واحدة لكل مستخدم على كل قناة */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    channel: channelEnum("channel").notNull(),
    externalId: text("external_id").notNull(),
    merchantId: uuid("merchant_id").references(() => merchants.id),
    storeId: uuid("store_id").references(() => stores.id),
    stage: convStageEnum("stage").notNull().default("greeting"),
    memory: jsonb("memory").$type<Record<string, unknown>>().notNull().default({}),
    profileName: text("profile_name"),
    botPaused: boolean("bot_paused").notNull().default(false),
    lastUserMessageAt: timestamp("last_user_message_at", { withTimezone: true }),
    lastBotMessageAt: timestamp("last_bot_message_at", { withTimezone: true }),
    unreadForAdmin: integer("unread_for_admin").notNull().default(0),
    leadScore: integer("lead_score").notNull().default(0),
    lostReason: text("lost_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conv_channel_ext_uq").on(t.channel, t.externalId),
    index("conv_stage_idx").on(t.stage),
    index("conv_store_idx").on(t.storeId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    externalMid: text("external_mid"),
    text: text("text"),
    attachments: jsonb("attachments")
      .$type<{ type: "image" | "audio" | "video" | "file"; url: string; transcript?: string; utUrl?: string }[]>()
      .notNull()
      .default([]),
    toolCalls: jsonb("tool_calls").$type<unknown[]>(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    model: text("model"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conv_idx").on(t.conversationId, t.createdAt),
    uniqueIndex("messages_mid_uq").on(t.externalMid),
  ]
);

/** ما جمعه الوكيل/الاستمارة قبل البناء — صف واحد لكل متجر */
export const intakes = pgTable(
  "intakes",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    storeId: uuid("store_id").references(() => stores.id),
    brief: jsonb("brief").$type<Record<string, unknown>>().notNull().default({}),
    products: jsonb("products").$type<IntakeProduct[]>().notNull().default([]),
    policies: jsonb("policies").$type<Record<string, unknown>>().notNull().default({}),
    assets: jsonb("assets").$type<IntakeAssets>().notNull().default({}),
    /** درجة الاستعداد 0-100 من intakeReadiness (تُعرض في لوحة الأدمن) */
    completeness: integer("completeness").notNull().default(0),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // استمارة واحدة لكل متجر. المحادثة قد تنتج أكثر من متجر، ولا يجوز أن يكتب
    // متجر فوق بيانات متجر آخر (كان القيد سابقاً على conversationId).
    uniqueIndex("intakes_store_uq").on(t.storeId),
    index("intakes_conv_idx").on(t.conversationId),
  ]
);

/** مهمة بناء متجر (Upstash Workflow) */
export const buildJobs = pgTable(
  "build_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    intakeId: uuid("intake_id").notNull().references(() => intakes.id),
    status: text("status").notNull().default("queued"),
    workflowRunId: text("workflow_run_id"),
    plan: jsonb("plan").$type<Record<string, unknown>>(),
    steps: jsonb("steps")
      .$type<{ name: string; status: string; startedAt?: string; endedAt?: string; error?: string; tokens?: number }[]>()
      .notNull()
      .default([]),
    qaReport: jsonb("qa_report").$type<Record<string, unknown>>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("build_jobs_store_idx").on(t.storeId),
    index("build_jobs_status_idx").on(t.status),
  ]
);

/** كل استدعاء AI */
export const aiCalls = pgTable(
  "ai_calls",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    purpose: text("purpose").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    storeId: uuid("store_id"),
    conversationId: uuid("conversation_id"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    ok: boolean("ok").notNull().default(true),
    error: text("error"),
    fallbackFrom: text("fallback_from"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_calls_purpose_idx").on(t.purpose, t.createdAt)]
);

/** Prompts قابلة للتعديل */
export const prompts = pgTable("prompts", {
  key: text("key").primaryKey().notNull(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** مهام مؤجلة: قاعدة البيانات مصدر الحقيقة، وQStash مجرد المُطلِق. الحالات: scheduled | running | done | failed | cancelled */
export const scheduledJobs = pgTable(
  "scheduled_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    storeId: uuid("store_id").references(() => stores.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    qstashMessageId: text("qstash_message_id"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"),
    /** مفتاح منع التكرار: store:kind:runAt. يُفرَّغ عند الإلغاء ليسمح بإعادة الجدولة */
    dedupeKey: text("dedupe_key"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    firedAt: timestamp("fired_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sched_store_kind_idx").on(t.storeId, t.kind),
    uniqueIndex("sched_dedupe_uq").on(t.dedupeKey),
    index("sched_due_idx").on(t.status, t.runAt),
  ]
);