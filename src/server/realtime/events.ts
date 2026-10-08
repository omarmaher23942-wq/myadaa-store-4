// server/realtime/events.ts — العقد الوحيد لكل حدث real-time في المنصة.
//
// السبب الجذري:
// بدون عقد موحّد، كل ملف يستدعي Pusher بـ string حر → أخطاء runtime،
// لا type safety، ولا دليل واضح لأحداث المتجر.
//
// المبادئ:
//  - كل حدث له (name, channelPrefix, payload type).
//  - TypeScript يمنع تمرير payload خاطئ.
//  - إضافة حدث جديد = سطر واحد هنا + سطر في القناة.
//  - قابل للمراجعة في ثوانٍ.

// ─── أنواع القنوات ──────────────────────────────────────────────────────────
export type ChannelPrefix =
  | "private-store"        // أحداث متجر محدد (يسمعها التاجر)
  | "private-merchant"     // أحداث تاجر محدد (إشعارات شخصية)
  | "presence-store"       // حضور زوار متجر (live viewers)
  | "private-order"        // أحداث طلب محدد (يسمعها المشتري)
  | "private-platform"     // أحداث المنصة (يسمعها الأونر)
  | "private-conversation"; // محادثة AI محددة (يسمعها الأونر)

// ─── الحمولات (Payloads) ────────────────────────────────────────────────────
export type OrderCreatedPayload = {
  orderId: string;
  code: string;
  customerName: string;
  governorate: string;
  totalPiasters: number;
  itemsCount: number;
  paymentMethod: "cod" | "vodafone_cash" | "instapay";
  createdAt: string;
};

export type OrderStatusChangedPayload = {
  orderId: string;
  code: string;
  fromStatus: string;
  toStatus: string;
  note?: string;
  changedBy: string;
  changedAt: string;
};

export type OrderShippedPayload = {
  orderId: string;
  code: string;
  courierName: string;
  trackingNumber: string;
  shippedAt: string;
};

export type OrderDeliveredPayload = {
  orderId: string;
  code: string;
  deliveredAt: string;
};

export type CartAbandonedPayload = {
  cartId: string;
  customerName: string;
  phone: string;
  subtotalPiasters: number;
  itemsCount: number;
  lastSeenAt: string;
};

export type PaymentSubmittedPayload = {
  paymentId: string;
  storeId: string;
  amountPiasters: number;
  method: "vodafone_cash" | "instapay";
  senderPhone: string;
  screenshotUrl: string;
  submittedAt: string;
};

export type PaymentConfirmedPayload = {
  paymentId: string;
  storeId: string;
  amountPiasters: number;
  confirmedAt: string;
  confirmedBy: string;
};

export type ReviewPostedPayload = {
  reviewId: string;
  storeId: string;
  productId: string;
  productName: string;
  customerName: string;
  rating: number;
  hasAudio: boolean;
  createdAt: string;
};

export type BuildProgressPayload = {
  jobId: string;
  step: string;
  progress: number;
  status: "running" | "done" | "failed" | "degraded";
  message: string;
};

export type BuildCompletedPayload = {
  jobId: string;
  storeId: string;
  subdomain: string;
  score: number;
  completedAt: string;
};

export type TrialWarningPayload = {
  storeId: string;
  minutesLeft: number;
  phase: "6h" | "20h" | "freeze";
  message: string;
};

export type ConversationMessagePayload = {
  conversationId: string;
  messageId: string;
  role: "user" | "assistant" | "human_agent";
  preview: string;
  at: string;
};

export type PresenceViewerPayload = {
  storeId: string;
  viewersCount: number;
  recentGovernorates: string[];
};

export type NotificationPayload = {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  deepLink?: string;
  at: string;
};

export type InventoryLowPayload = {
  storeId: string;
  productId: string;
  productName: string;
  stock: number;
  threshold: number;
};

// ─── الحدث الموحّد (Discriminated Union) ──────────────────────────────────────
export type RealtimeEvent =
  | { name: "order:created"; channelPrefix: "private-store"; data: OrderCreatedPayload }
  | { name: "order:status-changed"; channelPrefix: "private-order"; data: OrderStatusChangedPayload }
  | { name: "order:shipped"; channelPrefix: "private-order"; data: OrderShippedPayload }
  | { name: "order:delivered"; channelPrefix: "private-order"; data: OrderDeliveredPayload }
  | { name: "cart:abandoned"; channelPrefix: "private-store"; data: CartAbandonedPayload }
  | { name: "payment:submitted"; channelPrefix: "private-platform"; data: PaymentSubmittedPayload }
  | { name: "payment:confirmed"; channelPrefix: "private-store"; data: PaymentConfirmedPayload }
  | { name: "review:posted"; channelPrefix: "private-store"; data: ReviewPostedPayload }
  | { name: "build:progress"; channelPrefix: "private-merchant"; data: BuildProgressPayload }
  | { name: "build:completed"; channelPrefix: "private-merchant"; data: BuildCompletedPayload }
  | { name: "trial:warning"; channelPrefix: "private-merchant"; data: TrialWarningPayload }
  | { name: "conversation:message"; channelPrefix: "private-conversation"; data: ConversationMessagePayload }
  | { name: "presence:viewers"; channelPrefix: "presence-store"; data: PresenceViewerPayload }
  | { name: "notification"; channelPrefix: "private-merchant"; data: NotificationPayload }
  | { name: "inventory:low"; channelPrefix: "private-store"; data: InventoryLowPayload };

// ─── بناء اسم القناة من نوع الحدث ──────────────────────────────────────────
export function buildChannelName(
  eventName: RealtimeEvent["name"],
  key: string
): string {
  switch (eventName) {
    case "order:created":
    case "cart:abandoned":
    case "review:posted":
    case "inventory:low":
    case "payment:confirmed":
      return `private-store-${key}`;
    case "order:status-changed":
    case "order:shipped":
    case "order:delivered":
      return `private-order-${key}`;
    case "build:progress":
    case "build:completed":
    case "trial:warning":
    case "notification":
      return `private-merchant-${key}`;
    case "payment:submitted":
      return `private-platform-${key}`;
    case "conversation:message":
      return `private-conversation-${key}`;
    case "presence:viewers":
      return `presence-store-${key}`;
  }
}

// ─── Helper: مفتاح قناة الطلب (متجر + كود) ─────────────────────────────────
export const orderKey = (storeId: string, orderCode: string) => `${storeId}-${orderCode}`;

// ─── Helper: بناء اسم القناة للعميل ────────────────────────────────────────
export const channels = {
  store: (storeId: string) => `private-store-${storeId}`,
  /** كود الطلب فريد داخل المتجر فقط، لذلك القناة تحمل معرّف المتجر أيضاً. */
  order: (storeId: string, orderCode: string) => `private-order-${orderKey(storeId, orderCode)}`,
  merchant: (merchantId: string) => `private-merchant-${merchantId}`,
  platform: () => `private-platform-owner`,
  conversation: (conversationId: string) => `private-conversation-${conversationId}`,
  presenceStore: (storeId: string) => `presence-store-${storeId}`,
} as const;

// ─── Helper: التحقق من صلاحية القناة للعميل ─────────────────────────────────
export type ChannelAuthContext =
  | { kind: "merchant"; merchantId: string; storeIds: string[] }
  | { kind: "customer"; customerId: string; storeId: string; orderCodes: string[] }
  | { kind: "platform"; userId: string };

export function canSubscribeToChannel(
  channel: string,
  ctx: ChannelAuthContext
): boolean {
  // المنصة (owner) تشترك في كل قناة.
  if (ctx.kind === "platform") return true;

  // التاجر يشترك في قنوات متاجره + قنواته الشخصية.
  if (ctx.kind === "merchant") {
    if (channel === channels.merchant(ctx.merchantId)) return true;
    for (const storeId of ctx.storeIds) {
      if (channel === channels.store(storeId)) return true;
      if (channel === channels.presenceStore(storeId)) return true;
      if (channel.startsWith(`private-order-${storeId}-`)) return true;
    }
    return false;
  }

  // المشتري يشترك في طلباته + presence متجره.
  if (ctx.kind === "customer") {
    if (channel === channels.presenceStore(ctx.storeId)) return true;
    for (const code of ctx.orderCodes) {
      if (channel === channels.order(ctx.storeId, code)) return true;
    }
    return false;
  }

  return false;
}