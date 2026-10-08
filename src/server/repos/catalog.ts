import "server-only";
import { and, desc, eq, inArray, isNull, sql, gt, ne } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { categories, products, productVariants, reviews, orderItems, orders } from "@/db/schema";
import { normalizeQuery } from "@/lib/arabic";
import { bayesianScore } from "@/lib/utils";
import { redis, rkeys } from "@/lib/redis";
import type { z } from "zod";
import type { productSourceSchema } from "@/blueprint/schema";

export type Product = typeof products.$inferSelect;
export type Variant = typeof productVariants.$inferSelect;
export type Category = typeof categories.$inferSelect;
type Source = z.infer<typeof productSourceSchema>;

const live = (storeId: string) => and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt));

export async function listVisibleCategories(storeId: string) {
  const db = await getTenantDb(storeId);
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      imageUrl: categories.imageUrl,
      parentId: categories.parentId,
      productCount: sql<number>`(select count(*) from products p where p.category_id = ${categories.id} and p.status = 'active' and p.deleted_at is null)`.mapWith(Number),
    })
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.isVisible, true)))
    .orderBy(categories.sortOrder, categories.name);
}

export async function getCategoryBySlug(storeId: string, slug: string) {
  const db = await getTenantDb(storeId);
  const [c] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.slug, slug)))
    .limit(1);
  return c ?? null;
}

export async function productsBySource(storeId: string, source: Source, limit: number): Promise<Product[]> {
  const db = await getTenantDb(storeId);
  const base = db.select().from(products);
  switch (source.type) {
    case "featured":
      return base.where(and(live(storeId), eq(products.isFeatured, true))).orderBy(products.sortOrder, desc(products.createdAt)).limit(limit);
    case "newest":
      return base.where(live(storeId)).orderBy(desc(products.createdAt)).limit(limit);
    case "on_sale":
      return base.where(and(live(storeId), sql`${products.compareAtPiasters} > ${products.pricePiasters}`)).orderBy(desc(products.updatedAt)).limit(limit);
    case "tag":
      return base.where(and(live(storeId), sql`${products.tags} ? ${source.tag}`)).limit(limit);
    case "category": {
      const cat = await getCategoryBySlug(storeId, source.slug);
      if (!cat) return [];
      return base.where(and(live(storeId), eq(products.categoryId, cat.id))).orderBy(products.sortOrder).limit(limit);
    }
    case "manual": {
      if (!source.slugs.length) return [];
      const rows = await base.where(and(live(storeId), inArray(products.slug, source.slugs)));
      return source.slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean) as Product[];
    }
    case "best_sellers": {
      const rows = await base.where(live(storeId)).limit(200);
      return rows
        .map((p) => ({
          p,
          s: p.orderCount * 3 + p.viewCount * 0.02 + bayesianScore(p.ratingSum, p.ratingCount) * 2 + (Date.now() - p.createdAt.getTime() < 14 * 864e5 ? 1.5 : 0),
        }))
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map((x) => x.p);
    }
  }
}

export async function getProductBySlug(storeId: string, slug: string) {
  const db = await getTenantDb(storeId);
  const [p] = await db
    .select()
    .from(products)
    .where(and(live(storeId), eq(products.slug, slug)))
    .limit(1);
  if (!p) return null;
  const variants = p.optionNames.length
    ? await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, p.id))
    : [];
  return { ...p, variants };
}

export async function listProductsByCategory(storeId: string, categoryId: string, sort: string, page: number, perPage = 24) {
  const db = await getTenantDb(storeId);
  const order =
    sort === "price_asc"
      ? products.pricePiasters
      : sort === "price_desc"
      ? desc(products.pricePiasters)
      : sort === "newest"
      ? desc(products.createdAt)
      : desc(products.orderCount);
  return db
    .select()
    .from(products)
    .where(and(live(storeId), eq(products.categoryId, categoryId)))
    .orderBy(order, products.sortOrder)
    .limit(perPage)
    .offset((page - 1) * perPage);
}

export async function searchProducts(storeId: string, q: string, limit = 24) {
  const db = await getTenantDb(storeId);
  const nq = normalizeQuery(q);
  if (!nq) return db.select().from(products).where(live(storeId)).orderBy(desc(products.orderCount)).limit(limit);
  return db
    .select()
    .from(products)
    .where(and(live(storeId), sql`(${products.searchText} % ${nq} OR ${products.searchText} ILIKE ${"%" + nq + "%"})`))
    .orderBy(sql`similarity(${products.searchText}, ${nq}) desc`, desc(products.orderCount))
    .limit(limit);
}

export async function productReviews(storeId: string, productId: string) {
  const db = await getTenantDb(storeId);
  try {
    return await db
      .select({
        id: reviews.id,
        customerName: reviews.customerName,
        rating: reviews.rating,
        body: reviews.body,
        imageUrls: reviews.imageUrls,
        isApproved: reviews.isApproved,
        isVerified: reviews.isVerified,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(and(eq(reviews.storeId, storeId), eq(reviews.productId, productId), eq(reviews.isApproved, true)))
      .orderBy(desc(reviews.createdAt))
      .limit(30);
  } catch {
    return [];
  }
}

export async function frequentlyBoughtTogether(storeId: string, product: Product, limit = 4): Promise<Product[]> {
  const db = await getTenantDb(storeId);
  try {
    const ids = await redis.zrange<string[]>(rkeys.coPurchase(storeId, product.id), 0, limit - 1, { rev: true });
    let rows: Product[] = ids.length
      ? await db
          .select()
          .from(products)
          .where(and(live(storeId), inArray(products.id, ids), ne(products.id, product.id)))
      : [];

    if (rows.length < limit && product.categoryId) {
      const more = await db
        .select()
        .from(products)
        .where(and(live(storeId), eq(products.categoryId, product.categoryId), ne(products.id, product.id)))
        .orderBy(desc(products.orderCount))
        .limit(limit);
      rows = [...rows, ...more.filter((m) => m.id !== product.id && !rows.some((r) => r.id === m.id))].slice(0, limit);
    }

    // تنقية المنتجات لمنع تكرار نفس المنتج إطلاقاً
    const uniqueMap = new Map<string, Product>();
    for (const r of rows) {
      if (r.id !== product.id && !uniqueMap.has(r.id) && r.name.toLowerCase() !== product.name.toLowerCase()) {
        uniqueMap.set(r.id, r);
      }
    }

    const uniqueRows = Array.from(uniqueMap.values());
    // لا نعرض القسم إلا إذا كان هناك منتجان مختلفان على الأقل
    return uniqueRows.length >= 2 ? uniqueRows.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export async function recentOrderProof(storeId: string, lookbackHours: number, minOrders: number) {
  const db = await getTenantDb(storeId);
  const since = new Date(Date.now() - lookbackHours * 36e5);
  const rows = await db
    .select({
      gov: orders.governorate,
      at: orders.createdAt,
      name: orderItems.name,
      img: orderItems.imageUrl,
      slug: products.slug,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orders.storeId, storeId), gt(orders.createdAt, since), ne(orders.status, "cancelled"), eq(orders.isTest, false)))
    .orderBy(desc(orders.createdAt))
    .limit(20);
  return rows.length >= minOrders ? rows : [];
}