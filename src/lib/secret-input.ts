// secret-input.ts — قراءة أي مفتاح يلصقه صاحب المتجر بأي شكل نسخه به.
//
// لوحات المزوّدين تنسخ المفتاح بأشكال مختلفة: القيمة وحدها، أو «NAME=value»، أو «NAME='value'»،
// أو سطر «export NAME="value"»، أو ملف .env كامل بعدة أسطر، أو «Bearer value». وقد يأتي معه مسافات
// أو أسطر جديدة أو علامات تنصيص ذكية من الموبايل. هذه الدالة تستخرج القيمة الصحيحة في كل الحالات.

export type SecretKind = "uploadthing" | "groq" | "resend";

const NAMES: Record<SecretKind, string[]> = {
  uploadthing: ["UPLOADTHING_TOKEN", "UT_TOKEN"],
  groq: ["GROQ_API_KEY", "GROQ_KEY"],
  resend: ["RESEND_API_KEY", "RESEND_KEY"],
};

/** شكل القيمة الصالحة لكل مزوّد (يُستخدم لاختيار القيمة الصحيحة من نص فيه أكثر من مفتاح). */
const SHAPE: Record<SecretKind, RegExp> = {
  uploadthing: /^[A-Za-z0-9+/=_-]{40,}$/,
  groq: /^gsk_[A-Za-z0-9]{20,}$/,
  resend: /^re_[A-Za-z0-9_]{10,}$/,
};

const QUOTES = /^[\s'"`‘’“”«»]+|[\s'"`‘’“”«»;,]+$/g;

function clean(v: string): string {
  return v
    .replace(/^\s*bearer\s+/i, "")
    .replace(QUOTES, "")
    .replace(/\s+/g, "");
}

/** يعيد القيمة النظيفة للمفتاح، أو النص بعد التنظيف إن لم نتعرف على شكله (فيرفضه الفحص برسالة واضحة). */
export function readSecret(kind: SecretKind, raw: string): string {
  const text = String(raw ?? "").replace(/\r/g, "").trim();
  if (!text) return "";

  // 1) سطر باسم المتغير: NAME=value أو NAME: value أو export NAME="value" (في أي سطر من النص).
  for (const line of text.split("\n")) {
    const m = line.trim().match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*[:=]\s*(.+)$/);
    if (m && NAMES[kind].includes(m[1]!)) return clean(m[2]!);
  }

  // 2) سطر واحد بصيغة NAME=value بأي اسم آخر (مثلاً Prefix مختلف): نأخذ ما بعد = إن طابق الشكل.
  const assigned = [...text.matchAll(/[A-Z][A-Z0-9_]*\s*[:=]\s*(['"`‘’“”]?)([^\s'"`‘’“”]+)\1/g)]
    .map((m) => clean(m[2]!))
    .find((v) => SHAPE[kind].test(v));
  if (assigned) return assigned;

  // 3) القيمة وحدها، أو أول جزء في النص يطابق شكل المفتاح.
  const whole = clean(text);
  if (SHAPE[kind].test(whole)) return whole;
  const token = text
    .split(/[\s'"`=:;,]+/)
    .map(clean)
    .find((v) => SHAPE[kind].test(v));
  return token ?? whole;
}
