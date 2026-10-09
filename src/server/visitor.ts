import "server-only";
// visitor.ts — هوية الزائر في تحليلات المتجر.
//
// الزيارة تُحسب لكل جهاز مرة واحدة في اليوم مهما حدّث الصفحة أو خرج ودخل. الجهاز يُعرف بكوكي من الخادم
// (httpOnly، سنة كاملة) لا بقيمة يرسلها المتصفح، فلا يمكن تضخيم الأرقام من الـ JavaScript. وإن مُنعت الكوكيز
// نستخدم بصمة ثابتة من عنوان الشبكة ونوع المتصفح (مُجزّأة، لا نخزن العنوان نفسه).
import { createHash } from "node:crypto";
import { clientIp } from "@/lib/ratelimit";

export const VISITOR_COOKIE = "clp_v";
const VISITOR_ID = /^d-[0-9a-f]{32}$/;

// برامج الفحص والمعاينات (واتساب وفيسبوك ومحركات البحث والمتصفحات الآلية) لا تُحسب زيارات.
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|monitor|python|curl|wget|axios|node-fetch|go-http/i;

export function isBot(headers: Headers): boolean {
  const ua = headers.get("user-agent") ?? "";
  return !ua || BOT.test(ua);
}

function readCookie(headers: Headers, name: string): string | null {
  const raw = headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** صاحب المتجر يتصفح متجره: زياراته لا تُحسب (وإلا تضخمت أرقامه وهو يجرّب). */
export function isStoreOwner(headers: Headers): boolean {
  return Boolean(readCookie(headers, "clp_m"));
}

/**
 * معرّف الجهاز الثابت، وكوكي يُرسل إن لم يكن موجوداً. أول زيارة بلا كوكي تأخذ بصمة من الشبكة والمتصفح
 * (فتبقى نفسها مع التحديث حتى لو رفض المتصفح الكوكي)، ثم يحفظها الكوكي فتبقى ثابتة لو تغيّرت الشبكة.
 */
export function visitorOf(headers: Headers, storeId: string): { id: string; setCookie: string | null } {
  const existing = readCookie(headers, VISITOR_COOKIE);
  if (existing && VISITOR_ID.test(existing)) return { id: existing, setCookie: null };
  const fp = createHash("sha256")
    .update(`${storeId}|${clientIp(headers)}|${headers.get("user-agent") ?? ""}|${headers.get("accept-language") ?? ""}`)
    .digest("hex")
    .slice(0, 32);
  const id = `d-${fp}`;
  const secure = (headers.get("x-forwarded-proto") ?? "https") === "https" ? "; Secure" : "";
  return { id, setCookie: `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${400 * 86400}; HttpOnly; SameSite=Lax${secure}` };
}
