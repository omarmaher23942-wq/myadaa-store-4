import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * صلاحية فتح صفحة الطلب بدون وضع رقم الموبايل في الرابط:
 * cookie موقّعة بـ HMAC لكل طلب، تُمنح لحظة إنشائه وتُقرأ في صفحة الطلب وإثبات التحويل.
 */
const MAX_AGE_S = 60 * 60 * 24 * 30;

const normCode = (code: string) => String(code ?? "").trim().toUpperCase();
const cookieName = (code: string) => `clp_o_${normCode(code).replace(/[^A-Z0-9-]/g, "")}`;

function sign(storeId: string, code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`order:${storeId}:${normCode(code)}`).digest("base64url");
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

export async function hasOrderAccess(storeId: string, code: string): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(cookieName(code))?.value;
  if (!value) return false;
  const expected = Buffer.from(sign(storeId, code));
  const received = Buffer.from(value);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
