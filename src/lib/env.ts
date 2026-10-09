// env.ts — متغيرات بيئة متجرك. المطلوب واحد فقط: رابط قاعدة البيانات، ويضيفه Vercel تلقائياً
// عند ربط قاعدة Neon من تبويب Storage. مفاتيح UploadThing وGroq وResend تُحفظ في قاعدتك من
// لوحة التحكم (الربط والمفاتيح)، أو في متغيرات البيئة إن فضّلت.

import { createHash } from "node:crypto";

const isPostgres = (v: string | undefined): v is string => typeof v === "string" && /^postgres(ql)?:\/\//i.test(v.trim());

/**
 * رابط القاعدة بأي اسم يضيفه Vercel أو Neon. نافذة الربط في Vercel تطلب «Custom Prefix» (افتراضياً STORAGE)،
 * فتصبح الأسماء مثل STORAGE_URL أو STORAGE_DATABASE_URL أو MYDB_POSTGRES_URL. لذلك نجرّب الأسماء المعروفة أولاً،
 * ثم أي متغير قيمته رابط Postgres، مفضّلين الرابط المجمّع (pooled) على غير المجمّع.
 */
export function resolveDatabaseUrl(source: Record<string, string | undefined> = process.env): string {
  for (const k of ["DATABASE_URL", "POSTGRES_URL", "STORAGE_URL", "STORAGE_DATABASE_URL", "STORAGE_POSTGRES_URL", "POSTGRES_PRISMA_URL"]) {
    if (isPostgres(source[k])) return source[k]!.trim();
  }
  const keys = Object.keys(source)
    .filter((k) => isPostgres(source[k]))
    .sort((a, b) => Number(/UNPOOLED|NON_POOLING|DIRECT/i.test(a)) - Number(/UNPOOLED|NON_POOLING|DIRECT/i.test(b)) || a.localeCompare(b));
  return keys.length ? source[keys[0]!]!.trim() : "";
}

export const DATABASE_URL = resolveDatabaseUrl();

function host(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "localhost:3000";
}

/**
 * سر توقيع الكوكيز (صلاحية صفحة الطلب للعميل وغيرها). لا يحتاج متجرك لكتابته: يُشتق ثابتاً من رابط قاعدتك
 * (وهو سري أصلاً)، فيبقى واحداً في كل نسخ الخادم. ويمكن تحديده صراحة بـ AUTH_SECRET إن أردت.
 */
function authSecret(): string {
  const explicit = process.env.AUTH_SECRET?.trim();
  if (explicit && explicit.length >= 32) return explicit;
  return createHash("sha256").update(`colapia-store-auth:${DATABASE_URL || "local-dev"}`).digest("base64url");
}

const HOST = host();
const ORIGIN = `${HOST.startsWith("localhost") ? "http" : "https"}://${HOST}`;

type Env = {
  NODE_ENV: "development" | "test" | "production";
  DATABASE_URL: string;
  AUTH_SECRET: string;
  ROOT_DOMAIN: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  GROQ_API_KEY: string;
  UPLOADTHING_TOKEN: string;
  PLATFORM_OWNER_EMAILS: string;
  // بقية متغيرات المنصة غير مستخدمة في متجرك؛ تُقرأ كقيم فارغة إن ظهرت.
  [key: string]: any;
};

export const env: Env = {
  NODE_ENV: (process.env.NODE_ENV as Env["NODE_ENV"]) ?? "production",
  DATABASE_URL,
  AUTH_SECRET: authSecret(),
  ROOT_DOMAIN: HOST,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "",
  GROQ_API_KEY: process.env.GROQ_API_KEY ?? "",
  UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN ?? "",
  PLATFORM_OWNER_EMAILS: "",
};

export const clientEnv = {
  NEXT_PUBLIC_ROOT_DOMAIN: HOST,
  NEXT_PUBLIC_APP_URL: ORIGIN,
};

export function getPlatformOwnerEmails(): string[] {
  return [];
}
