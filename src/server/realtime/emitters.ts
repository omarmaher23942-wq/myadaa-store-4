// src/server/realtime/emitters.ts — طبقة إرسال موحّدة لكل الأحداث.
//
// السبب الجذري:
// بدون طبقة موحّدة، كل action يُنادي publishEvent مباشرة بـ string حر،
// فينتج: أخطاء runtime، صفر type safety، وغياب عمليات logging عند الفشل.
//
// المبادئ:
//  - كل دالة تمرّ عبر publishEvent مع types موثوقة من events.ts.
//  - Fire-and-forget: أي فشل Pusher لا يكسر العملية الأصلية.
//  - تُسجَّل كل الاستدعاءات في system_events (في pusher-server).
//  - ttl + reqId تلقائياً.
import "server-only";
import { publishEvent } from "@/lib/pusher-server";
import { readRequestId } from "@/lib/correlation";
import { orderKey } from "@/server/realtime/events";
import type {
  OrderCreatedPayload,
  OrderStatusChangedPayload,
  PaymentSubmittedPayload,
  PaymentConfirmedPayload,
  ReviewPostedPayload,
  BuildProgressPayload,
  BuildCompletedPayload,
  TrialWarningPayload,
  CartAbandonedPayload,
  NotificationPayload,
} from "./events";

const safe = async (
  label: string,
  fn: () => Promise<void>
): Promise<void> => {
  try {
    await fn();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[emitters] ${label} failed`, e);
  }
};

// ─── Order events ──────────────────────────────────────────────────────────
export async function emitOrderCreated(
  storeId: string,
  payload: OrderCreatedPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("order_created", () =>
    publishEvent("order:created", storeId, payload, {
      reqId,
      storeId,
    })
  );
}

export async function emitOrderStatusChanged(
  storeId: string,
  orderCode: string,
  payload: OrderStatusChangedPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("order_status_changed", () =>
    publishEvent("order:status-changed", orderKey(storeId, orderCode), payload, {
      reqId,
      storeId,
    })
  );
}

// ─── Payment events ────────────────────────────────────────────────────────
export async function emitPaymentSubmitted(
  payload: PaymentSubmittedPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("payment_submitted", () =>
    publishEvent("payment:submitted", "owner", payload, {
      reqId,
      storeId: payload.storeId,
    })
  );
}

export async function emitPaymentConfirmed(
  storeId: string,
  payload: PaymentConfirmedPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("payment_confirmed", () =>
    publishEvent("payment:confirmed", storeId, payload, {
      reqId,
      storeId,
    })
  );
}

// ─── Review events ─────────────────────────────────────────────────────────
export async function emitReviewPosted(
  storeId: string,
  payload: ReviewPostedPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("review_posted", () =>
    publishEvent("review:posted", storeId, payload, { reqId, storeId })
  );
}

// ─── Build events ──────────────────────────────────────────────────────────
export async function emitBuildProgress(
  merchantId: string,
  payload: BuildProgressPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("build_progress", () =>
    publishEvent("build:progress", merchantId, payload, {
      reqId,
      merchantId,
    })
  );
}

export async function emitBuildCompleted(
  merchantId: string,
  payload: BuildCompletedPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("build_completed", () =>
    publishEvent("build:completed", merchantId, payload, {
      reqId,
      merchantId,
      storeId: payload.storeId,
    })
  );
}

// ─── Trial events ──────────────────────────────────────────────────────────
export async function emitTrialWarning(
  merchantId: string,
  payload: TrialWarningPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("trial_warning", () =>
    publishEvent("trial:warning", merchantId, payload, {
      reqId,
      merchantId,
      storeId: payload.storeId,
    })
  );
}

// ─── Cart events ───────────────────────────────────────────────────────────
export async function emitCartAbandoned(
  storeId: string,
  payload: CartAbandonedPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("cart_abandoned", () =>
    publishEvent("cart:abandoned", storeId, payload, { reqId, storeId })
  );
}

// ─── Notification ──────────────────────────────────────────────────────────
export async function emitNotification(
  merchantId: string,
  payload: NotificationPayload
): Promise<void> {
  const reqId = await readRequestId();
  await safe("notification", () =>
    publishEvent("notification", merchantId, payload, {
      reqId,
      merchantId,
    })
  );
}

// ─── Conversation events ───────────────────────────────────────────────────
export async function emitConversationMessage(
  conversationId: string,
  payload: {
    conversationId: string;
    messageId: string;
    role: "user" | "assistant" | "human_agent";
    preview: string;
    at: string;
  }
): Promise<void> {
  const reqId = await readRequestId();
  await safe("conversation_message", () =>
    publishEvent("conversation:message", conversationId, payload, { reqId })
  );
}