// overview.ts — بيانات «نظرة عامة» في لوحة التاجر: الفترة المختارة مقارنةً بالفترة المساوية التي قبلها،
// وسلاسل يومية للرسوم الصغيرة، والربح التقديري من سعر التكلفة، وجاهزية المتجر، وأحدث الطلبات، والسلات المتروكة.
// كل رقم هنا محسوب من قاعدة المتجر؛ ما لا يمكن حسابه يُعاد null ويُشرح في الواجهة بدل رقم مخترع.
import "server-only";
import { and, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { abandonedCarts, analyticsEvents, customers, orderItems, orders, products, shippingZones } from "@/db/schema";

export type OverviewRange = 7 | 30 | 90;
export const OVERVIEW_RANGES: OverviewRange[] = [7, 30, 90];

const DAY = 864e5;
const LIVE = sql`${orders.status} not in ('cancelled','returned')`;

/** مفتاح يوم بتوقيت القاهرة (YYYY-MM-DD)، مطابق لتجميع SQL بـ at time zone 'Africa/Cairo'. */
export function cairoDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** مفاتيح آخر n يوماً بتوقيت القاهرة، الأقدم أولاً. */
export function lastCairoDays(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(cairoDay(new Date(now.getTime() - i * DAY)));
  return [...new Set(out)];
}

export type PeriodTotals = {
  orders: number;
  sales: number; // إجمالي الطلبات المحققة (بالشحن ورسوم التحصيل)
  net: number; // المنتجات بعد الخصم (بلا شحن ولا رسوم)
  visits: number; // جهاز في يوم
  visitors: number; // أجهزة فريدة
};

async function periodTotals(storeId: string, from: Date, to: Date): Promise<PeriodTotals> {
  const db = await getTenantDb(storeId);
  const [[o], [v]] = await Promise.all([
    db
      .select({
        orders: sql<number>`count(*) filter (where ${LIVE})`.mapWith(Number),
        sales: sql<number>`coalesce(sum(${orders.totalPiasters}) filter (where ${LIVE}), 0)`.mapWith(Number),
        net: sql<number>`coalesce(sum(${orders.subtotalPiasters} - ${orders.discountPiasters}) filter (where ${LIVE}), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, from), lt(orders.createdAt, to))),
    db
      .select({
        visits: sql<number>`count(distinct (${analyticsEvents.visitorId} || ':' || to_char(${analyticsEvents.createdAt} at time zone 'Africa/Cairo','YYYY-MM-DD'))) filter (where ${analyticsEvents.name} = 'page_view')`.mapWith(Number),
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorId}) filter (where ${analyticsEvents.name} = 'page_view')`.mapWith(Number),
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.storeId, storeId), gte(analyticsEvents.createdAt, from), lt(analyticsEvents.createdAt, to))),
  ]);
  return { orders: o?.orders ?? 0, sales: o?.sales ?? 0, net: o?.net ?? 0, visits: v?.visits ?? 0, visitors: v?.visitors ?? 0 };
}

export type DailyPoint = { day: string; sales: number; orders: number; visits: number };

async function daily(storeId: string, from: Date, days: number): Promise<DailyPoint[]> {
  const db = await getTenantDb(storeId);
  const dayExpr = (col: unknown) => sql<string>`to_char(${col} at time zone 'Africa/Cairo','YYYY-MM-DD')`;
  const [o, v] = await Promise.all([
    db
      .select({
        day: dayExpr(orders.createdAt),
        orders: sql<number>`count(*)`.mapWith(Number),
        sales: sql<number>`coalesce(sum(${orders.totalPiasters}), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, from), LIVE))
      .groupBy(sql`1`),
    db
      .select({
        day: dayExpr(analyticsEvents.createdAt),
        visits: sql<number>`count(distinct ${analyticsEvents.visitorId})`.mapWith(Number),
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.storeId, storeId), eq(analyticsEvents.name, "page_view"), gte(analyticsEvents.createdAt, from)))
      .groupBy(sql`1`),
  ]);
  const om = new Map(o.map((r) => [r.day, r]));
  const vm = new Map(v.map((r) => [r.day, r.visits]));
  return lastCairoDays(days).map((day) => ({
    day,
    sales: om.get(day)?.sales ?? 0,
    orders: om.get(day)?.orders ?? 0,
    visits: vm.get(day) ?? 0,
  }));
}

export type ProfitEstimate = {
  /** ربح المنتجات المعروفة تكلفتها بعد نصيبها من الخصومات. null إن لم تُضف أي تكلفة بعد. */
  profit: number | null;
  /** نسبة مبيعات المنتجات المعروفة تكلفتها من كل مبيعات المنتجات (0–1). */
  coverage: number;
  /** مبيعات المنتجات (قبل الشحن) في الفترة. */
  itemsRevenue: number;
};

async function profitEstimate(storeId: string, from: Date): Promise<ProfitEstimate> {
  const db = await getTenantDb(storeId);
  const [row] = await db
    .select({
      itemsRevenue: sql<number>`coalesce(sum(${orderItems.totalPiasters}), 0)`.mapWith(Number),
      knownRevenue: sql<number>`coalesce(sum(${orderItems.totalPiasters}) filter (where ${products.costPiasters} is not null), 0)`.mapWith(Number),
      knownCost: sql<number>`coalesce(sum(${products.costPiasters} * ${orderItems.quantity}) filter (where ${products.costPiasters} is not null), 0)`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, and(eq(products.id, orderItems.productId), eq(products.storeId, storeId)))
    .where(and(eq(orderItems.storeId, storeId), eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, from), LIVE));
  const [disc] = await db
    .select({ discounts: sql<number>`coalesce(sum(${orders.discountPiasters}), 0)`.mapWith(Number) })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, from), LIVE));

  const itemsRevenue = row?.itemsRevenue ?? 0;
  const knownRevenue = row?.knownRevenue ?? 0;
  if (knownRevenue === 0) return { profit: null, coverage: 0, itemsRevenue };
  const coverage = itemsRevenue > 0 ? knownRevenue / itemsRevenue : 0;
  // الخصم يُوزَّع بنسبة مبيعات المنتجات المعروفة تكلفتها.
  const discountShare = Math.round((disc?.discounts ?? 0) * coverage);
  return { profit: knownRevenue - (row?.knownCost ?? 0) - discountShare, coverage, itemsRevenue };
}

export type Readiness = {
  hasLogo: boolean;
  activeProducts: number;
  activeWithoutImages: number;
  activeWithCost: number;
  hasContact: boolean;
  activeShippingZones: number;
  hasOrders: boolean;
};

async function readiness(storeId: string): Promise<Omit<Readiness, "hasLogo" | "hasContact">> {
  const db = await getTenantDb(storeId);
  const [[p], [z], [o]] = await Promise.all([
    db
      .select({
        active: sql<number>`count(*)`.mapWith(Number),
        noImages: sql<number>`count(*) filter (where jsonb_array_length(${products.images}) = 0)`.mapWith(Number),
        withCost: sql<number>`count(*) filter (where ${products.costPiasters} is not null)`.mapWith(Number),
      })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.status, "active"), isNull(products.deletedAt))),
    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.isActive, true))),
    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false))),
  ]);
  return {
    activeProducts: p?.active ?? 0,
    activeWithoutImages: p?.noImages ?? 0,
    activeWithCost: p?.withCost ?? 0,
    activeShippingZones: z?.c ?? 0,
    hasOrders: (o?.c ?? 0) > 0,
  };
}

export async function overviewData(storeId: string, days: OverviewRange) {
  const db = await getTenantDb(storeId);
  const now = new Date();
  const from = new Date(now.getTime() - days * DAY);
  const prevFrom = new Date(now.getTime() - 2 * days * DAY);

  const [current, previous, series, profit, ready, recentOrders, carts, topProducts, viewedNotBought, silent] = await Promise.all([
    periodTotals(storeId, from, now),
    periodTotals(storeId, prevFrom, from),
    daily(storeId, from, days),
    profitEstimate(storeId, from),
    readiness(storeId),
    db
      .select({
        id: orders.id,
        code: orders.code,
        customerName: orders.customerName,
        governorate: orders.governorate,
        total: orders.totalPiasters,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false)))
      .orderBy(desc(orders.createdAt))
      .limit(6),
    db
      .select({
        id: abandonedCarts.id,
        name: abandonedCarts.name,
        phone: abandonedCarts.phone,
        subtotal: abandonedCarts.subtotalPiasters,
        items: abandonedCarts.items,
        lastSeenAt: abandonedCarts.lastSeenAt,
        contactedAt: abandonedCarts.whatsappContactedAt,
      })
      .from(abandonedCarts)
      .where(
        and(
          eq(abandonedCarts.storeId, storeId),
          isNotNull(abandonedCarts.phone),
          isNull(abandonedCarts.recoveredOrderId),
          gte(abandonedCarts.lastSeenAt, new Date(now.getTime() - 7 * DAY))
        )
      )
      .orderBy(sql`${abandonedCarts.whatsappContactedAt} is not null`, desc(abandonedCarts.lastSeenAt))
      .limit(6),
    db
      .select({
        productId: orderItems.productId,
        name: orderItems.name,
        qty: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
        revenue: sql<number>`sum(${orderItems.totalPiasters})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.storeId, storeId), eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, from), LIVE))
      .groupBy(orderItems.productId, orderItems.name)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(5),
    // منتج يزوره كثيرون في الفترة ولم يُطلب فيها: زوار فريدون من أحداث product_view.
    db
      .select({
        id: products.id,
        name: products.name,
        viewers: sql<number>`count(distinct ${analyticsEvents.visitorId})`.mapWith(Number),
      })
      .from(analyticsEvents)
      .innerJoin(products, and(eq(products.id, analyticsEvents.productId), eq(products.storeId, storeId)))
      .where(
        and(
          eq(analyticsEvents.storeId, storeId),
          eq(analyticsEvents.name, "product_view"),
          gte(analyticsEvents.createdAt, from),
          eq(products.status, "active"),
          isNull(products.deletedAt),
          sql`not exists (select 1 from ${orderItems} oi join ${orders} o on o.id = oi.order_id
                where oi.store_id = ${storeId} and oi.product_id = ${products.id} and o.created_at >= ${from.toISOString()} and o.is_test = false)`
        )
      )
      .groupBy(products.id, products.name)
      .orderBy(desc(sql`count(distinct ${analyticsEvents.visitorId})`))
      .limit(1),
    // عملاء اشتروا مرتين فأكثر وآخر طلب لهم قبل 60 يوماً.
    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(customers)
      .where(and(eq(customers.storeId, storeId), gte(customers.ordersCount, 2), lt(customers.lastOrderAt, new Date(now.getTime() - 60 * DAY)))),
  ]);

  return {
    days,
    current,
    previous,
    series,
    profit,
    readiness: ready,
    recentOrders,
    carts,
    topProducts,
    viewedNotBought: viewedNotBought[0] ?? null,
    silentRepeat: silent[0]?.c ?? 0,
  };
}

export type OverviewData = Awaited<ReturnType<typeof overviewData>>;

/** نسبة التغير بين فترتين؛ null إن لم تكن هناك فترة سابقة للمقارنة. */
export function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}
