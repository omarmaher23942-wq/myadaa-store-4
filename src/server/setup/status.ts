// status.ts — أين وصل إعداد متجرك؟ (قاعدة مربوطة → جداول جاهزة → متجر مستلَم → صاحب المتجر).
import "server-only";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { DATABASE_URL } from "@/lib/env";
import { getSetting, type SetupState } from "@/server/settings";

export type SetupStatus =
  | { phase: "no_database" }
  | { phase: "database_error"; message: string }
  | { phase: "needs_schema" }
  | { phase: "needs_import"; importing: boolean }
  | { phase: "done"; setup: SetupState };

async function tableExists(name: string): Promise<boolean> {
  const sql = neon(DATABASE_URL);
  const rows = (await sql`select to_regclass(${`public.${name}`}) as t`) as { t: string | null }[];
  return Boolean(rows[0]?.t);
}

export async function setupStatus(): Promise<SetupStatus> {
  if (!DATABASE_URL) return { phase: "no_database" };
  try {
    if (!(await tableExists("store_settings"))) return { phase: "needs_schema" };
    const setup = await getSetting<SetupState>("setup");
    if (setup) return { phase: "done", setup };
    return { phase: "needs_import", importing: Boolean(await getSetting("import")) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { phase: "database_error", message: /password|auth/i.test(msg) ? "رابط قاعدة البيانات غير صحيح أو كلمة مرورها تغيّرت." : "تعذّر الاتصال بقاعدة البيانات الآن." };
  }
}

/** ينشئ جداول متجرك (آمن للتكرار: الجداول الموجودة لا تُمس). */
export async function ensureSchema(): Promise<void> {
  if (!DATABASE_URL) throw new Error("no database");
  await migrate(drizzle({ client: neon(DATABASE_URL) }), { migrationsFolder: join(process.cwd(), "drizzle") });
}
