// store-local.ts — جدول إعدادات متجرك الخاص (لا يوجد على المنصة).
//
// يحفظ: حساب صاحب المتجر (البريد وتجزئة كلمة المرور وكود الاسترجاع)، ومفاتيحك الخاصة
// (UploadThing وGroq وResend)، وحالة الاستلام الأول من المنصة. القاعدة قاعدتك أنت، والمفاتيح
// لا تُعرض كاملة في الواجهة أبداً.
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
