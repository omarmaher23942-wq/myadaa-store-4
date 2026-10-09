"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, isNull, sql, type AnyColumn } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products, productVariants, categories } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { buildSearchText, slugify } from "@/lib/arabic";
import { invalidateStoreCache } from "@/lib/tenant";

const egp = z.coerce.number().min(0).transform((v) => Math.round(v * 100));

const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  optionValues: z.array(z.string()).default([]),
  price: egp.nullable().optional(),
  compareAt: egp.nullable().optional(),
  stock: z.coerce.number().int().min(0).nullable().optional(),
  sku: z.string().max(40).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(10).default([]),
  isAvailable: z.boolean().default(true),
});

const productInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "اسم المنتج مطلوب").max(120, "اسم المنتج أطول من 120 حرفاً"),
  categoryId: z.string().uuid().nullable().optional(),
  shortDescription: z.string().max(200, "السطر البيعي أطول من 200 حرف").optional(),
  description: z.string().max(5000, "الوصف أطول من 5000 حرف").optional(),
  price: egp,
  compareAt: egp.optional().nullable(),
  cost: egp.optional().nullable(),
  sku: z.string().max(40).optional(),
  trackStock: z.boolean().default(true),
  stock: z.coerce.number().int().min(0).nullable().optional(),
  images: z
    .array(
      z.object({
        url: z.string().url().refine((u) => u.startsWith("https://"), "رابط صورة غير آمن"),
        alt: z.string().max(200).optional(),
        key: z.string().max(200).optional(),
      })
    )
    .max(20)
    .default([]),
  attributes: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  optionNames: z.array(z.string()).default([]),
  variants: z.array(variantInputSchema).default([]),
  tags: z.array(z.string()).default([]),
  badges: z.array(z.string()).default([]),
  status: z.enum(["active", "draft", "hidden"]).default("active"),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().max(70, "عنوان محركات البحث أطول من 70 حرفاً").optional(),
  seoDescription: z.string().max(160, "وصف محركات البحث أطول من 160 حرفاً").optional(),
});

/** القسم يجب أن يخص نفس المتجر؛ أي قسم غريب يُرفض بدل ربط المنتج بمتجر آخر. */
async function categoryBelongsToStore(storeId: string, categoryId: string): Promise<boolean> {
  const db = await getTenantDb(storeId);
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.storeId, storeId)))
    .limit(1);
  return Boolean(c);
}

const idList = z.array(z.string().uuid()).max(500);

async function uniqueSlug(storeId: string, name: string, excludeId?: string) {
  const db = await getTenantDb(storeId);
  const base = slugify(name) || "item";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const [x] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.slug, slug)))
      .limit(1);
    if (!x || x.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function duplicateProductAction(id: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "المنتج غير موجود" };
  const db = await getTenantDb(s.storeId);

  try {
    const [p] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.storeId, s.storeId), isNull(products.deletedAt)))
      .limit(1);
    if (!p) return { ok: false, error: "المنتج غير موجود" };

    const newId = crypto.randomUUID();
    const newName = `${p.name} (نسخة)`.slice(0, 120);
    const variants = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, id), eq(productVariants.storeId, s.storeId)));

    // المنتج وتركيباته في دفعة واحدة: لا نسخة بلا مقاساتها إن فشل جزء.
    await db.batch([
      db.insert(products).values({
        id: newId,
        storeId: s.storeId,
        categoryId: p.categoryId,
        name: newName,
        slug: await uniqueSlug(s.storeId, newName),
        shortDescription: p.shortDescription,
        description: p.description,
        pricePiasters: p.pricePiasters,
        compareAtPiasters: p.compareAtPiasters,
        costPiasters: p.costPiasters,
        sku: p.sku ? `${p.sku}-copy`.slice(0, 40) : null,
        stock: p.stock,
        trackStock: p.trackStock,
        images: p.images,
        attributes: p.attributes,
        optionNames: p.optionNames,
        tags: p.tags,
        badges: p.badges,
        status: "draft",
        isFeatured: false,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        sortOrder: (p.sortOrder || 0) + 1,
        searchText: p.searchText,
      }),
      ...(variants.length
        ? [
            db.insert(productVariants).values(
              variants.map((v) => ({
                storeId: s.storeId,
                productId: newId,
                optionValues: v.optionValues,
                pricePiasters: v.pricePiasters,
                compareAtPiasters: v.compareAtPiasters,
                stock: v.stock,
                sku: v.sku ? `${v.sku}-copy`.slice(0, 40) : null,
                imageUrl: v.imageUrl,
                imageUrls: v.imageUrls,
                isAvailable: v.isAvailable,
              }))
            ),
          ]
        : []),
    ] as never);

    await invalidateStoreCache(s.store);
    revalidatePath("/dashboard/products");
    return { ok: true, id: newId };
  } catch (e) {
    console.error("[duplicateProductAction] Error:", e);
    return { ok: false, error: "تعذر نسخ المنتج، حاول مرة أخرى" };
  }
}

export type SaveProductResult = { ok: true; id: string; slug: string } | { ok: false; error: string; field?: string };

const cleanList = (xs: string[], max: number, len: number) => [...new Set(xs.map((x) => x.trim().slice(0, len)).filter(Boolean))].slice(0, max);

export async function saveProductAction(raw: unknown): Promise<SaveProductResult> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const db = await getTenantDb(s.storeId);

  const parsed = productInput.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message || "بيانات غير صالحة", field: issue?.path[0]?.toString() };
  }

  const d = parsed.data;
  if (d.price <= 0) return { ok: false, error: "اكتب سعر البيع", field: "price" };
  if (d.compareAt && d.compareAt <= d.price) {
    return { ok: false, error: "السعر قبل الخصم يجب أن يكون أعلى من سعر البيع، أو اتركه فارغاً", field: "compareAt" };
  }
  if (d.categoryId && !(await categoryBelongsToStore(s.storeId, d.categoryId))) {
    return { ok: false, error: "القسم غير موجود", field: "categoryId" };
  }

  const hasVariants = d.variants.length > 0;
  if (d.trackStock && !hasVariants && (d.stock === null || d.stock === undefined)) {
    return { ok: false, error: "اكتب الكمية المتاحة، أو أوقف «تتبع المخزون» إن كان المنتج متاحاً دائماً", field: "stock" };
  }
  const totalStock = hasVariants ? d.variants.reduce((sum, v) => sum + (v.isAvailable ? (v.stock ?? 0) : 0), 0) : (d.stock ?? 0);

  const tags = cleanList(d.tags, 20, 40);
  const badges = cleanList(d.badges, 6, 30);
  const attributes = d.attributes
    .map((a) => ({ label: a.label.trim().slice(0, 40), value: a.value.trim().slice(0, 120) }))
    .filter((a) => a.label && a.value)
    .slice(0, 30);
  const images = d.images.map((im) => ({ ...im, alt: im.alt?.trim() || d.name }));

  const values = {
    storeId: s.storeId,
    name: d.name,
    categoryId: d.categoryId ?? null,
    shortDescription: d.shortDescription?.trim() || null,
    description: d.description?.trim() || null,
    pricePiasters: d.price,
    compareAtPiasters: d.compareAt || null,
    costPiasters: d.cost ?? null,
    sku: d.sku?.trim() || null,
    trackStock: d.trackStock,
    stock: d.trackStock ? totalStock : null,
    images,
    attributes,
    optionNames: hasVariants ? d.optionNames : [],
    tags,
    badges,
    status: d.status,
    isFeatured: d.isFeatured,
    seoTitle: d.seoTitle?.trim() || null,
    seoDescription: d.seoDescription?.trim() || null,
    searchText: buildSearchText([d.name, d.shortDescription, d.description, d.sku, ...tags, ...attributes.map((a) => a.value)]),
    updatedAt: new Date(),
  };

  let slug: string;
  const productId = d.id ?? crypto.randomUUID();
  const existing = d.id
    ? await db
        .select({ id: productVariants.id, optionValues: productVariants.optionValues })
        .from(productVariants)
        .where(and(eq(productVariants.productId, d.id), eq(productVariants.storeId, s.storeId)))
    : [];
  if (d.id) {
    const [owned] = await db
      .select({ slug: products.slug })
      .from(products)
      .where(and(eq(products.id, d.id), eq(products.storeId, s.storeId), isNull(products.deletedAt)))
      .limit(1);
    if (!owned) return { ok: false, error: "المنتج غير موجود (ربما حُذف)" };
    slug = owned.slug; // الرابط ثابت بعد الإنشاء: تغيير الاسم لا يكسر روابطه المنشورة على فيسبوك وواتساب ومحركات البحث.
  } else {
    slug = await uniqueSlug(s.storeId, d.name);
  }

  // التركيبات: الموجودة تُحدَّث بمعرّفها (فلا تنكسر سلات العملاء ولا الطلبات القديمة)، والجديدة تُضاف، والمحذوفة تُحذف.
  // سعر التركيبة المساوي لسعر المنتج يُحفظ فارغاً فيرث سعر المنتج: رفع سعر المنتج لاحقاً يصل لكل مقاساته.
  const byId = new Set(existing.map((e) => e.id));
  const byKey = new Map(existing.map((e) => [e.optionValues.join("\u0001"), e.id]));
  const rows = d.variants.map((v) => ({
    id: v.id && byId.has(v.id) ? v.id : byKey.get(v.optionValues.join("\u0001")),
    values: {
      storeId: s.storeId,
      productId,
      optionValues: v.optionValues,
      pricePiasters: v.price && v.price !== d.price ? v.price : null,
      compareAtPiasters: v.compareAt && v.compareAt !== d.compareAt ? v.compareAt : null,
      stock: v.stock ?? 0,
      sku: v.sku?.trim() || null,
      imageUrl: v.imageUrl ?? null,
      imageUrls: v.imageUrls,
      isAvailable: v.isAvailable,
    },
  }));
  const keep = new Set(rows.map((r) => r.id).filter((x): x is string => Boolean(x)));
  const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);

  // المنتج وتركيباته في دفعة واحدة ذرية: لا مخزون منتج يخالف مجموع مقاساته إن فشل جزء.
  const own = and(eq(products.id, productId), eq(products.storeId, s.storeId));
  try {
    await db.batch([
      d.id ? db.update(products).set(values).where(own) : db.insert(products).values({ ...values, id: productId, slug }),
      ...(removed.length ? [db.delete(productVariants).where(and(eq(productVariants.storeId, s.storeId), inArray(productVariants.id, removed)))] : []),
      ...rows
        .filter((r) => r.id)
        .map((r) => db.update(productVariants).set(r.values).where(and(eq(productVariants.id, r.id!), eq(productVariants.storeId, s.storeId)))),
      ...(rows.some((r) => !r.id) ? [db.insert(productVariants).values(rows.filter((r) => !r.id).map((r) => r.values))] : []),
    ] as never);
  } catch (e) {
    console.error("[saveProductAction]", e);
    return { ok: false, error: "تعذر حفظ المنتج، لم يتغير شيء. حاول مرة أخرى" };
  }

  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/products");
  return { ok: true, id: productId, slug };
}

export async function deleteProductAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const db = await getTenantDb(s.storeId);

  try {
    await db
      .update(products)
      .set({ deletedAt: new Date(), status: "archived" })
      .where(and(eq(products.id, id), eq(products.storeId, s.storeId)));
    await invalidateStoreCache(s.store);
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch (e) {
    console.error("[deleteProductAction]", e);
    return { ok: false, error: "تعذر حذف المنتج، حاول مرة أخرى" };
  }
}

export type BulkUpdateProductsOp =
  | { action: "delete" }
  | { action: "pricePercent"; percent: number }
  | { action: "status"; status: "active" | "draft" | "hidden" }
  | { action: "category"; categoryId: string | null };

export async function bulkUpdateProductsAction(
  ids: string[],
  op: BulkUpdateProductsOp
): Promise<{ ok: boolean; error?: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const db = await getTenantDb(s.storeId);
  const parsedIds = idList.safeParse(ids);
  if (!parsedIds.success) return { ok: false, error: "بيانات غير صالحة" };
  if (!parsedIds.data.length) return { ok: true };
  if (op.action === "pricePercent" && !(Number.isFinite(op.percent) && op.percent >= -90 && op.percent <= 500 && op.percent !== 0)) {
    return { ok: false, error: "اكتب نسبة بين -90% و500%" };
  }
  if (op.action === "category" && op.categoryId && !(z.string().uuid().safeParse(op.categoryId).success && (await categoryBelongsToStore(s.storeId, op.categoryId)))) {
    return { ok: false, error: "القسم غير موجود" };
  }

  try {
    const w = and(eq(products.storeId, s.storeId), inArray(products.id, parsedIds.data));

    if (op.action === "delete") {
      await db
        .update(products)
        .set({ deletedAt: new Date(), status: "archived" })
        .where(w);
    } else if (op.action === "pricePercent") {
      // كل الأسعار تتحرك بنفس النسبة: سعر المنتج والسعر قبل الخصم (فتبقى نسبة الخصم المعروضة كما هي) وأسعار التركيبات
      // (وإلا يرى العميل السعر القديم عند اختيار مقاس أو لون). التقريب لأقرب جنيه، ولا ينزل سعر عن جنيه واحد.
      const factor = 1 + op.percent / 100;
      const scale = (col: AnyColumn) => sql`greatest(round(${col} * ${factor}::numeric / 100) * 100, 100)`;
      await db.batch([
        db
          .update(products)
          .set({
            pricePiasters: sql`${scale(products.pricePiasters)}`,
            compareAtPiasters: sql`case when ${products.compareAtPiasters} is null then null else ${scale(products.compareAtPiasters)} end`,
            updatedAt: new Date(),
          })
          .where(w),
        db
          .update(productVariants)
          .set({
            pricePiasters: sql`case when ${productVariants.pricePiasters} is null then null else ${scale(productVariants.pricePiasters)} end`,
            compareAtPiasters: sql`case when ${productVariants.compareAtPiasters} is null then null else ${scale(productVariants.compareAtPiasters)} end`,
          })
          .where(and(eq(productVariants.storeId, s.storeId), inArray(productVariants.productId, parsedIds.data))),
      ]);
    } else if (op.action === "category") {
      await db.update(products).set({ categoryId: op.categoryId, updatedAt: new Date() }).where(w);
    } else if (op.action === "status") {
      await db
        .update(products)
        .set({ status: op.status, updatedAt: new Date() })
        .where(w);
    }

    await invalidateStoreCache(s.store);
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch (e) {
    console.error("[bulkUpdateProductsAction]", e);
    return { ok: false, error: "تعذر تنفيذ العملية على المنتجات المحددة، حاول مرة أخرى" };
  }
}
