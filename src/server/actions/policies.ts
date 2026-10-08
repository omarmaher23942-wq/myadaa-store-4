"use server";
// تعديل سياسات المتجر من اللوحة: الاستبدال والاسترجاع، والمنتج المعيب، والمعاينة، والشحن المجاني والاستلام.
// تُدمج في الـ Blueprint الحالي (مع حفظ النسخة السابقة)، فتتحدث صفحات السياسات وشارات الثقة فوراً.
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeBlueprints } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { blueprintSchema, returnsSchema } from "@/blueprint/schema";
import { saveBlueprintAction } from "./blueprint";

const input = z.object({
  returns: returnsSchema,
  shipping: z.object({
    inspectionAllowed: z.boolean(),
    freeOverPiasters: z.number().int().min(0).max(100_000_00).nullable(),
    generalEta: z.string().trim().min(3).max(80),
    pickupEnabled: z.boolean(),
    pickupAddress: z.string().trim().max(200).optional(),
  }),
});

export type PoliciesInput = z.input<typeof input>;

export async function savePoliciesAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const v = parsed.data;
  if (v.shipping.pickupEnabled && !v.shipping.pickupAddress) return { ok: false, error: "اكتب عنوان الاستلام من المتجر" };
  if (v.returns.windowDays > 0 && !v.returns.allowExchange && !v.returns.allowRefund) return { ok: false, error: "اختر الاستبدال أو الاسترجاع أو كليهما، أو اجعل المدة «لا يوجد»" };

  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };

  const returns = v.returns.windowDays === 0 ? { ...v.returns, allowExchange: false, allowRefund: false } : v.returns;
  const r = await saveBlueprintAction(
    {
      ...cur.data,
      returns,
      shipping: {
        ...cur.data.shipping,
        inspectionAllowed: v.shipping.inspectionAllowed,
        freeOverPiasters: v.shipping.freeOverPiasters,
        generalEta: v.shipping.generalEta,
        pickupEnabled: v.shipping.pickupEnabled,
        pickupAddress: v.shipping.pickupEnabled ? v.shipping.pickupAddress : undefined,
      },
      conversion: {
        ...cur.data.conversion,
        freeShippingBar: { ...cur.data.conversion.freeShippingBar, enabled: Boolean(v.shipping.freeOverPiasters), thresholdPiasters: v.shipping.freeOverPiasters ?? cur.data.conversion.freeShippingBar.thresholdPiasters },
      },
    },
    "تعديل السياسات والضمان"
  );
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
