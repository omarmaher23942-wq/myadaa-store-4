"use server";

// discounts.ts — أكواد الخصم: إضافة وتعديل بنفس شروط الدفع (checkout.ts)، وتشغيل وإيقاف، وحذف.
// التواريخ تصل من المتصفح بصيغة ISO بتوقيت التاجر (لا يفسرها الخادم بتوقيته)، والحد الأقصى لا يقل عما استُخدم فعلاً،
// والكود المستخدم لا يُعاد تسميته (حدّ «مرة لكل عميل» يُحسب بنص الكود في الطلبات).
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { discounts } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { arCount, NOUN } from "@/lib/format";

type Fail = { ok: false; error: string; field?: string };
type Result = { ok: true; id: string } | Fail;

const iso = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "تاريخ غير صالح")
  .nullable()
  .default(null);

const schema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,20}$/, "الكود من 3 إلى 20 حرفاً: حروف إنجليزية وأرقام و - و _ فقط"),
    type: z.enum(["percentage", "fixed", "free_shipping"]),
    /** نسبة (1-100) أو مبلغ بالجنيه. */
    value: z.coerce.number().min(0),
    minSubtotal: z.coerce.number().min(0).max(1_000_000).nullable().default(null),
    maxUses: z.coerce.number().int().min(1, "أقل حد مرة واحدة").max(1_000_000).nullable().default(null),
    perCustomerLimit: z.coerce.number().int().min(1).max(100).nullable().default(null),
    startsAt: iso,
    endsAt: iso,
    isActive: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "percentage" && !(Number.isInteger(d.value) && d.value >= 1 && d.value <= 100))
      ctx.addIssue({ code: "custom", path: ["value"], message: "النسبة عدد صحيح من 1 إلى 100" });
    if (d.type === "fixed" && !(d.value > 0 && d.value <= 1_000_000)) ctx.addIssue({ code: "custom", path: ["value"], message: "اكتب قيمة الخصم بالجنيه" });
    if (d.startsAt && d.endsAt && Date.parse(d.endsAt) <= Date.parse(d.startsAt))
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "تاريخ الانتهاء يجب أن يكون بعد البداية" });
  });

export async function saveDiscountAction(raw: unknown): Promise<Result> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "بيانات غير صالحة", field: issue?.path[0]?.toString() };
  }
  const d = parsed.data;
  const db = await getTenantDb(s.storeId);

  if (d.id) {
    const [cur] = await db
      .select({ code: discounts.code, usedCount: discounts.usedCount })
      .from(discounts)
      .where(and(eq(discounts.id, d.id), eq(discounts.storeId, s.storeId)))
      .limit(1);
    if (!cur) return { ok: false, error: "الكود غير موجود (ربما حُذف)" };
    if (cur.usedCount > 0 && cur.code !== d.code) {
      return { ok: false, field: "code", error: "استُخدم هذا الكود في طلبات، فلا يُغيَّر نصه. أنشئ كوداً جديداً بدلاً منه" };
    }
    if (d.maxUses !== null && d.maxUses < cur.usedCount) {
      return { ok: false, field: "maxUses", error: `استُخدم الكود ${arCount(cur.usedCount, NOUN.times)}، فالحد الأقصى لا يقل عن ذلك` };
    }
  }

  const values = {
    code: d.code,
    type: d.type,
    value: d.type === "fixed" ? Math.round(d.value * 100) : d.type === "percentage" ? Math.round(d.value) : 0,
    minSubtotalPiasters: d.minSubtotal ? Math.round(d.minSubtotal * 100) : null,
    maxUses: d.maxUses,
    perCustomerLimit: d.perCustomerLimit,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
    isActive: d.isActive,
  };

  try {
    let id = d.id;
    if (id) {
      await db.update(discounts).set(values).where(and(eq(discounts.id, id), eq(discounts.storeId, s.storeId)));
    } else {
      const [row] = await db.insert(discounts).values({ ...values, storeId: s.storeId }).returning({ id: discounts.id });
      id = row!.id;
    }
    revalidatePath("/dashboard/discounts");
    return { ok: true, id };
  } catch (e) {
    if (dbErrorInfo(e).code === PG_UNIQUE) return { ok: false, field: "code", error: "عندك كود بنفس الاسم" };
    console.error("[saveDiscountAction]", e);
    return { ok: false, error: "تعذر حفظ الكود، حاول مرة أخرى" };
  }
}

export async function setDiscountActiveAction(id: string, isActive: boolean): Promise<{ ok: true } | Fail> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "الكود غير موجود" };
  const db = await getTenantDb(s.storeId);
  await db.update(discounts).set({ isActive: isActive === true }).where(and(eq(discounts.id, id), eq(discounts.storeId, s.storeId)));
  revalidatePath("/dashboard/discounts");
  return { ok: true };
}

export async function deleteDiscountAction(id: string): Promise<{ ok: true } | Fail> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "الكود غير موجود" };
  const db = await getTenantDb(s.storeId);
  // الطلبات السابقة تحتفظ بنص الكود وقيمة خصمها كما هي.
  await db.delete(discounts).where(and(eq(discounts.id, id), eq(discounts.storeId, s.storeId)));
  revalidatePath("/dashboard/discounts");
  return { ok: true };
}
