// ratelimit.ts — حدود معدل الطلبات في الذاكرة لنسخة المتجر الواحد (نفس الحدود والأسماء).
// نافذة منزلقة تقريبية لكل نسخة خادم؛ قيود قاعدة البيانات تبقى خط الدفاع الأساسي.
type Rule = { max: number; windowMs: number };
const m = (n: number) => n * 60_000;

export const limits = {
  checkout: { max: 5, windowMs: m(10) },
  quote: { max: 40, windowMs: m(1) },
  abandoned: { max: 10, windowMs: m(10) },
  proof: { max: 5, windowMs: m(10) },
  track: { max: 20, windowMs: m(10) },
  login: { max: 10, windowMs: m(15) },
  track_events: { max: 120, windowMs: m(1) },
  review: { max: 5, windowMs: m(10) },
  search: { max: 60, windowMs: m(1) },
  setup: { max: 30, windowMs: m(10) },
} satisfies Record<string, Rule>;

export type LimitName = keyof typeof limits;

const hits = new Map<string, number[]>();

export async function allow(name: LimitName, key: string): Promise<boolean> {
  const rule = limits[name];
  const k = `${name}:${key}`;
  const now = Date.now();
  const recent = (hits.get(k) ?? []).filter((t) => now - t < rule.windowMs);
  if (recent.length >= rule.max) {
    hits.set(k, recent);
    return false;
  }
  recent.push(now);
  hits.set(k, recent);
  if (hits.size > 20_000) hits.delete(hits.keys().next().value as string);
  return true;
}

export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
}
