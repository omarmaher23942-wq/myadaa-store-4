// reviews-list.ts — تقييمات المتجر للوحة التاجر: بالحالة (بانتظار الاعتماد/معتمد) وعدد النجوم، مع المنتج وصورته والطلب
// الذي جاء منه التقييم (التوثيق) وموبايل العميل (للتاجر فقط)، وصفحات حقيقية، ومتوسط التقييم المعتمد.
import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders, products, reviews } from "@/db/schema";

export const REVIEWS_PAGE_SIZE = 30;
const STATES = ["pending", "approved", "all"] as const;
export type ReviewsQuery = { state: (typeof STATES)[number]; stars: number | null; page: number };

export function parseReviewsQuery(sp: Record<string, string | undefined>): ReviewsQuery {
  const stars = Number.parseInt(sp.stars ?? "", 10);
  return {
    state: STATES.includes(sp.state as never) ? (sp.state as ReviewsQuery["state"]) : "pending",
    stars: stars >= 1 && stars <= 5 ? stars : null,
    page: Math.max(1, Math.min(10_000, Number.parseInt(sp.page ?? "1", 10) || 1)),
  };
}

export type ReviewRow = {
  id: string;
  productId: string;
  productName: string | null;
  productImage: string | null;
  customerName: string;
  customerPhone: string | null;
  rating: number;
  body: string | null;
  imageUrls: string[];
  isApproved: boolean;
  isVerified: boolean;
  orderId: string | null;
  orderCode: string | null;
  createdAt: string;
};

export async function listReviews(storeId: string, q: ReviewsQuery) {
  const db = await getTenantDb(storeId);
  const base = eq(reviews.storeId, storeId);
  const stateCond: SQL | undefined = q.state === "pending" ? eq(reviews.isApproved, false) : q.state === "approved" ? eq(reviews.isApproved, true) : undefined;
  const where = and(base, stateCond, q.stars ? eq(reviews.rating, q.stars) : undefined);

  const [rows, [counts], [matched]] = await Promise.all([
    db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        productName: products.name,
        productImages: products.images,
        customerName: reviews.customerName,
        customerPhone: reviews.customerPhone,
        rating: reviews.rating,
        body: reviews.body,
        imageUrls: reviews.imageUrls,
        isApproved: reviews.isApproved,
        isVerified: reviews.isVerified,
        orderId: reviews.orderId,
        orderCode: orders.code,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .leftJoin(products, and(eq(products.id, reviews.productId), eq(products.storeId, storeId)))
      .leftJoin(orders, and(eq(orders.id, reviews.orderId), eq(orders.storeId, storeId)))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(REVIEWS_PAGE_SIZE)
      .offset((q.page - 1) * REVIEWS_PAGE_SIZE),
    db
      .select({
        all: sql<number>`count(*)`.mapWith(Number),
        pending: sql<number>`count(*) filter (where not ${reviews.isApproved})`.mapWith(Number),
        approved: sql<number>`count(*) filter (where ${reviews.isApproved})`.mapWith(Number),
        avg: sql<number | null>`avg(${reviews.rating}) filter (where ${reviews.isApproved})`.mapWith((v) => (v === null ? null : Number(v))),
      })
      .from(reviews)
      .where(base),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(reviews).where(where),
  ]);
  const total = matched?.n ?? 0;
  return {
    rows: rows.map(
      (r): ReviewRow => ({
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        productImage: r.productImages?.[0]?.url ?? null,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        rating: r.rating,
        body: r.body,
        imageUrls: r.imageUrls ?? [],
        isApproved: r.isApproved,
        isVerified: r.isVerified && Boolean(r.orderId),
        orderId: r.orderId,
        orderCode: r.orderCode,
        createdAt: r.createdAt.toISOString(),
      })
    ),
    counts: counts ?? { all: 0, pending: 0, approved: 0, avg: null },
    total,
    pages: Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE)),
  };
}
