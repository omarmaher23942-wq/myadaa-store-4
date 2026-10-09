"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
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
  name: z.string().trim().min(1, "اسم المنتج مطلوب").max(120),
  categoryId: z.string().uuid().nullable().optional(),
  shortDescription: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
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
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
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

export async function duplicateProductAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const db = await getTenantDb(s.storeId);

  try {
    const [p] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.storeId, s.storeId)))
      .limit(1);

    if (!p) return { ok: false, error: "المنتج غير موجود" };

    const newName = `${p.name} (نسخة)`;
    const newSlug = await uniqueSlug(s.storeId, newName);

    const [newP] = await db
      .insert(products)
      .values({
        storeId: s.storeId,
        categoryId: p.categoryId,
        name: newName,
        slug: newSlug,
        shortDescription: p.shortDescription,
        description: p.description,
        pricePiasters: p.pricePiasters || 0,
        compareAtPiasters: p.compareAtPiasters,
        costPiasters: p.costPiasters,
        sku: p.sku ? `${p.sku}-copy` : null,
        stock: p.stock ?? 20,
        trackStock: p.trackStock ?? true,
        images: Array.isArray(p.images) ? p.images : [],
        attributes: Array.isArray(p.attributes) ? p.attributes : [],
        optionNames: Array.isArray(p.optionNames) ? p.optionNames : [],
        tags: Array.isArray(p.tags) ? p.tags : [],
        badges: Array.isArray(p.badges) ? p.badges : [],
        status: "draft",
        isFeatured: false,
        sortOrder: (p.sortOrder || 0) + 1,
        searchText: buildSearchText([newName, p.shortDescription, p.description]),
      })
      .returning({ id: products.id });

    if (newP) {
      const existingVariants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, id));

      if (existingVariants.length) {
        await db.insert(productVariants).values(
          existingVariants.map((v) => ({
            storeId: s.storeId,
            productId: newP.id,
            optionValues: Array.isArray(v.optionValues) ? v.optionValues : [],
            pricePiasters: v.pricePiasters,
            compareAtPiasters: v.compareAtPiasters,
            stock: v.stock,
            sku: v.sku ? `${v.sku}-copy` : null,
            imageUrl: v.imageUrl,
            imageUrls: Array.isArray(v.imageUrls) ? v.imageUrls : [],
            isAvailable: v.isAvailable ?? true,
          }))
        );
      }
    }

    await invalidateStoreCache(s.store);
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch (e: any) {
    console.error("[duplicateProductAction] Error:", e);
    return { ok: false, error: e?.message || "فشل تكرار المنتج" };
  }
}

export async function saveProductAction(raw: unknown) {
  const s = await getMerchantStoreOrNull();
  if (!s) return { error: "غير مصرح" };
  const db = await getTenantDb(s.storeId);

  const parsed = productInput.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" };
  }

  const d = parsed.data;
  if (d.categoryId && !(await categoryBelongsToStore(s.storeId, d.categoryId))) {
    return { error: "القسم غير موجود" };
  }
  const searchText = buildSearchText([
    d.name,
    d.shortDescription,
    d.description,
    ...d.tags,
    ...d.attributes.map((a) => a.value),
  ]);

  const hasVariants = d.variants.length > 0;
  const totalStock = hasVariants
    ? d.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
    : (d.stock ?? 20);

  const values = {
    storeId: s.storeId,
    name: d.name,
    categoryId: d.categoryId ?? null,
    shortDescription: d.shortDescription,
    description: d.description,
    pricePiasters: d.price,
    compareAtPiasters: d.compareAt ?? null,
    costPiasters: d.cost ?? null,
    sku: d.sku,
    trackStock: d.trackStock,
    stock: d.trackStock ? totalStock : null,
    images: d.images,
    attributes: d.attributes,
    optionNames: d.optionNames,
    tags: d.tags,
    badges: d.badges,
    status: d.status,
    isFeatured: d.isFeatured,
    seoTitle: d.seoTitle,
    seoDescription: d.seoDescription,
    searchText,
    updatedAt: new Date(),
  };

  if (d.id) {
    const [owned] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, d.id), eq(products.storeId, s.storeId)))
      .limit(1);
    if (!owned) return { error: "المنتج غير موجود" };
  }

  let productId = d.id;

  if (productId) {
    await db
      .update(products)
      .set({ ...values, slug: await uniqueSlug(s.storeId, d.name, productId) })
      .where(and(eq(products.id, productId), eq(products.storeId, s.storeId)));
  } else {
    const [row] = await db
      .insert(products)
      .values({ ...values, slug: await uniqueSlug(s.storeId, d.name) })
      .returning({ id: products.id });
    productId = row!.id;
  }


  // مزامنة المتغيرات: كل تركيبة موجودة تُحدَّث بمعرّفها (فلا تنكسر سلات العملاء ولا روابط الطلبات القديمة)،
  // والجديدة تُضاف، والمحذوفة تُحذف. الكل في دفعة واحدة ذرية.
  if (productId) {
    const existing = await db
      .select({ id: productVariants.id, optionValues: productVariants.optionValues })
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), eq(productVariants.storeId, s.storeId)));
    const byId = new Set(existing.map((e) => e.id));
    const byKey = new Map(existing.map((e) => [e.optionValues.join("\u0001"), e.id]));
    const rows = d.variants.map((v) => ({
      id: v.id && byId.has(v.id) ? v.id : byKey.get(v.optionValues.join("\u0001")),
      values: {
        storeId: s.storeId,
        productId: productId!,
        optionValues: v.optionValues,
        pricePiasters: v.price ?? d.price,
        compareAtPiasters: v.compareAt ?? d.compareAt ?? null,
        stock: v.stock ?? 0,
        sku: v.sku ?? null,
        imageUrl: v.imageUrl ?? null,
        imageUrls: v.imageUrls,
        isAvailable: v.isAvailable,
      },
    }));
    const keep = new Set(rows.map((r) => r.id).filter((x): x is string => Boolean(x)));
    const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    const ops = [
      ...(removed.length ? [db.delete(productVariants).where(and(eq(productVariants.storeId, s.storeId), inArray(productVariants.id, removed)))] : []),
      ...rows
        .filter((r) => r.id)
        .map((r) => db.update(productVariants).set(r.values).where(and(eq(productVariants.id, r.id!), eq(productVariants.storeId, s.storeId)))),
      ...(rows.some((r) => !r.id) ? [db.insert(productVariants).values(rows.filter((r) => !r.id).map((r) => r.values))] : []),
    ];
    if (ops.length) await db.batch(ops as never);
  }

  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/products");
  revalidatePath("/admin");
  return { id: productId };
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
  } catch (e: any) {
    return { ok: false, error: e?.message || "فشل حذف المنتج" };
  }
}

export type BulkUpdateProductsOp =
  | { action: "delete" }
  | { action: "pricePercent"; percent: number }
  | { action: "status"; status: "active" | "draft" | "hidden" };

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
  if (op.action === "pricePercent" && !(op.percent >= -90 && op.percent <= 500)) {
    return { ok: false, error: "نسبة غير منطقية" };
  }

  try {
    const w = and(eq(products.storeId, s.storeId), inArray(products.id, parsedIds.data));

    if (op.action === "delete") {
      await db
        .update(products)
        .set({ deletedAt: new Date(), status: "archived" })
        .where(w);
    } else if (op.action === "pricePercent") {
      await db
        .update(products)
        .set({
          pricePiasters: sql`round(${products.pricePiasters} * ${1 + op.percent / 100})`,
          updatedAt: new Date(),
        })
        .where(w);
    } else if (op.action === "status") {
      await db
        .update(products)
        .set({ status: op.status, updatedAt: new Date() })
        .where(w);
    }

    await invalidateStoreCache(s.store);
    revalidatePath("/dashboard/products");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "فشل التحديث الجماعي" };
  }
}

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "اسم القسم مطلوب").max(80),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isVisible: z.boolean().optional(),
});

export async function saveCategoryAction(input: unknown) {
  const s = await getMerchantStoreOrNull();
  if (!s) return { error: "غير مصرح" };
  const db = await getTenantDb(s.storeId);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const d = parsed.data;
  const slug = slugify(d.name);

  try {
    if (d.id) {
      await db
        .update(categories)
        .set({
          name: d.name,
          slug,
          description: d.description,
          imageUrl: d.imageUrl || null,
          isVisible: d.isVisible ?? true,
          updatedAt: new Date(),
        })
        .where(and(eq(categories.id, d.id), eq(categories.storeId, s.storeId)));
    } else {
      await db.insert(categories).values({
        storeId: s.storeId,
        name: d.name,
        slug,
        description: d.description,
        imageUrl: d.imageUrl || null,
        sortOrder: sql<number>`(select coalesce(max(sort_order),0)+1 from categories where store_id = ${s.storeId})`,
      });
    }
  } catch {
    return { error: "يوجد قسم آخر بنفس الاسم" };
  }

  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/categories");
  return {};
}

export async function deleteCategoryAction(id: string) {
  const s = await getMerchantStoreOrNull();
  if (!s || !z.string().uuid().safeParse(id).success) return;
  const db = await getTenantDb(s.storeId);
  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.storeId, s.storeId)));
  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/categories");
}