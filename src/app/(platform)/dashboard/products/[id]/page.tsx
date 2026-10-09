// dashboard/products/[id]/page.tsx — إضافة منتج (/new) وتعديله. يحمّل المنتج وتركيباته وإحصاءاته الحقيقية (مشاهدات،
// قطع مبيعة، تقييم) وشارة «المميز» بنص المتجر نفسه، ويسلّمها للمحرر.
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { categories, productVariants, products } from "@/db/schema";
import { getBlueprintOrNull } from "@/lib/tenant";
import { copyOf } from "@/blueprint/copy";
import { NO_STORE_HREF } from "@/lib/edition";
import { ProductEditor } from "@/components/dashboard/product/ProductEditor";
import { EMPTY_PRODUCT, type EditorProduct } from "@/components/dashboard/product/model";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  const session = await getMerchantSession();
  if (!session) redirect(`/login?redirect=/dashboard/products/${id}`);
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  const store = session.store;
  const db = await getTenantDb(store.id);
  if (id === "new") return { store, db, product: null };
  if (!UUID.test(id)) notFound();
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.storeId, store.id), isNull(products.deletedAt)))
    .limit(1);
  if (!product) notFound();
  return { store, db, product };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (id === "new") return { title: "منتج جديد" };
  const { product } = await load(id);
  return { title: product?.name ?? "منتج" };
}

const egp = (p: number | null | undefined) => (p === null || p === undefined ? "" : String(p / 100));

export default async function DashboardProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store, db, product: p } = await load(id);

  const [cats, variants, bp] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.sortOrder), asc(categories.name)),
    p
      ? db
          .select()
          .from(productVariants)
          .where(and(eq(productVariants.productId, p.id), eq(productVariants.storeId, store.id)))
          .orderBy(asc(productVariants.createdAt))
      : Promise.resolve([]),
    getBlueprintOrNull(store.id),
  ]);
  const featuredBadge = copyOf(bp?.copy, "bestSellerBadge");

  if (!p) return <ProductEditor key="new" initial={EMPTY_PRODUCT} categories={cats} subdomain={store.subdomain} featuredBadge={featuredBadge} />;

  const initial: EditorProduct = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    categoryId: p.categoryId,
    shortDescription: p.shortDescription ?? "",
    description: p.description ?? "",
    price: egp(p.pricePiasters),
    compareAt: egp(p.compareAtPiasters),
    cost: egp(p.costPiasters),
    sku: p.sku ?? "",
    trackStock: p.trackStock,
    stock: p.trackStock && p.stock !== null ? String(p.stock) : "",
    images: (Array.isArray(p.images) ? p.images : []).filter((im) => im && typeof im.url === "string" && im.url),
    attributes: Array.isArray(p.attributes) ? p.attributes : [],
    optionNames: variants.length && Array.isArray(p.optionNames) ? p.optionNames : [],
    // سعر التركيبة المساوي لسعر المنتج (بيانات قديمة) يُعرض «يرث سعر المنتج» فيتبع أي تغيير لاحق في السعر.
    variants: variants.map((v) => ({
      id: v.id,
      optionValues: v.optionValues,
      price: v.pricePiasters !== null && v.pricePiasters !== p.pricePiasters ? v.pricePiasters / 100 : null,
      stock: v.stock,
      sku: v.sku,
      imageUrl: v.imageUrl,
      isAvailable: v.isAvailable,
    })),
    tags: Array.isArray(p.tags) ? p.tags : [],
    badges: Array.isArray(p.badges) ? p.badges : [],
    status: p.status === "active" || p.status === "hidden" ? p.status : "draft",
    isFeatured: p.isFeatured,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
  };

  return (
    <ProductEditor
      key={p.id}
      initial={initial}
      categories={cats}
      subdomain={store.subdomain}
      featuredBadge={featuredBadge}
      stats={{
        views: p.viewCount,
        sold: p.orderCount,
        ratingAvg: p.ratingCount ? p.ratingSum / p.ratingCount : null,
        ratingCount: p.ratingCount,
        createdAt: p.createdAt.toISOString(),
      }}
    />
  );
}
