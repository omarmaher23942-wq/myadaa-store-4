"use server";
// إعدادات الفاتورة (مقاس الورق، الأسعار، الشعار، رمز QR، اللون، الملاحظة) تُحفظ في الـ Blueprint.
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeBlueprints } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { blueprintSchema, invoiceSchema } from "@/blueprint/schema";
import { saveBlueprintAction } from "./blueprint";

export async function saveInvoiceSettingsAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const parsed = invoiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "إعدادات غير صالحة" };
  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const r = await saveBlueprintAction({ ...cur.data, invoice: parsed.data }, "تعديل إعدادات الفاتورة");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
