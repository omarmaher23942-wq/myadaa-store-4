// order-status.ts — أسماء حالات الطلب والدفع وطرقه في لوحة التاجر وتصديراتها: مصدر واحد بدل نسخ متضاربة
// («تم الشحن» هنا و«مع الشحن» هناك). الدرجة اللونية دلالية وتُترجم لتوكنات اللوحة (nova/ok/warn/bad).

export type StatusTone = "nova" | "ok" | "warn" | "bad" | "muted";

export const ORDER_STATUS = {
  new: { label: "جديد", tone: "nova" },
  confirmed: { label: "مؤكد", tone: "nova" },
  preparing: { label: "قيد التجهيز", tone: "warn" },
  shipped: { label: "تم الشحن", tone: "warn" },
  delivered: { label: "تم التسليم", tone: "ok" },
  returned: { label: "مرتجع", tone: "bad" },
  cancelled: { label: "ملغي", tone: "muted" },
} as const satisfies Record<string, { label: string; tone: StatusTone }>;

export type OrderStatus = keyof typeof ORDER_STATUS;

export const PAYMENT_STATUS = {
  pending: { label: "لم يُدفع بعد", tone: "muted" },
  under_review: { label: "إيصال قيد المراجعة", tone: "warn" },
  confirmed: { label: "مدفوع", tone: "ok" },
  rejected: { label: "إيصال مرفوض", tone: "bad" },
  refunded: { label: "مسترد", tone: "muted" },
} as const satisfies Record<string, { label: string; tone: StatusTone }>;

export const PAYMENT_METHOD = {
  cod: "الدفع عند الاستلام",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
} as const;

export const orderStatusLabel = (s: string): string => ORDER_STATUS[s as OrderStatus]?.label ?? s;
export const orderStatusTone = (s: string): StatusTone => ORDER_STATUS[s as OrderStatus]?.tone ?? "muted";
export const paymentStatusLabel = (s: string): string => PAYMENT_STATUS[s as keyof typeof PAYMENT_STATUS]?.label ?? s;
export const paymentMethodLabel = (s: string): string => PAYMENT_METHOD[s as keyof typeof PAYMENT_METHOD] ?? s;

/** صنف Tailwind لشارة حالة بحسب درجتها (توكنات اللوحة، تعمل في الثيمين). */
export const TONE_CHIP: Record<StatusTone, string> = {
  nova: "bg-nova/12 text-nova-2",
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/12 text-warn",
  bad: "bg-bad/12 text-bad",
  muted: "bg-edge/[0.06] text-ink-3",
};

export const TONE_TEXT: Record<StatusTone, string> = {
  nova: "text-nova-2",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  muted: "text-ink-3",
};
