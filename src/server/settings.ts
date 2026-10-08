// settings.ts — إعدادات متجرك الخاصة في قاعدتك (جدول store_settings).
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeSettings } from "@/db/schema";

export type SettingKey =
  | "keys.uploadthing"
  | "keys.groq"
  | "keys.resend"
  | "owner.recovery"
  | "setup"
  | "import";

export type SetupState = { completedAt: string; importedFrom: string; stats: Record<string, number> };

export async function getSetting<T>(key: SettingKey): Promise<T | null> {
  const [row] = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
  return (row?.value as T | undefined) ?? null;
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  await db
    .insert(storeSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } });
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  await db.delete(storeSettings).where(eq(storeSettings.key, key));
}

/** مفتاح مزوّد: من الإعدادات (لوحة التحكم) أولاً، ثم من متغيرات البيئة إن وُضع هناك. */
export async function providerKey(name: "uploadthing" | "groq" | "resend"): Promise<string | null> {
  const fromDb = await getSetting<string>(`keys.${name}`).catch(() => null);
  if (fromDb) return fromDb;
  const env = { uploadthing: process.env.UPLOADTHING_TOKEN, groq: process.env.GROQ_API_KEY, resend: process.env.RESEND_API_KEY }[name];
  return env || null;
}

export const maskKey = (k: string | null) => (k ? `••••${k.slice(-4)}` : null);
