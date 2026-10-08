// logger.ts — مُسجّل منظّم موحّد للمنصة.
// - يطبع سطراً منظّماً في stdout (يظهر في Vercel Logs).
// - يدفع الحدث إلى جدول system_events بشكل "أفضل جهد" (لا يكسر المسار أبداً).
// - كل حدث يُرفَق بـ reqId + merchantId + storeId + conversationId + sessionId + userId
//   لتسهيل التتبّع في الإنتاج.
import "server-only";
import { db } from "@/db/client";
import { systemEvents } from "@/db/schema";
import type { SystemEventCategory, SystemEventLevel } from "@/db/schema";
import { newRequestId } from "./correlation";

export type LogContext = {
  reqId?: string;
  merchantId?: string | null;
  storeId?: string | null;
  conversationId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  step?: string;
  // أي بيانات إضافية سنضعها داخل data.
  [k: string]: unknown;
};

// قائمة مفاتيح لا نكرّرها داخل JSONB data (لأنها أعمدة مستقلة).
const RESERVED = new Set([
  "reqId",
  "merchantId",
  "storeId",
  "conversationId",
  "sessionId",
  "userId",
  "step",
]);

function pickData(ctx: LogContext): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (RESERVED.has(k)) continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

function serializeError(err: unknown): Record<string, unknown> | null {
  if (!err) return null;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.slice(0, 2000),
    };
  }
  return { raw: String(err) };
}

async function emit(
  level: SystemEventLevel,
  category: SystemEventCategory,
  event: string,
  ctx: LogContext,
  message: string,
  err?: unknown
): Promise<void> {
  const reqId = ctx.reqId ?? newRequestId();
  const tag =
    `[${category}] ${event}` +
    ` req=${reqId}` +
    ` m=${ctx.merchantId ?? "-"}` +
    ` s=${ctx.storeId ?? "-"}` +
    ` c=${ctx.conversationId ?? "-"}` +
    ` ss=${ctx.sessionId ?? "-"}` +
    ` u=${ctx.userId ?? "-"}`;

  // stdout أولاً — كي لا نخسر الحدث لو فشل DB.
  const payload = message ? `${tag} :: ${message}` : tag;
  if (level === "error" || level === "fatal") {
    console.error(payload, err ?? "");
  } else if (level === "warn") {
    console.warn(payload, err ?? "");
  } else {
    console.log(payload);
  }

  // لا نُثقل قاعدة البيانات بـ debug.
  if (level === "debug") return;

  try {
    await db.insert(systemEvents).values({
      level,
      scope: category,
      storeId: isUuid(ctx.storeId) ? ctx.storeId : null,
      actor: ctx.merchantId
        ? `merchant:${ctx.merchantId}`
        : ctx.userId
        ? `user:${ctx.userId}`
        : "system",
      message: message ? `${event} :: ${message}` : event,
      data: {
        event,
        reqId,
        merchantId: ctx.merchantId ?? null,
        conversationId: ctx.conversationId ?? null,
        sessionId: ctx.sessionId ?? null,
        userId: ctx.userId ?? null,
        step: ctx.step ?? null,
        extra: pickData(ctx),
        error: serializeError(err),
      },
    });
  } catch (e) {
    // الكتابة في السجل يجب ألا تكسر المستخدم أبداً.
    console.error("[logger] persist_failed", e);
  }
}

export const log = {
  debug: (c: SystemEventCategory, e: string, ctx: LogContext, m = "") =>
    emit("debug", c, e, ctx, m),
  info: (c: SystemEventCategory, e: string, ctx: LogContext, m = "") =>
    emit("info", c, e, ctx, m),
  warn: (c: SystemEventCategory, e: string, ctx: LogContext, m = "", err?: unknown) =>
    emit("warn", c, e, ctx, m, err),
  error: (c: SystemEventCategory, e: string, ctx: LogContext, m = "", err?: unknown) =>
    emit("error", c, e, ctx, m, err),
  fatal: (c: SystemEventCategory, e: string, ctx: LogContext, m = "", err?: unknown) =>
    emit("fatal", c, e, ctx, m, err),
};