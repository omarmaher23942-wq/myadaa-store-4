import "server-only";
import { and, eq, gte, sql, desc, ne, isNotNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { analyticsEvents, orders, customers } from "@/db/schema";

export async function getConversionFunnelV2(storeId: string, days: number) {
  const db = await getTenantDb(storeId);
  const since = new Date(Date.now() - days * 86400000);

  const [events] = await db
    .select({
      visits: sql<number>`count(*) filter (where name='page_view')`.mapWith(Number),
      productViews: sql<number>`count(*) filter (where name='product_view')`.mapWith(Number),
      atc: sql<number>`count(*) filter (where name='add_to_cart')`.mapWith(Number),
      checkoutStarted: sql<number>`count(*) filter (where name='begin_checkout')`.mapWith(Number),
    })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.storeId, storeId), gte(analyticsEvents.createdAt, since)));

  const [orderStats] = await db
    .select({
      paymentSelected: sql<number>`count(*)`.mapWith(Number),
      confirmed: sql<number>`count(*) filter (where status not in ('cancelled', 'returned'))`.mapWith(Number),
      delivered: sql<number>`count(*) filter (where status = 'delivered')`.mapWith(Number),
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, since)));

  return {
    visits: events?.visits ?? 0,
    productViews: events?.productViews ?? 0,
    atc: events?.atc ?? 0,
    checkoutStarted: events?.checkoutStarted ?? 0,
    paymentSelected: orderStats?.paymentSelected ?? 0,
    confirmed: orderStats?.confirmed ?? 0,
    delivered: orderStats?.delivered ?? 0,
  };
}

export async function getCohortRetention(storeId: string) {
  const db = await getTenantDb(storeId);
  // SQL Raw Query for Cohort Analysis (Month 0 to Month 5)
  const query = sql`
    WITH customer_first_order AS (
      SELECT customer_id, DATE_TRUNC('month', MIN(created_at)) as cohort_month
      FROM ${orders}
      WHERE store_id = ${storeId} AND status NOT IN ('cancelled', 'returned')
      GROUP BY customer_id
    ),
    cohort_sizes AS (
      SELECT cohort_month, COUNT(DISTINCT customer_id) as total_customers
      FROM customer_first_order
      GROUP BY cohort_month
    ),
    retention_data AS (
      SELECT 
        cfo.cohort_month,
        FLOOR(EXTRACT(EPOCH FROM (DATE_TRUNC('month', o.created_at) - cfo.cohort_month)) / 2592000) as month_number,
        COUNT(DISTINCT o.customer_id) as retained_customers
      FROM ${orders} o
      JOIN customer_first_order cfo ON o.customer_id = cfo.customer_id
      WHERE o.store_id = ${storeId} AND o.status NOT IN ('cancelled', 'returned')
      GROUP BY cfo.cohort_month, month_number
    )
    SELECT 
      cs.cohort_month,
      cs.total_customers,
      COALESCE(MAX(CASE WHEN rd.month_number = 0 THEN rd.retained_customers END), 0) as m0,
      COALESCE(MAX(CASE WHEN rd.month_number = 1 THEN rd.retained_customers END), 0) as m1,
      COALESCE(MAX(CASE WHEN rd.month_number = 2 THEN rd.retained_customers END), 0) as m2,
      COALESCE(MAX(CASE WHEN rd.month_number = 3 THEN rd.retained_customers END), 0) as m3,
      COALESCE(MAX(CASE WHEN rd.month_number = 4 THEN rd.retained_customers END), 0) as m4,
      COALESCE(MAX(CASE WHEN rd.month_number = 5 THEN rd.retained_customers END), 0) as m5
    FROM cohort_sizes cs
    LEFT JOIN retention_data rd ON cs.cohort_month = rd.cohort_month
    GROUP BY cs.cohort_month, cs.total_customers
    ORDER BY cs.cohort_month DESC
    LIMIT 6;
  `;
  
  const res = await db.execute(query);
  return res.rows.map((r: any) => ({
    month: new Date(r.cohort_month).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' }),
    total: Number(r.total_customers),
    m0: Number(r.m0), m1: Number(r.m1), m2: Number(r.m2), m3: Number(r.m3), m4: Number(r.m4), m5: Number(r.m5)
  }));
}

export async function getGeoHeatmap(storeId: string, days: number) {
  const db = await getTenantDb(storeId);
  const since = new Date(Date.now() - days * 86400000);
  return db
    .select({
      governorate: orders.governorate,
      ordersCount: sql<number>`count(*)`.mapWith(Number),
      revenue: sql<number>`coalesce(sum(total_piasters), 0)`.mapWith(Number),
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), gte(orders.createdAt, since), ne(orders.status, "cancelled")))
    .groupBy(orders.governorate)
    .orderBy(desc(sql`count(*)`));
}

export async function getHourlyPeaks(storeId: string, days: number) {
  const db = await getTenantDb(storeId);
  const since = new Date(Date.now() - days * 86400000);
  const query = sql`
    SELECT 
      EXTRACT(DOW FROM created_at) as day_of_week,
      EXTRACT(HOUR FROM created_at) as hour_of_day,
      COUNT(*) as order_count
    FROM ${orders}
    WHERE store_id = ${storeId} AND created_at >= ${since.toISOString()} AND status NOT IN ('cancelled', 'returned')
    GROUP BY day_of_week, hour_of_day
  `;
  const res = await db.execute(query);
  return res.rows.map((r: any) => ({
    dow: Number(r.day_of_week),
    hour: Number(r.hour_of_day),
    count: Number(r.order_count),
  }));
}

export async function getCustomerLtvAndChurn(storeId: string) {
  const db = await getTenantDb(storeId);
  const now = new Date();
  const churnThreshold = new Date(now.getTime() - 60 * 86400000);

  const [stats] = await db
    .select({
      totalCustomers: sql<number>`count(*)`.mapWith(Number),
      avgLtv: sql<number>`coalesce(avg(total_spent_piasters), 0)`.mapWith(Number),
      churnRiskCount: sql<number>`count(*) filter (where orders_count > 0 and last_order_at < ${churnThreshold.toISOString()})`.mapWith(Number),
      repeatRate: sql<number>`(count(*) filter (where orders_count > 1)::float / greatest(count(*), 1)) * 100`.mapWith(Number),
    })
    .from(customers)
    .where(eq(customers.storeId, storeId));

  return {
    totalCustomers: stats?.totalCustomers ?? 0,
    avgLtvEgp: Math.round((stats?.avgLtv ?? 0) / 100),
    churnRiskCount: stats?.churnRiskCount ?? 0,
    repeatRate: stats?.repeatRate ?? 0,
  };
}