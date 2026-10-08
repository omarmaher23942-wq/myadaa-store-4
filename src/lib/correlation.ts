// correlation.ts — مولّد Correlation IDs موحّد للمنصة بأكملها.
// يُستخدم في الـ middleware (edge) وفي السيرفر. لا يستورد أي شيء من next/headers
// هنا لكي يبقى قابلاً للاستيراد من بيئات edge دون آثار جانبية.
import { customAlphabet } from "nanoid";

const gen = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

// اسم الهيدر الذي يحمل معرّف الطلب عبر السلسلة كاملة.
export const REQ_ID_HEADER = "x-req-id";

// نمط موحّد يبدأ بـ req_ لتسهيل البحث في سجلات Vercel / DB.
export function newRequestId(): string {
  return `req_${gen()}`;
}

export function isWellFormedRequestId(v: unknown): v is string {
  return typeof v === "string" && /^req_[a-z0-9]{8,32}$/.test(v);
}

// قراءة آمنة لمعرّف الطلب من السياق الحالي (يعمل في RSC + Route Handlers).
// نستخدم dynamic import لتفادي كسر الـ edge في السياقات التي لا تحتوي headers.
export async function readRequestId(): Promise<string> {
  try {
    const mod = await import("next/headers");
    const h = await mod.headers();
    const fromHeader = h.get(REQ_ID_HEADER);
    if (fromHeader && isWellFormedRequestId(fromHeader)) return fromHeader;
  } catch {
    // خارج سياق الطلب (مثلاً في سكربت) — نولّد معرّفاً جديداً.
  }
  return newRequestId();
}