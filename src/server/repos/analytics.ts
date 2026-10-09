import "server-only";
import { and, eq, gte, sql, desc, ne } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import {
  analyticsEvents,
  orders,
  orderItems,
  products,
} from "@/db/schema";

export type RangeDays = 7 | 30 | 90;

export type AnalyticsStats = Awaited<ReturnType<typeof analyticsStats>>;

// ─── Analytics: بيانات صفحة التحليلات ──────────────────────────────────────
export async function analyticsStats(storeId: string, days: RangeDays = 30) {
  const db = await getTenantDb(storeId);
  const since = new Date(Date.now() - days * 864e5);

  // بيانات يومية للإيراد والطلبات.
  const dailyRows = await db
    .select({
      day: sql<string>`to_char(${orders.createdAt} at time zone 'Africa/Cairo','YYYY-MM-DD')`,
      orders: sql<number>`count(*)`.mapWith(Number),
      revenue: sql<number>`coalesce(sum(${orders.totalPiasters}),0)`.mapWith(Number),
    })
    .from(orders)
    .where(
      and(
        eq(orders.storeId, storeId),
        gte(orders.createdAt, since),
        ne(orders.status, "cancelled")
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  // املأ الأيام الناقصة بقيم صفرية للحصول على منحنى نظيف.
  const daily = fillMissingDays(dailyRows, days);

  // قمع التحويل.
  const [funnel] = await db
    .select({
      // زيارة = جهاز في يوم (التحديث والخروج والعودة في نفس اليوم لا تكرر الزيارة).
      views: sql<number>`count(distinct (visitor_id || ':' || to_char(created_at at time zone 'Africa/Cairo','YYYY-MM-DD'))) filter (where name='page_view')`.mapWith(Number),
      productViews: sql<number>`count(distinct visitor_id) filter (where name='product_view')`.mapWith(Number),
      atc: sql<number>`count(distinct visitor_id) filter (where name='add_to_cart')`.mapWith(Number),
      checkouts: sql<number>`count(distinct visitor_id) filter (where name='begin_checkout')`.mapWith(Number),
      purchases: sql<number>`count(distinct visitor_id) filter (where name='purchase')`.mapWith(Number),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.storeId, storeId),
        gte(analyticsEvents.createdAt, since)
      )
    );

  // المنتجات الأكثر مبيعاً.
  const topProducts = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.name,
      qty: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
      revenue: sql<number>`sum(${orderItems.totalPiasters})`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orderItems.storeId, storeId),
        gte(orders.createdAt, since),
        ne(orders.status, "cancelled")
      )
    )
    .groupBy(orderItems.productId, orderItems.name)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(8);

  // المخزون المنخفض.
  const lowStock = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      price: products.pricePiasters,
    })
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        eq(products.trackStock, true),
        sql`${products.stock} <= 3`,
        eq(products.status, "active")
      )
    )
    .orderBy(products.stock)
    .limit(10);

  // توزيع المحافظات (Top 5).
  const governorates = await db
    .select({
      governorate: orders.governorate,
      count: sql<number>`count(*)`.mapWith(Number),
      revenue: sql<number>`coalesce(sum(${orders.totalPiasters}),0)`.mapWith(Number),
    })
    .from(orders)
    .where(
      and(
        eq(orders.storeId, storeId),
        gte(orders.createdAt, since),
        ne(orders.status, "cancelled")
      )
    )
    .groupBy(orders.governorate)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  return {
    daily,
    funnel: funnel!,
    topProducts,
    lowStock,
    governorates,
    days,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fillMissingDays(
  rows: { day: string; orders: number; revenue: number }[],
  days: number
): { day: string; orders: number; revenue: number }[] {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; orders: number; revenue: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = map.get(key);
    out.push({
      day: key,
      orders: found?.orders ?? 0,
      revenue: found?.revenue ?? 0,
    });
  }
  return out;
}