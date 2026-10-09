// customers-list.ts — عملاء المتجر للوحة التاجر. الأرقام تُحسب من الطلبات نفسها لا من عدّادات العميل (تلك تزيد مع كل
// طلب ولا تنقص عند الإلغاء): «اشترى» = طلبات تم تسليمها ومجموعها، و«جارٍ» = طلبات لم تُغلق، و«أرجع» = مرتجعات
// (رفض الاستلام). طلبات التجربة التي يضعها التاجر لا تُحسب. شرائح بتعريفات معلنة، وبحث بالاسم أو الموبايل بأي أرقام.
import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { normalizeArabic } from "@/lib/arabic";

export const CUSTOMERS_PAGE_SIZE = 30;
export const WINBACK_DAYS = 60;
export const NEW_DAYS = 30;

const SEGMENTS = ["all", "repeat", "new", "open", "winback", "returned", "blocked"] as const;
const SORTS = ["recent", "spent", "orders", "newest"] as const;
export type CustomerSegment = (typeof SEGMENTS)[number];
export type CustomerSort = (typeof SORTS)[number];
export type CustomersQuery = { segment: CustomerSegment; sort: CustomerSort; q: string; page: number };

export function parseCustomersQuery(sp: Record<string, string | undefined>): CustomersQuery {
  // روابط قديمة: vip → متكرر، at_risk/churned → لم يعودوا.
  const legacy: Record<string, CustomerSegment> = { vip: "repeat", at_risk: "winback", churned: "winback" };
  const seg = sp.segment && legacy[sp.segment] ? legacy[sp.segment]! : sp.segment;
  return {
    segment: SEGMENTS.includes(seg as never) ? (seg as CustomerSegment) : "all",
    sort: SORTS.includes(sp.sort as never) ? (sp.sort as CustomerSort) : "recent",
    q: (sp.q ?? "").trim().slice(0, 60),
    page: Math.max(1, Math.min(10_000, Number.parseInt(sp.page ?? "1", 10) || 1)),
  };
}

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  governorate: string | null;
  city: string | null;
  isBlocked: boolean;
  createdAt: string;
  orders: number;
  delivered: number;
  open: number;
  returned: number;
  spentPiasters: number;
  lastOrderAt: string | null;
};

const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** الاستعلام الأساسي: عملاء المتجر مع مجاميع طلباتهم (CTE واحد). */
function base(storeId: string) {
  return sql`
    with agg as (
      select o.customer_id,
        count(*)::int as orders,
        count(*) filter (where o.status = 'delivered')::int as delivered,
        count(*) filter (where o.status in ('new','confirmed','preparing','shipped'))::int as open,
        count(*) filter (where o.status = 'returned')::int as returned,
        coalesce(sum(o.total_piasters) filter (where o.status = 'delivered'), 0)::bigint as spent,
        max(o.created_at) as last_at
      from orders o
      where o.store_id = ${storeId} and o.customer_id is not null and o.is_test = false
      group by o.customer_id
    ),
    c as (
      select cu.id, cu.name, cu.phone, cu.email, cu.governorate, cu.city, cu.is_blocked, cu.created_at,
        coalesce(agg.orders, 0) as orders, coalesce(agg.delivered, 0) as delivered, coalesce(agg.open, 0) as open,
        coalesce(agg.returned, 0) as returned, coalesce(agg.spent, 0) as spent, agg.last_at
      from customers cu left join agg on agg.customer_id = cu.id
      where cu.store_id = ${storeId}
    )`;
}

function segmentCond(s: CustomerSegment): SQL {
  switch (s) {
    case "repeat":
      return sql`c.delivered >= 2`;
    case "new":
      return sql`c.created_at >= now() - make_interval(days => ${NEW_DAYS})`;
    case "open":
      return sql`c.open > 0`;
    case "winback":
      return sql`c.delivered >= 1 and c.open = 0 and c.last_at < now() - make_interval(days => ${WINBACK_DAYS})`;
    case "returned":
      return sql`c.returned > 0`;
    case "blocked":
      return sql`c.is_blocked`;
    default:
      return sql`true`;
  }
}

function searchCond(q: string): SQL {
  if (!q) return sql`true`;
  const digits = normalizeArabic(q).replace(/\D/g, "");
  const text = `%${likeSafe(q)}%`;
  return sql`(c.name ilike ${text} or c.email ilike ${text}${digits.length >= 3 ? sql` or c.phone like ${`%${likeSafe(digits)}%`}` : sql``})`;
}

const ORDER: Record<CustomerSort, SQL> = {
  recent: sql`c.last_at desc nulls last, c.created_at desc`,
  spent: sql`c.spent desc, c.last_at desc nulls last`,
  orders: sql`c.delivered desc, c.orders desc, c.last_at desc nulls last`,
  newest: sql`c.created_at desc`,
};

type Raw = Record<string, unknown>;
const toRow = (r: Raw): CustomerRow => ({
  id: String(r.id),
  name: String(r.name),
  phone: String(r.phone),
  email: (r.email as string | null) ?? null,
  governorate: (r.governorate as string | null) ?? null,
  city: (r.city as string | null) ?? null,
  isBlocked: r.is_blocked === true || r.is_blocked === "t",
  createdAt: new Date(String(r.created_at)).toISOString(),
  orders: Number(r.orders) || 0,
  delivered: Number(r.delivered) || 0,
  open: Number(r.open) || 0,
  returned: Number(r.returned) || 0,
  spentPiasters: Number(r.spent) || 0,
  lastOrderAt: r.last_at ? new Date(String(r.last_at)).toISOString() : null,
});

const rowsOf = (res: unknown): Raw[] => (Array.isArray(res) ? res : ((res as { rows?: Raw[] }).rows ?? [])) as Raw[];

export async function listCustomers(storeId: string, query: CustomersQuery) {
  const db = await getTenantDb(storeId);
  const where = sql`${segmentCond(query.segment)} and ${searchCond(query.q)}`;
  const [rowsRes, countsRes] = await Promise.all([
    db.execute(sql`${base(storeId)}
      select * from c where ${where}
      order by ${ORDER[query.sort]}
      limit ${CUSTOMERS_PAGE_SIZE} offset ${(query.page - 1) * CUSTOMERS_PAGE_SIZE}`),
    db.execute(sql`${base(storeId)}
      select
        count(*) filter (where ${searchCond(query.q)})::int as all,
        count(*) filter (where ${segmentCond("repeat")} and ${searchCond(query.q)})::int as repeat,
        count(*) filter (where ${segmentCond("new")} and ${searchCond(query.q)})::int as new,
        count(*) filter (where ${segmentCond("open")} and ${searchCond(query.q)})::int as open,
        count(*) filter (where ${segmentCond("winback")} and ${searchCond(query.q)})::int as winback,
        count(*) filter (where ${segmentCond("returned")} and ${searchCond(query.q)})::int as returned,
        count(*) filter (where ${segmentCond("blocked")} and ${searchCond(query.q)})::int as blocked,
        count(*) filter (where c.delivered >= 1)::int as buyers,
        count(*) filter (where c.delivered >= 2)::int as repeaters,
        coalesce(sum(c.spent), 0)::bigint as spent
      from c`),
  ]);
  const k = rowsOf(countsRes)[0] ?? {};
  const counts = Object.fromEntries(SEGMENTS.map((s) => [s, Number(k[s]) || 0])) as Record<CustomerSegment, number>;
  const matched = counts[query.segment];
  return {
    rows: rowsOf(rowsRes).map(toRow),
    counts,
    total: matched,
    pages: Math.max(1, Math.ceil(matched / CUSTOMERS_PAGE_SIZE)),
    buyers: Number(k.buyers) || 0,
    repeaters: Number(k.repeaters) || 0,
    spentPiasters: Number(k.spent) || 0,
  };
}

export type CustomerProfile = {
  customer: CustomerRow & { altPhone: string | null; address: string | null; notes: string; googleLinked: boolean };
  orders: { id: string; code: string; createdAt: string; status: string; paymentMethod: string; totalPiasters: number; pieces: number; firstItem: string | null }[];
  topProducts: { productId: string | null; name: string; pieces: number }[];
  firstOrderAt: string | null;
};

/** ملف عميل واحد: بياناته ومجاميعه (نفس تعريفات القائمة) وكل طلباته وأكثر ما يشتريه. */
export async function customerProfile(storeId: string, id: string): Promise<CustomerProfile | null> {
  const db = await getTenantDb(storeId);
  const [baseRes, extraRes, ordersRes, topRes] = await Promise.all([
    db.execute(sql`${base(storeId)} select * from c where c.id = ${id}`),
    db.execute(sql`select alt_phone, address, notes, google_id is not null as google from customers where store_id = ${storeId} and id = ${id}`),
    db.execute(sql`
      select o.id, o.code, o.created_at, o.status, o.payment_method, o.total_piasters,
        (select coalesce(sum(i.quantity), 0) from order_items i where i.order_id = o.id)::int as pieces,
        (select i.name from order_items i where i.order_id = o.id order by i.id limit 1) as first_item
      from orders o
      where o.store_id = ${storeId} and o.customer_id = ${id} and o.is_test = false
      order by o.created_at desc
      limit 100`),
    db.execute(sql`
      select i.product_id, max(i.name) as name, sum(i.quantity)::int as pieces
      from order_items i join orders o on o.id = i.order_id
      where o.store_id = ${storeId} and o.customer_id = ${id} and o.is_test = false and o.status not in ('cancelled')
      group by i.product_id
      order by pieces desc
      limit 5`),
  ]);
  const raw = rowsOf(baseRes)[0];
  const extra = rowsOf(extraRes)[0];
  if (!raw || !extra) return null;
  const orders = rowsOf(ordersRes).map((o) => ({
    id: String(o.id),
    code: String(o.code),
    createdAt: new Date(String(o.created_at)).toISOString(),
    status: String(o.status),
    paymentMethod: String(o.payment_method),
    totalPiasters: Number(o.total_piasters) || 0,
    pieces: Number(o.pieces) || 0,
    firstItem: (o.first_item as string | null) ?? null,
  }));
  return {
    customer: {
      ...toRow(raw),
      altPhone: (extra.alt_phone as string | null) ?? null,
      address: (extra.address as string | null) ?? null,
      notes: (extra.notes as string | null) ?? "",
      googleLinked: extra.google === true || extra.google === "t",
    },
    orders,
    topProducts: rowsOf(topRes).map((t) => ({ productId: (t.product_id as string | null) ?? null, name: String(t.name), pieces: Number(t.pieces) || 0 })),
    firstOrderAt: orders.length ? orders[orders.length - 1]!.createdAt : null,
  };
}

/** كل العملاء للتصدير بنفس مجاميع الصفحة، مع بيانات التواصل الكاملة. */
export async function customersForExport(storeId: string) {
  const db = await getTenantDb(storeId);
  const res = await db.execute(sql`${base(storeId)}
    select c.*, cu.alt_phone, cu.address, cu.notes
    from c join customers cu on cu.id = c.id
    order by c.last_at desc nulls last, c.created_at desc
    limit 20000`);
  return rowsOf(res).map((r) => ({ ...toRow(r), altPhone: (r.alt_phone as string | null) ?? null, address: (r.address as string | null) ?? null, notes: (r.notes as string | null) ?? null }));
}
