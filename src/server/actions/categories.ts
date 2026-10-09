"use server";

// categories.ts — أقسام المتجر: إضافة وتعديل (الرابط ثابت بعد الإنشاء فلا تنكسر روابط القسم المنشورة)، وإظهار وإخفاء،
// وترتيب (هو ترتيبها في قائمة المتجر وأقسام الرئيسية)، وحذف تبقى بعده منتجات القسم في المتجر بلا قسم.
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { categories } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { slugify } from "@/lib/arabic";
import { invalidateStoreCache } from "@/lib/tenant";
import { CATEGORY_DESCRIPTION_MAX, CATEGORY_NAME_MAX } from "@/lib/catalog-limits";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "اكتب اسم القسم").max(CATEGORY_NAME_MAX, `اسم القسم أطول من ${CATEGORY_NAME_MAX} حرفاً`),
  description: z.string().trim().max(CATEGORY_DESCRIPTION_MAX, `الوصف أطول من ${CATEGORY_DESCRIPTION_MAX} حرف`).default(""),
  imageUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "رابط صورة غير آمن")
    .nullable()
    .default(null),
  isVisible: z.boolean().default(true),
});

type Fail = { ok: false; error: string; field?: string };

async function done(store: Parameters<typeof invalidateStoreCache>[0]) {
  await invalidateStoreCache(store);
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard/products");
}

export async function saveCategoryAction(raw: unknown): Promise<{ ok: true; id: string } | Fail> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "بيانات غير صالحة", field: issue?.path[0]?.toString() };
  }
  const d = parsed.data;
  const db = await getTenantDb(s.storeId);

  const existing = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(eq(categories.storeId, s.storeId));
  const key = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();
  if (existing.some((c) => c.id !== d.id && key(c.name) === key(d.name))) {
    return { ok: false, error: "يوجد قسم بنفس الاسم", field: "name" };
  }

  const values = { name: d.name, description: d.description || null, imageUrl: d.imageUrl, isVisible: d.isVisible, updatedAt: new Date() };
  try {
    if (d.id) {
      const [row] = await db
        .update(categories)
        .set(values)
        .where(and(eq(categories.id, d.id), eq(categories.storeId, s.storeId)))
        .returning({ id: categories.id });
      if (!row) return { ok: false, error: "القسم غير موجود (ربما حُذف)" };
      await done(s.store);
      return { ok: true, id: row.id };
    }
    const used = new Set(existing.map((c) => c.slug));
    const base = slugify(d.name) || "section";
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    const [row] = await db
      .insert(categories)
      .values({
        ...values,
        storeId: s.storeId,
        slug,
        sortOrder: sql<number>`(select coalesce(max(sort_order), -1) + 1 from categories where store_id = ${s.storeId})`,
      })
      .returning({ id: categories.id });
    await done(s.store);
    return { ok: true, id: row!.id };
  } catch (e) {
    console.error("[saveCategoryAction]", e);
    return { ok: false, error: "تعذر حفظ القسم، حاول مرة أخرى" };
  }
}

export async function setCategoryVisibilityAction(id: string, isVisible: boolean): Promise<{ ok: true } | Fail> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "القسم غير موجود" };
  const db = await getTenantDb(s.storeId);
  await db
    .update(categories)
    .set({ isVisible: Boolean(isVisible), updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.storeId, s.storeId)));
  await done(s.store);
  return { ok: true };
}

/** يحفظ الترتيب كما رتّبه التاجر: ids بالترتيب الجديد (كل أقسام المتجر). */
export async function reorderCategoriesAction(ids: string[]): Promise<{ ok: true } | Fail> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = z.array(z.string().uuid()).max(500).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { ok: false, error: "ترتيب غير صالح" };
  if (!parsed.data.length) return { ok: true };
  const db = await getTenantDb(s.storeId);
  // case واحدة لكل الأقسام في استعلام واحد، ومحصورة في أقسام هذا المتجر.
  const cases = sql.join(
    parsed.data.map((id, i) => sql`when ${id}::uuid then ${i}`),
    sql` `
  );
  await db
    .update(categories)
    .set({ sortOrder: sql`case ${categories.id} ${cases} else ${categories.sortOrder} end`, updatedAt: new Date() })
    .where(and(eq(categories.storeId, s.storeId), inArray(categories.id, parsed.data)));
  await done(s.store);
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<{ ok: true } | Fail> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "القسم غير موجود" };
  const db = await getTenantDb(s.storeId);
  // منتجات القسم تبقى في المتجر بلا قسم (المفتاح الأجنبي ON DELETE SET NULL).
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.storeId, s.storeId)));
  await done(s.store);
  return { ok: true };
}
