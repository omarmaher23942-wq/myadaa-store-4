// orders-list.ts — قائمة الطلبات في لوحة التاجر: فلترة بالحالة وطريقة/حالة الدفع والبحث (كود، موبايل بأي أرقام،
// اسم)، وصفحات حقيقية بدل حد ثابت، وملخص أصناف كل طلب، وسجل كل عميل مع المتجر (استلم/رفض) كإشارة مخاطرة
// للدفع عند الاستلام، ولوحة مراحل للطلبات الجارية.
import "server-only";
import { and, desc, eq, gte, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders } from "@/db/schema";
import { normalizeArabic } from "@/lib/arabic";
import type { OrderStatus } from "@/lib/order-status";

export const ORDERS_PAGE_SIZE = 30;
export const PAY_FILTERS = ["all", "review", "cod", "transfer"] as const;
export type PayFilter = (typeof PAY_FILTERS)[number];
const STATUSES: OrderStatus[] = ["new", "confirmed", "preparing", "shipped", "delivered", "returned", "cancelled"];

export type OrdersQuery = { status: OrderStatus | "all"; pay: PayFilter; q: string; page: number };

export function parseOrdersQuery(sp: Record<string, string | undefined>): OrdersQuery {
  const status = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : "all";
  // روابط قديمة: payment=under_review
  const pay = PAY_FILTERS.includes(sp.pay as PayFilter) ? (sp.pay as PayFilter) : sp.payment === "under_review" ? "review" : "all";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.page ?? "1", 10) || 1));
  return { status, pay, q: (sp.q ?? "").trim().slice(0, 60), page };
}

const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function payCond(pay: PayFilter): SQL | undefined {
  if (pay === "review") return and(eq(orders.paymentStatus, "under_review"), sql`${orders.status} not in ('cancelled','returned')`);
  if (pay === "cod") return eq(orders.paymentMethod, "cod");
  if (pay === "transfer") return inArray(orders.paymentMethod, ["vodafone_cash", "instapay"]);
  return undefined;
}

function searchCond(q: string): SQL | undefined {
  if (!q) return undefined;
  const text = `%${likeSafe(q)}%`;
  const digits = normalizeArabic(q).replace(/\D/g, "");
  return or(
    ilike(orders.code, text),
    ilike(orders.customerName, text),
    digits.length >= 3 ? ilike(orders.code, `%${digits}%`) : undefined,
    digits.length >= 4 ? ilike(orders.customerPhone, `%${likeSafe(digits)}%`) : undefined
  );
}

export type OrderRow = {
  id: string;
  code: string;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  totalPiasters: number;
  customerName: string;
  customerPhone: string;
  customerAltPhone: string | null;
  governorate: string;
  city: string | null;
  address: string;
  landmark: string | null;
  isTest: boolean;
  courierName: string | null;
  trackingNumber: string | null;
  items: { first: string | null; lines: number; pieces: number };
  /** طلبات هذا الرقم الأخرى في المتجر (بلا الطلب نفسه). */
  history: { total: number; delivered: number; returned: number };
};

async function decorate(storeId: string, rows: (typeof orders.$inferSelect)[]): Promise<OrderRow[]> {
  if (!rows.length) return [];
  const db = await getTenantDb(storeId);
  const ids = rows.map((r) => r.id);
  const phones = [...new Set(rows.map((r) => r.customerPhone))];
  const [items, hist] = await Promise.all([
    db
      .select({
        orderId: orderItems.orderId,
        lines: sql<number>`count(*)`.mapWith(Number),
        pieces: sql<number>`coalesce(sum(${orderItems.quantity}), 0)`.mapWith(Number),
        first: sql<string>`(array_agg(${orderItems.name} order by ${orderItems.totalPiasters} desc))[1]`,
      })
      .from(orderItems)
      .where(and(eq(orderItems.storeId, storeId), inArray(orderItems.orderId, ids)))
      .groupBy(orderItems.orderId),
    db
      .select({
        phone: orders.customerPhone,
        total: sql<number>`count(*)`.mapWith(Number),
        delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')`.mapWith(Number),
        returned: sql<number>`count(*) filter (where ${orders.status} = 'returned')`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), inArray(orders.customerPhone, phones)))
      .groupBy(orders.customerPhone),
  ]);
  const im = new Map(items.map((i) => [i.orderId, i]));
  const hm = new Map(hist.map((h) => [h.phone, h]));
  return rows.map((r) => {
    const h = hm.get(r.customerPhone);
    const self = r.isTest ? 0 : 1;
    return {
      id: r.id,
      code: r.code,
      createdAt: r.createdAt.toISOString(),
      status: r.status,
      paymentMethod: r.paymentMethod,
      paymentStatus: r.paymentStatus,
      totalPiasters: r.totalPiasters,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerAltPhone: r.customerAltPhone,
      governorate: r.governorate,
      city: r.city,
      address: r.address,
      landmark: r.landmark,
      isTest: r.isTest,
      courierName: r.courierName,
      trackingNumber: r.trackingNumber,
      items: { first: im.get(r.id)?.first ?? null, lines: im.get(r.id)?.lines ?? 0, pieces: im.get(r.id)?.pieces ?? 0 },
      history: {
        total: Math.max(0, (h?.total ?? 0) - self),
        delivered: Math.max(0, (h?.delivered ?? 0) - (self && r.status === "delivered" ? 1 : 0)),
        returned: Math.max(0, (h?.returned ?? 0) - (self && r.status === "returned" ? 1 : 0)),
      },
    };
  });
}

export async function listOrders(storeId: string, query: OrdersQuery) {
  const db = await getTenantDb(storeId);
  const base = and(eq(orders.storeId, storeId), payCond(query.pay), searchCond(query.q));
  const where = and(base, query.status === "all" ? undefined : eq(orders.status, query.status));

  const [counts, rows] = await Promise.all([
    db
      .select({ status: orders.status, n: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(base)
      .groupBy(orders.status),
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(ORDERS_PAGE_SIZE)
      .offset((query.page - 1) * ORDERS_PAGE_SIZE),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<OrderStatus, number>>;
  const all = counts.reduce((a, c) => a + c.n, 0);
  const total = query.status === "all" ? all : (byStatus[query.status] ?? 0);
  return { rows: await decorate(storeId, rows), byStatus, all, total, pages: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)) };
}

/** لوحة المراحل: كل الطلبات الجارية (حتى 200) والمسلَّمة في آخر 3 أيام، بنفس فلتر الدفع والبحث. */
export async function boardOrders(storeId: string, query: Pick<OrdersQuery, "pay" | "q">) {
  const db = await getTenantDb(storeId);
  const base = and(eq(orders.storeId, storeId), payCond(query.pay), searchCond(query.q));
  const [active, delivered] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(and(base, inArray(orders.status, ["new", "confirmed", "preparing", "shipped"])))
      .orderBy(desc(orders.createdAt))
      .limit(200),
    db
      .select()
      .from(orders)
      .where(and(base, eq(orders.status, "delivered"), gte(orders.deliveredAt, new Date(Date.now() - 3 * 864e5)), ne(orders.isTest, true)))
      .orderBy(desc(orders.deliveredAt))
      .limit(30),
  ]);
  return decorate(storeId, [...active, ...delivered]);
}
