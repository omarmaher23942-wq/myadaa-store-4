// C:\Users\ahmed maher\Desktop\colapia\src\app\(platform)\dashboard\products\[id]\page.tsx— تعديل/إنشاء منتج.
//
// التعديلات الجذرية (موجة 3):
//  1) Defensive parsing لكل المصفوفات (images, attributes, tags, badges).
//  2) Verification أن المنتج ينتمي للمتجر.
//  3) Support "new" path.
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { products, productVariants, categories } from "@/db/schema/catalog";
import { ProductForm } from "@/components/dashboard/ProductForm";

export const dynamic = "force-dynamic";

export default async function DashboardProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getMerchantSession();
  if (!session || !session.storeId) redirect("/dashboard");
  const db = await getTenantDb(session.storeId!);

  const store = session.store!;

  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.storeId, store.id));

  if (id === "new") {
    return <ProductForm categories={cats} />;
  }

  const [p] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, id),
        eq(products.storeId, store.id),
        isNull(products.deletedAt)
      )
    )
    .limit(1);

  if (!p) notFound();

  const variants = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, id),
        eq(productVariants.storeId, store.id)
      )
    );

  // Defensive parsing.
  const rawImages = p.images as unknown;
  let safeImages: { url: string; key?: string; alt?: string }[] = [];
  if (Array.isArray(rawImages)) {
    safeImages = rawImages
      .map((im: unknown) => {
        if (typeof im === "string") return { url: im };
        if (im && typeof im === "object" && "url" in im) {
          return {
            url: String((im as { url: unknown }).url || ""),
            key: (im as { key?: string }).key,
            alt: (im as { alt?: string }).alt,
          };
        }
        return null;
      })
      .filter(
        (im): im is { url: string; key?: string; alt?: string } =>
          Boolean(im && im.url)
      );
  }

  const safeAttributes = Array.isArray(p.attributes) ? p.attributes : [];
  const safeOptionNames = Array.isArray(p.optionNames) ? p.optionNames : [];
  const safeTags = Array.isArray(p.tags) ? p.tags : [];
  const safeBadges = Array.isArray(p.badges) ? p.badges : [];

  return (
    <ProductForm
      categories={cats}
      initial={{
        id: p.id,
        name: p.name || "",
        categoryId: p.categoryId,
        shortDescription: p.shortDescription ?? "",
        description: p.description ?? "",
        price: (p.pricePiasters ?? 0) / 100,
        compareAt: p.compareAtPiasters ? p.compareAtPiasters / 100 : null,
        cost: p.costPiasters ? p.costPiasters / 100 : null,
        sku: p.sku ?? "",
        trackStock: p.trackStock ?? true,
        stock: p.stock,
        images: safeImages,
        attributes: safeAttributes,
        optionNames: safeOptionNames,
        variants: variants.map((v) => ({
          id: v.id,
          optionValues: Array.isArray(v.optionValues) ? v.optionValues : [],
          price: v.pricePiasters ? v.pricePiasters / 100 : null,
          stock: v.stock,
          sku: v.sku ?? "",
          imageUrl: v.imageUrl,
          isAvailable: v.isAvailable,
        })),
        tags: safeTags,
        badges: safeBadges,
        status: (p.status as "active" | "draft" | "hidden") || "active",
        isFeatured: p.isFeatured ?? false,
        seoTitle: p.seoTitle ?? "",
        seoDescription: p.seoDescription ?? "",
      }}
    />
  );
}