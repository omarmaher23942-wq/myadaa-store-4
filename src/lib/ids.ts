import { customAlphabet } from "nanoid";

/**
 * أكواد قصيرة مقروءة للطلبات: بدون حروف وأرقام ملتبسة (0/O, 1/I/L).
 * نستخدم أرقامًا وحروفًا واضحة فقط: 23456789ABCDEFGHJKLMNPQRSTUVWXYZ
 * الشكل الناتج: CLP-7K3M9 (سهل للعميل يقرأه في الهاتف ولشركة الشحن).
 */
const readable = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 5);
export const newOrderCode = () => `CLP-${readable()}`;

/** معرف زائر عشوائي للتحليلات (يُنشأ في المتصفح ويُخزن في localStorage) */
export const newVisitorId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 21);

/** توكنات آمنة للجلسات والروابط السحرية */
export function secureToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString("base64url");
}

/** تجزئة SHA-256 لتخزين hash التوكن بأمان */
export async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Buffer.from(buf).toString("hex");
}