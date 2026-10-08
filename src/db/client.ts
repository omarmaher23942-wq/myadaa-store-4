// client.ts — اتصال قاعدة متجرك (Neon عبر HTTP). يُنشأ عند أول استخدام، فيُبنى المشروع وتفتح
// صفحة الإعداد حتى قبل ربط القاعدة، وتشرح للتاجر كيف يربطها.
import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { DATABASE_URL } from "@/lib/env";
import * as schema from "./schema";

function connect() {
  return drizzle({ client: neon(DATABASE_URL), schema, casing: "snake_case" });
}

export type DB = ReturnType<typeof connect>;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("قاعدة البيانات غير مربوطة بعد. افتح /setup لإكمال الإعداد.");
    this.name = "DatabaseNotConfiguredError";
  }
}

export const isDatabaseConfigured = () => Boolean(DATABASE_URL);

let instance: DB | null = null;

export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    if (!instance) {
      if (!DATABASE_URL) throw new DatabaseNotConfiguredError();
      instance = connect();
    }
    const v = (instance as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(instance) : v;
  },
});
