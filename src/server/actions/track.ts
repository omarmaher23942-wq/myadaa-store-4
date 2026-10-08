"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStoreBySubdomain } from "@/lib/tenant";
import { getOrderByCodeAndPhone } from "@/server/repos/orders";
import { grantOrderAccess } from "@/lib/order-access";
import { allow, clientIp } from "@/lib/ratelimit";

const CODE_RE = /^[A-Z0-9-]{3,20}$/;

/**
 * تتبع الطلب بـ POST: الموبايل لا يظهر في الرابط أبدًا.
 * عند التطابق نمنح cookie الطلب ونعيد التوجيه لصفحة التتبع بالكود فقط.
 */
export async function trackOrderAction(subdomain: string, formData: FormData): Promise<void> {
  const h = await headers();
  const sub = String(subdomain ?? "").toLowerCase();
  const path = (h.get("x-pathname") ?? "").toLowerCase();
  const internal = path === `/s/${sub}` || path.startsWith(`/s/${sub}/`);
  const base = internal ? `/s/${sub}` : "";

  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 20);
  const phone = String(formData.get("phone") ?? "").slice(0, 30);
  const back = (e?: "notfound" | "limited") =>
    redirect(`${base}/track?code=${encodeURIComponent(code)}${e ? `&e=${e}` : ""}`);

  if (!CODE_RE.test(code) || !phone.trim()) return back("notfound");
  if (!(await allow("track", clientIp(h)))) return back("limited");

  const store = await getStoreBySubdomain(sub);
  if (!store) return back("notfound");

  const o = await getOrderByCodeAndPhone(store.id, code, phone);
  if (!o) return back("notfound");

  await grantOrderAccess(store.id, o.code);
  return back();
}
