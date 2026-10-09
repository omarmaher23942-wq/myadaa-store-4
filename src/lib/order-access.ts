import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { VISITOR_COOKIE, visitorOf } from "@/server/visitor";

/**
 * صلاحية فتح صفحة الطلب بدون تسجيل دخول ولا وضع رقم الموبايل في الرابط:
 * 1) cookie موقّعة بـ HMAC لكل طلب، تُمنح لحظة إنشائه.
 * 2) هوية الجهاز (cookie الخادم clp_v، سنة كاملة): كل طلب يُحفظ بجهازه، فيرى العميل طلباته في «طلباتي»
 *    من نفس الجهاز في أي وقت دون أن يحتفظ برقم الطلب.
 */
const MAX_AGE_S = 60 * 60 * 24 * 30;
const DEVICE_MAX_AGE_S = 400 * 86400;

const normCode = (code: string) => String(code ?? "").trim().toUpperCase();
const cookieName = (code: string) => `clp_o_${normCode(code).replace(/[^A-Z0-9-]/g, "")}`;

function sign(storeId: string, code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`order:${storeId}:${normCode(code)}`).digest("base64url");
}

/** معرّف هذا الجهاز (ويُثبَّت في cookie إن لم يكن). يُستدعى من Server Action أو Route Handler فقط. */
export async function ensureDeviceId(storeId: string): Promise<string> {
  const v = visitorOf(await headers(), storeId);
  if (v.setCookie) {
    const jar = await cookies();
    jar.set(VISITOR_COOKIE, v.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DEVICE_MAX_AGE_S });
  }
  return v.id;
}

/** معرّف الجهاز إن وُجد (للقراءة أثناء رسم الصفحة؛ لا يكتب cookies). */
export async function currentDeviceId(): Promise<string | null> {
  const v = (await cookies()).get(VISITOR_COOKIE)?.value;
  return v && /^d-[0-9a-f]{32}$/.test(v) ? v : null;
}

/** تُستدعى من Server Action فقط (كتابة cookies غير مسموحة أثناء رسم الصفحة) */
export async function grantOrderAccess(storeId: string, code: string): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName(code), sign(storeId, code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function hasOrderAccess(storeId: string, code: string, orderDeviceId?: string | null): Promise<boolean> {
  const jar = await cookies();
  if (orderDeviceId) {
    const device = await currentDeviceId();
    if (device && device === orderDeviceId) return true;
  }
  const value = jar.get(cookieName(code))?.value;
  if (!value) return false;
  const expected = Buffer.from(sign(storeId, code));
  const received = Buffer.from(value);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** رمز رابط التقييم في بريد «وصل طلبك»: يفتح صفحة تقييم هذا الطلب وحده من أي جهاز، دون كشف بياناته لمن يخمّن رقمه. */
export function reviewToken(storeId: string, orderId: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`review:${storeId}:${orderId}`).digest("base64url").slice(0, 32);
}

export function validReviewToken(storeId: string, orderId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(reviewToken(storeId, orderId));
  const received = Buffer.from(token);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
