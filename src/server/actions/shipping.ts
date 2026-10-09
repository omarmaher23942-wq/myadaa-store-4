"use server";

// shipping.ts — إعدادات الشحن من اللوحة: جدول المحافظات (التفعيل، والسعر، ورسوم الدفع عند الاستلام، ومدة التوصيل)
// وطريقة الحساب (حسب المحافظة أو سعر واحد) والشحن المجاني ونص المدة المعتادة. الجدول يُكتب ذرياً، وحقول الشحن تُدمج
// في الـ Blueprint الحالي فقط (لا يُكتب فوق تعديل حدث في صفحة أخرى)، ومعها شريط «باقي X للشحن المجاني».
// نفس منطق الدفع: checkout.ts (computeShipping).
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { shippingZones, storeBlueprints } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { blueprintSchema } from "@/blueprint/schema";
import { invalidateStoreCache } from "@/lib/tenant";
import { GOVERNORATES } from "@/lib/egypt";
import { saveBlueprintAction } from "./blueprint";

const GOV_CODES = new Set<string>(GOVERNORATES.map((g) => g.code));
const piasters = (egp: number) => Math.round(egp * 100);

const zone = z
  .object({
    governorate: z.string().refine((g) => GOV_CODES.has(g), "محافظة غير معروفة"),
    fee: z.coerce.number().min(0, "سعر الشحن لا يقل عن صفر").max(10_000),
    codExtra: z.coerce.number().min(0).max(10_000),
    etaMin: z.coerce.number().int().min(0).max(60),
    etaMax: z.coerce.number().int().min(0).max(60),
    isActive: z.boolean(),
  })
  .refine((r) => r.etaMax >= r.etaMin, { message: "أقصى مدة توصيل أقل من أدناها", path: ["etaMax"] });

const input = z.object({
  zones: z
    .array(zone)
    .length(GOV_CODES.size)
    .refine((rows) => new Set(rows.map((r) => r.governorate)).size === rows.length, "محافظة مكررة")
    .refine((rows) => rows.some((r) => r.isActive), "فعّل الشحن لمحافظة واحدة على الأقل"),
  mode: z.enum(["zones", "flat"]),
  flatRate: z.coerce.number().min(0).max(10_000).nullable(),
  freeOver: z.coerce.number().min(1, "حد الشحن المجاني أكبر من صفر").max(1_000_000).nullable(),
  generalEta: z.string().trim().min(3, "اكتب مدة التوصيل المعتادة").max(80),
});

export type ShippingSettingsInput = z.input<typeof input>;

export async function saveShippingSettingsAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string; governorate?: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const row = issue?.path[0] === "zones" && typeof issue.path[1] === "number" ? (raw as { zones?: { governorate?: string }[] }).zones?.[issue.path[1]]?.governorate : undefined;
    return { ok: false, error: issue?.message ?? "بيانات غير صالحة", governorate: row };
  }
  const v = parsed.data;
  if (v.mode === "flat" && v.flatRate === null) return { ok: false, error: "اكتب سعر الشحن الموحد" };

  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };

  const tdb = await getTenantDb(s.storeId);
  const rows = v.zones.map((r) => ({
    storeId: s.storeId,
    governorate: r.governorate,
    feePiasters: piasters(r.fee),
    codExtraPiasters: piasters(r.codExtra),
    etaMinDays: r.etaMin,
    etaMaxDays: r.etaMax,
    isActive: r.isActive,
  }));
  try {
    await tdb.batch([tdb.delete(shippingZones).where(eq(shippingZones.storeId, s.storeId)), tdb.insert(shippingZones).values(rows)]);
  } catch (e) {
    console.error("[saveShippingSettingsAction] zones", e);
    return { ok: false, error: "تعذر حفظ جدول الشحن، لم يتغير شيء. حاول مرة أخرى" };
  }

  const freeOverPiasters = v.freeOver ? piasters(v.freeOver) : null;
  const bp = cur.data;
  const r = await saveBlueprintAction(
    {
      ...bp,
      shipping: {
        ...bp.shipping,
        flatRatePiasters: v.mode === "flat" ? piasters(v.flatRate ?? 0) : null,
        freeOverPiasters,
        generalEta: v.generalEta,
      },
      conversion: {
        ...bp.conversion,
        freeShippingBar: {
          ...bp.conversion.freeShippingBar,
          enabled: Boolean(freeOverPiasters),
          thresholdPiasters: freeOverPiasters ?? bp.conversion.freeShippingBar.thresholdPiasters,
        },
      },
    },
    "تعديل الشحن"
  );
  if (!r.ok) return { ok: false, error: "حُفظ جدول المحافظات، لكن تعذر حفظ طريقة الحساب والشحن المجاني. حاول مرة أخرى" };

  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/shipping");
  return { ok: true };
}
