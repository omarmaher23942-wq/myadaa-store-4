"use server";

// product-import.ts — استيراد المنتجات من CSV بعد معاينة التاجر: يُعاد التحقق من كل صف على الخادم بنفس قواعد المعاينة،
// وتُربط الأقسام بأسمائها (ويُنشأ الجديد منها)، وتُولَّد روابط فريدة دون استعلام لكل منتج، ويُكتب الكل في معاملة واحدة.
import { revalidatePath } from "next/cache";
import { UTFile } from "uploadthing/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { categories, products } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { buildSearchText, normalizeArabic, slugify } from "@/lib/arabic";
import { invalidateStoreCache } from "@/lib/tenant";
import { parseCsv } from "@/lib/csv-parse";
import { IMPORT_MAX_ROWS, planImport } from "@/lib/product-import";
import { isHostedImage } from "@/lib/media-hosts";
import { mediaApi } from "@/server/media-host";
import { fetchRemoteImage, REMOTE_IMAGE_ERROR } from "@/server/remote-image";
import { externalImagesSql, noDescriptionSql } from "@/server/repos/products-list";

const input = z.object({
  csv: z.string().min(1).max(2_000_000),
  publish: z.boolean(),
});

export type ImportResult =
  | {
      ok: true;
      created: number;
      skipped: number;
      newCategories: number;
      /** منتجات صورها على مضيف خارجي: تُنقل لمساحة المتجر بعد الاستيراد (rehostProductImagesAction). */
      rehost: { id: string; name: string }[];
    }
  | { ok: false; error: string };

export async function importProductsAction(raw: unknown): Promise<ImportResult> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "الملف فارغ أو أكبر من المسموح" };

  const plan = planImport(parseCsv(parsed.data.csv));
  if (plan.missingColumns.length) return { ok: false, error: "الملف ينقصه عمود الاسم أو السعر" };
  if (plan.tooMany) return { ok: false, error: `الحد ${IMPORT_MAX_ROWS} منتج في الملف الواحد؛ قسّمه إلى ملفات أصغر` };
  const good = plan.rows.filter((r) => r.errors.length === 0);
  if (!good.length) return { ok: false, error: "لا يوجد صف صالح للاستيراد" };

  const db = await getTenantDb(s.storeId);
  const [existingSlugs, existingCats] = await Promise.all([
    db.select({ slug: products.slug }).from(products).where(eq(products.storeId, s.storeId)),
    db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).where(eq(categories.storeId, s.storeId)),
  ]);

  // الأقسام: مطابقة الاسم بعد التطبيع، وإنشاء ما لا يوجد.
  const catKey = (n: string) => normalizeArabic(n);
  const catByKey = new Map(existingCats.map((c) => [catKey(c.name), c.id]));
  const usedCatSlugs = new Set(existingCats.map((c) => c.slug));
  const newCats = [...new Map(good.filter((r) => r.category && !catByKey.has(catKey(r.category))).map((r) => [catKey(r.category!), r.category!])).values()];
  const catRows = newCats.map((name, i) => {
    let slug = slugify(name) || `section-${i + 1}`;
    for (let n = 2; usedCatSlugs.has(slug); n++) slug = `${slugify(name) || "section"}-${n}`;
    usedCatSlugs.add(slug);
    const id = crypto.randomUUID();
    catByKey.set(catKey(name), id);
    return { id, storeId: s.storeId, name, slug, sortOrder: existingCats.length + i };
  });

  const used = new Set(existingSlugs.map((x) => x.slug));
  const uniq = (name: string) => {
    const base = slugify(name) || "item";
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  };

  const values = good.map((r) => ({
    id: crypto.randomUUID(),
    storeId: s.storeId,
    name: r.name,
    slug: uniq(r.name),
    categoryId: r.category ? (catByKey.get(catKey(r.category)) ?? null) : null,
    description: r.description,
    shortDescription: r.description ? r.description.split(/[.\n؟!]/)[0]!.slice(0, 160) : null,
    pricePiasters: r.pricePiasters,
    compareAtPiasters: r.compareAtPiasters,
    costPiasters: r.costPiasters,
    sku: r.sku,
    trackStock: r.stock !== null,
    stock: r.stock,
    images: r.images.map((url) => ({ url, alt: r.name })),
    status: parsed.data.publish ? ("active" as const) : ("draft" as const),
    searchText: buildSearchText([r.name, r.description, r.category, r.sku]),
  }));

  // الأقسام الجديدة ثم المنتجات بدفعات من 100، كلها في معاملة واحدة: إما يُستورد الملف كله أو لا شيء.
  const chunks: (typeof values)[] = [];
  for (let i = 0; i < values.length; i += 100) chunks.push(values.slice(i, i + 100));
  try {
    await db.batch([...(catRows.length ? [db.insert(categories).values(catRows)] : []), ...chunks.map((c) => db.insert(products).values(c))] as never);
  } catch (e) {
    console.error("[importProductsAction]", e);
    return { ok: false, error: "تعذر حفظ المنتجات. لم يُستورد شيء؛ حاول مرة أخرى" };
  }

  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/products");
  return {
    ok: true,
    created: values.length,
    skipped: plan.rows.length - good.length,
    newCategories: newCats.length,
    rehost: values.filter((v) => v.images.some((i) => !isHostedImage(i.url))).map((v) => ({ id: v.id, name: v.name })),
  };
}

export type RehostResult =
  | { ok: true; moved: number; removed: { url: string; reason: string }[]; kept: number }
  | { ok: false; error: string; code?: "no_media" | "upload_down" };

// أخطاء نهائية: الصورة نفسها لا تصلح (تُحذف من المنتج ويُذكر السبب). أما تعذر الوصول المؤقت أو فشل الرفع فتبقى الصورة
// برابطها ليُعاد نقلها لاحقاً من تنبيه صفحة المنتجات.
const FINAL_ERRORS = new Set(["invalid_url", "blocked_host", "not_found", "too_large", "not_image"]);

/**
 * ينقل صور منتج واحد من روابطها الخارجية إلى مساحة رفع المتجر (المتصفح يمر على المنتجات واحداً واحداً بتقدم ظاهر)،
 * لأن سياسة أمان المتجر لا تعرض صوراً من مضيف آخر.
 */
export async function rehostProductImagesAction(raw: unknown): Promise<RehostResult> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = z.object({ id: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "منتج غير صالح" };
  const db = await getTenantDb(s.storeId);
  const own = and(eq(products.id, parsed.data.id), eq(products.storeId, s.storeId), isNull(products.deletedAt));
  const [p] = await db.select({ images: products.images }).from(products).where(own).limit(1);
  const none = { ok: true as const, moved: 0, removed: [], kept: 0 };
  if (!p) return none;
  const external = [...new Set(p.images.map((i) => i.url).filter((u) => !isHostedImage(u)))];
  if (!external.length) return none;

  const api = await mediaApi();
  if (!api) return { ok: false, code: "no_media", error: "أضف مفتاح UploadThing من «الربط والمفاتيح» لنقل الصور إلى متجرك" };

  const moved = new Map<string, { url: string; key: string }>();
  const removed: { url: string; reason: string }[] = [];
  let kept = 0;
  let uploadFailures = 0;
  // 3 صور في المرة: أسرع من التتابع، ولا يثقل على المضيف الخارجي.
  for (let i = 0; i < external.length; i += 3) {
    await Promise.all(
      external.slice(i, i + 3).map(async (url, k) => {
        const got = await fetchRemoteImage(url);
        if (!got.ok) {
          if (FINAL_ERRORS.has(got.error)) removed.push({ url, reason: REMOTE_IMAGE_ERROR[got.error] });
          else kept++;
          return;
        }
        const up = await api
          .uploadFiles(new UTFile([got.image.bytes], `product-${parsed.data.id.slice(0, 8)}-${i + k + 1}.${got.image.ext}`, { type: got.image.type }))
          .catch(() => null);
        if (up?.data?.ufsUrl) moved.set(url, { url: up.data.ufsUrl, key: up.data.key });
        else {
          if (up?.error) console.error("[rehostProductImagesAction] upload", up.error.code, up.error.message);
          uploadFailures++;
          kept++;
        }
      })
    );
  }
  // كل رفع فشل: المشكلة في مساحة الرفع لا في الصور، فيتوقف النقل كله والصور باقية بروابطها.
  if (uploadFailures > 0 && moved.size === 0) {
    return { ok: false, code: "upload_down", error: "تعذر الرفع إلى مساحة الصور الآن، والصور باقية بروابطها. أعد المحاولة بعد قليل" };
  }

  if (moved.size || removed.length) {
    // تُعاد قراءة الصور قبل الكتابة حتى لا يضيع تعديل حدث أثناء النقل.
    const [now] = await db.select({ images: products.images }).from(products).where(own).limit(1);
    if (now) {
      const drop = new Set(removed.map((f) => f.url));
      const images = now.images.flatMap((img) => {
        const m = moved.get(img.url);
        if (m) return [{ ...img, url: m.url, key: m.key }];
        return drop.has(img.url) ? [] : [img];
      });
      await db.update(products).set({ images, updatedAt: new Date() }).where(own);
      await invalidateStoreCache(s.store);
    }
  }
  return { ok: true, moved: moved.size, removed, kept };
}

/** المنتجات التي ما زالت صورها على روابط خارجية (لتنبيه «انقل الصور» في صفحة المنتجات). */
export async function productsWithExternalImagesAction(): Promise<{ id: string; name: string }[]> {
  const s = await getMerchantStoreOrNull();
  if (!s) return [];
  const db = await getTenantDb(s.storeId);
  const rows = await db
    .select({ id: products.id, name: products.name, images: products.images })
    .from(products)
    .where(and(eq(products.storeId, s.storeId), isNull(products.deletedAt), externalImagesSql))
    .limit(500);
  return rows.filter((r) => r.images.some((i) => !isHostedImage(i.url))).map((r) => ({ id: r.id, name: r.name }));
}

/** المنتجات بلا وصف (لزر «اكتب الأوصاف الناقصة» بالذكاء الاصطناعي). */
export async function productsMissingCopyAction(): Promise<{ id: string; name: string; priceEgp: number; category: string | null }[]> {
  const s = await getMerchantStoreOrNull();
  if (!s) return [];
  const db = await getTenantDb(s.storeId);
  const rows = await db
    .select({ id: products.id, name: products.name, price: products.pricePiasters, category: categories.name })
    .from(products)
    .leftJoin(categories, and(eq(categories.id, products.categoryId), eq(categories.storeId, s.storeId)))
    .where(and(eq(products.storeId, s.storeId), isNull(products.deletedAt), noDescriptionSql))
    .orderBy(desc(products.createdAt))
    .limit(500);
  return rows.map((r) => ({ id: r.id, name: r.name, priceEgp: r.price / 100, category: r.category }));
}
