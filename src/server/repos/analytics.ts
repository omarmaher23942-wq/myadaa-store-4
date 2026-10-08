import "server-only";
import { and, eq, gte, sql, desc, ne, isNotNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import {
  analyticsEvents,
  orders,
  orderItems,
  products,
  abandonedCarts,
  customers,
} from "@/db/schema";

export type RangeDays = 7 | 30 | 90;

export type DashboardStats = Awaited<ReturnType<typeof dashboardStats>>;
export type AnalyticsStats = Awaited<ReturnType<typeof analyticsStats>>;

// ─── Dashboard: بيانات اللوحة الرئيسية ─────────────────────────────────────
export async function dashboardStats(storeId: string, days: RangeDays = 30) {
  const db = await getTenantDb(storeId);
  const since = new Date(Date.now() - days * 864e5);

  const [ev] = await db
    .select({
      views: sql<number>`count(*) filter (where name='page_view')`.mapWith(Number),
      visitors: sql<number>`count(distinct visitor_id)`.mapWith(Number),
      atc: sql<number>`count(*) filter (where name='add_to_cart')`.mapWith(Number),
      checkouts: sql<number>`count(*) filter (where name='begin_checkout')`.mapWith(Number),
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.storeId, storeId),
        gte(analyticsEvents.createdAt, since)
      )
    );

  // المبيعات المحققة: استثناء الملغي والمرتجع. الإيراد = الإجمالي - fee (COD) - shipping - discount.
  const [od] = await db
    .select({
      count: sql<number>`count(*)`.mapWith(Number),
      gross: sql<number>`coalesce(sum(${orders.totalPiasters}) filter (where ${orders.status} not in ('cancelled','returned')),0)`.mapWith(Number),
      net: sql<number>`coalesce(sum(${orders.subtotalPiasters} - ${orders.discountPiasters}) filter (where ${orders.status} not in ('cancelled','returned')),0)`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${orders.status}='new')`.mapWith(Number),
      reviewPay: sql<number>`count(*) filter (where ${orders.paymentStatus}='under_review')`.mapWith(Number),
    })
    .from(orders)
    .where(
      and(eq(orders.storeId, storeId), gte(orders.createdAt, since))
    );

  // العملاء الجدد في الفترة.
  const [cust] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      newOnes: sql<number>`count(*) filter (where ${customers.createdAt} >= ${since.toISOString()})`.mapWith(Number),
    })
    .from(customers)
    .where(eq(customers.storeId, storeId));

  // أحدث الطلبات.
  const recentOrders = await db
    .select({
      id: orders.id,
      code: orders.code,
      customerName: orders.customerName,
      governorate: orders.governorate,
      total: orders.totalPiasters,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.storeId, storeId))
    .orderBy(desc(orders.createdAt))
    .limit(6);

  // السلات المتروكة (مع رقم هاتف قابل للمراسلة).
  const abandoned = await db
    .select({
      id: abandonedCarts.id,
      name: abandonedCarts.name,
      phone: abandonedCarts.phone,
      subtotal: abandonedCarts.subtotalPiasters,
      items: abandonedCarts.items,
      lastSeenAt: abandonedCarts.lastSeenAt,
      whatsappContactedAt: abandonedCarts.whatsappContactedAt,
    })
    .from(abandonedCarts)
    .where(
      and(
        eq(abandonedCarts.storeId, storeId),
        isNotNull(abandonedCarts.phone),
        sql`${abandonedCarts.recoveredOrderId} is null`,
        gte(abandonedCarts.lastSeenAt, since)
      )
    )
    .orderBy(desc(abandonedCarts.lastSeenAt))
    .limit(10);

  // صحة المتجر (يُستخدم في HealthScore).
  const [prodCounts] = await db
    .select({
      total: sql<number>`count(*) filter (where ${products.status}='active')`.mapWith(Number),
      lowStock: sql<number>`count(*) filter (where ${products.trackStock}=true and ${products.stock} <= 3 and ${products.status}='active')`.mapWith(Number),
    })
    .from(products)
    .where(eq(products.storeId, storeId));

  return {
    ev: ev!,
    od: od!,
    cust: cust!,
    recentOrders,
    abandoned,
    prodCounts: prodCounts!,
    conversion: ev!.visitors > 0 ? (od!.count / ev!.visitors) * 100 : 0,
  };
}

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
      views: sql<number>`count(*) filter (where name='page_view')`.mapWith(Number),
      productViews: sql<number>`count(*) filter (where name='product_view')`.mapWith(Number),
      atc: sql<number>`count(*) filter (where name='add_to_cart')`.mapWith(Number),
      checkouts: sql<number>`count(*) filter (where name='begin_checkout')`.mapWith(Number),
      purchases: sql<number>`count(*) filter (where name='purchase')`.mapWith(Number),
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