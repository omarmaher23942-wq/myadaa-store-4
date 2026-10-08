"use server";

// commerce.ts — إدارة الخصومات والشحن والعملاء من داشبورد التاجر.
// كل إجراء: جلسة تاجر بمتجر يملكه + مدخلات محققة بـ Zod (المفاتيح غير المعروفة تُحذف) + شرط storeId في كل كتابة.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { discounts, shippingZones, customers } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { GOVERNORATES } from "@/lib/egypt";

type Result = { error?: string };

const GOV_CODES = new Set<string>(GOVERNORATES.map((g) => g.code));
const egpToPiasters = (v: number) => Math.round(v * 100);

// ─── الخصومات ───────────────────────────────────────────────────────────────

const discountSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,20}$/, "الكود من 3 إلى 20 حرفاً إنجليزياً أو رقماً"),
    type: z.enum(["percentage", "fixed", "free_shipping"]),
    value: z.coerce.number().min(0),
    minSubtotal: z.coerce.number().min(0).nullable().optional(),
    maxUses: z.coerce.number().int().min(1).nullable().optional(),
    perCustomerLimit: z.coerce.number().int().min(1).nullable().optional(),
    endsAt: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), "تاريخ انتهاء غير صالح")
      .nullable()
      .optional(),
    isActive: z.boolean(),
  })
  .refine((d) => d.type !== "percentage" || (d.value > 0 && d.value <= 100), {
    message: "نسبة الخصم بين 1 و100",
    path: ["value"],
  })
  .refine((d) => d.type !== "fixed" || d.value > 0, {
    message: "قيمة الخصم يجب أن تكون أكبر من صفر",
    path: ["value"],
  });

export async function saveDiscountAction(input: unknown): Promise<Result> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { error: "غير مصرح" };
  const db = await getTenantDb(s.storeId);
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const d = parsed.data;

  const values = {
    code: d.code,
    type: d.type,
    value: d.type === "fixed" ? egpToPiasters(d.value) : Math.round(d.value),
    minSubtotalPiasters: d.minSubtotal ? egpToPiasters(d.minSubtotal) : null,
    maxUses: d.maxUses ?? null,
    perCustomerLimit: d.perCustomerLimit ?? null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
    isActive: d.isActive,
  };

  try {
    if (d.id) {
      await db
        .update(discounts)
        .set(values)
        .where(and(eq(discounts.id, d.id), eq(discounts.storeId, s.storeId)));
    } else {
      await db.insert(discounts).values({ ...values, storeId: s.storeId });
    }
  } catch {
    return { error: "الكود مستخدم بالفعل" };
  }
  revalidatePath("/dashboard/discounts");
  return {};
}

export async function deleteDiscountAction(id: string): Promise<void> {
  const s = await getMerchantStoreOrNull();
  if (!s || !z.string().uuid().safeParse(id).success) return;
  const db = await getTenantDb(s.storeId);
  await db.delete(discounts).where(and(eq(discounts.id, id), eq(discounts.storeId, s.storeId)));
  revalidatePath("/dashboard/discounts");
}

// ─── الشحن ──────────────────────────────────────────────────────────────────

const shippingRowSchema = z
  .object({
    governorate: z.string().refine((g) => GOV_CODES.has(g), "محافظة غير معروفة"),
    fee: z.coerce.number().min(0).max(10_000),
    codExtra: z.coerce.number().min(0).max(10_000),
    etaMin: z.coerce.number().int().min(0).max(60),
    etaMax: z.coerce.number().int().min(0).max(60),
    isActive: z.boolean(),
  })
  .refine((r) => r.etaMax >= r.etaMin, { message: "أقصى مدة توصيل أقل من أدناها" });

const shippingTableSchema = z
  .array(shippingRowSchema)
  .max(GOV_CODES.size)
  .refine((rows) => new Set(rows.map((r) => r.governorate)).size === rows.length, "محافظة مكررة");

/** حفظ جدول الشحن كاملاً دفعة واحدة وذرياً: إما يُحفظ كله أو لا يتغير شيء. */
export async function saveShippingAction(input: unknown): Promise<Result> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { error: "غير مصرح" };
  const db = await getTenantDb(s.storeId);
  const parsed = shippingTableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const rows = parsed.data.map((r) => ({
    storeId: s.storeId,
    governorate: r.governorate,
    feePiasters: egpToPiasters(r.fee),
    codExtraPiasters: egpToPiasters(r.codExtra),
    etaMinDays: r.etaMin,
    etaMaxDays: r.etaMax,
    isActive: r.isActive,
  }));

  const clear = db.delete(shippingZones).where(eq(shippingZones.storeId, s.storeId));
  if (rows.length) await db.batch([clear, db.insert(shippingZones).values(rows)]);
  else await clear;
  revalidatePath("/dashboard/shipping");
  return {};
}

// ─── العملاء ────────────────────────────────────────────────────────────────

const customerPatchSchema = z
  .object({
    notes: z.string().trim().max(1000).optional(),
    isBlocked: z.boolean().optional(),
  });

export async function updateCustomerAction(id: string, patch: unknown): Promise<void> {
  const s = await getMerchantStoreOrNull();
  if (!s || !z.string().uuid().safeParse(id).success) return;
  const db = await getTenantDb(s.storeId);
  const parsed = customerPatchSchema.safeParse(patch);
  if (!parsed.success) return;

  await db
    .update(customers)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.storeId, s.storeId)));
  revalidatePath("/dashboard/customers");
}
