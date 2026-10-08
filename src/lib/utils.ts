import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { EDITION } from "./edition";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** دالة تأخير زمني بالمللي ثانية */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** عنوان موقع التاجر في نسخته الخاصة (يكشفه Vercel تلقائياً)، أو فارغ فتصبح الروابط نسبية. */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "";
}

/** رابط المتجر العام: https://{sub}.{ROOT}{path} على المنصة، ونطاق التاجر نفسه في نسخته الخاصة. */
export function storeUrl(subdomain: string, path = "") {
  const suffix = !path ? "" : path.startsWith("/") ? path : `/${path}`;
  if (EDITION === "store") return `${siteOrigin()}${suffix || "/"}`;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const proto = root.includes("localhost") ? "http" : "https";
  return `${proto}://${subdomain}.${root}${suffix}`;
}

/** نطاق المتجر للعرض فقط (بلا https://). */
export function storeHost(subdomain: string): string {
  try {
    return new URL(storeUrl(subdomain)).host;
  } catch {
    return typeof window !== "undefined" ? window.location.host : subdomain;
  }
}

/**
 * متوسط بايزي للتقييمات: يثبّت المنتجات قليلة المراجعات نحو prior
 * حتى لا يتصدّر منتج بتقييم 5 من مراجعة واحدة قائمة الأكثر مبيعًا.
 */
export function bayesianScore(
  ratingSum: number,
  ratingCount: number,
  prior = 3.5,
  priorWeight = 10
) {
  const v = Math.max(0, ratingCount);
  const R = v > 0 ? ratingSum / v : prior;
  return (v / (v + priorWeight)) * R + (priorWeight / (v + priorWeight)) * prior;
}