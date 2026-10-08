// provider-check.ts — اختبار حي لمفاتيحك قبل حفظها، برسائل واضحة بالعربية.
import "server-only";
import { UTApi } from "uploadthing/server";

export type CheckResult = { ok: true; detail?: string } | { ok: false; error: string };

/** مفتاح UploadThing (UPLOADTHING_TOKEN) نص base64 يحوي apiKey وappId. */
export function decodeUploadThingToken(raw: string): { apiKey: string; appId: string } | null {
  try {
    const j = JSON.parse(Buffer.from(raw.trim().replace(/^['"]|['"]$/g, ""), "base64").toString("utf8")) as { apiKey?: string; appId?: string };
    return j.apiKey?.startsWith("sk_") && j.appId ? { apiKey: j.apiKey, appId: j.appId } : null;
  } catch {
    return null;
  }
}

export async function checkUploadThing(token: string): Promise<CheckResult> {
  if (!decodeUploadThingToken(token))
    return { ok: false, error: "هذا ليس مفتاح UploadThing الصحيح. انسخ قيمة UPLOADTHING_TOKEN من صفحة API Keys كاملة." };
  try {
    await new UTApi({ token: token.trim() }).listFiles({ limit: 1 });
    return { ok: true };
  } catch {
    return { ok: false, error: "UploadThing رفض المفتاح. تأكد أنه من نفس التطبيق ولم يُحذف." };
  }
}

export async function checkGroq(key: string): Promise<CheckResult> {
  if (!/^gsk_[A-Za-z0-9]{20,}$/.test(key.trim())) return { ok: false, error: "مفتاح Groq يبدأ بـ gsk_. انسخه كاملاً من console.groq.com/keys." };
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key.trim()}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (r.status === 401) return { ok: false, error: "Groq رفض المفتاح (غير صحيح أو محذوف)." };
    if (!r.ok) return { ok: false, error: "تعذّر الاتصال بـ Groq الآن، أعد المحاولة بعد دقيقة." };
    return { ok: true };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بـ Groq الآن، أعد المحاولة بعد دقيقة." };
  }
}

export async function checkResend(key: string): Promise<CheckResult> {
  if (!/^re_[A-Za-z0-9_]{10,}$/.test(key.trim())) return { ok: false, error: "مفتاح Resend يبدأ بـ re_." };
  try {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key.trim()}` }, signal: AbortSignal.timeout(10_000) });
    return r.status === 401 || r.status === 403 ? { ok: false, error: "Resend رفض المفتاح." } : { ok: true };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بـ Resend الآن." };
  }
}
