// provider-check.ts — اختبار حي لمفاتيحك قبل حفظها، برسائل واضحة بالعربية.
import "server-only";
import { UTApi } from "uploadthing/server";
import { readSecret } from "@/lib/secret-input";

/** عند النجاح تعود القيمة النظيفة للمفتاح (بعد إزالة اسم المتغير والتنصيص والمسافات) لتُحفظ هي. */
export type CheckResult = { ok: true; value: string; detail?: string } | { ok: false; error: string };

/** مفتاح UploadThing (UPLOADTHING_TOKEN) نص base64 يحوي apiKey وappId. */
export function decodeUploadThingToken(raw: string): { apiKey: string; appId: string } | null {
  try {
    const j = JSON.parse(Buffer.from(readSecret("uploadthing", raw), "base64").toString("utf8")) as { apiKey?: string; appId?: string };
    return j.apiKey?.startsWith("sk_") && j.appId ? { apiKey: j.apiKey, appId: j.appId } : null;
  } catch {
    return null;
  }
}

export async function checkUploadThing(raw: string): Promise<CheckResult> {
  const token = readSecret("uploadthing", raw);
  if (/^sk_(live|test)_/.test(token))
    return { ok: false, error: "هذا هو الـ Secret Key القديم. نحتاج قيمة UPLOADTHING_TOKEN (نص طويل يبدأ غالباً بـ eyJ) من نفس صفحة API Keys." };
  if (!decodeUploadThingToken(token))
    return { ok: false, error: "لم نتعرف على مفتاح UploadThing. من صفحة API Keys انسخ خانة UPLOADTHING_TOKEN كما هي (بالاسم أو بدونه) والصقها هنا." };
  try {
    await new UTApi({ token }).listFiles({ limit: 1 });
    return { ok: true, value: token };
  } catch {
    return { ok: false, error: "UploadThing رفض المفتاح. تأكد أنه من نفس التطبيق ولم يُحذف." };
  }
}

export async function checkGroq(raw: string): Promise<CheckResult> {
  const key = readSecret("groq", raw);
  if (!/^gsk_[A-Za-z0-9]{20,}$/.test(key)) return { ok: false, error: "مفتاح Groq يبدأ بـ gsk_. انسخه كاملاً من console.groq.com/keys." };
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (r.status === 401) return { ok: false, error: "Groq رفض المفتاح (غير صحيح أو محذوف)." };
    if (!r.ok) return { ok: false, error: "تعذّر الاتصال بـ Groq الآن، أعد المحاولة بعد دقيقة." };
    return { ok: true, value: key };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بـ Groq الآن، أعد المحاولة بعد دقيقة." };
  }
}

export async function checkResend(raw: string): Promise<CheckResult> {
  const key = readSecret("resend", raw);
  if (!/^re_[A-Za-z0-9_]{10,}$/.test(key)) return { ok: false, error: "مفتاح Resend يبدأ بـ re_." };
  try {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    return r.status === 401 || r.status === 403 ? { ok: false, error: "Resend رفض المفتاح." } : { ok: true, value: key };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بـ Resend الآن." };
  }
}
