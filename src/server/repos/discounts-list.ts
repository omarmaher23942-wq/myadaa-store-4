// discounts-list.ts — أكواد الخصم للوحة التاجر مع أثر كل كود من الطلبات نفسها: عدد الطلبات التي استخدمته (بلا الملغاة
// وطلبات التجربة)، والمسلَّم منها ومبيعاته، ومجموع ما خُصم. «استُخدم» الذي يفرضه الدفع (usedCount) يبقى للحد الأقصى.
import "server-only";
import { sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import type { DiscountShape } from "@/lib/discounts";

export type DiscountRow = DiscountShape & {
  id: string;
  createdAt: string;
  orders: number;
  delivered: number;
  salesPiasters: number;
  givenPiasters: number;
};

const rowsOf = (res: unknown): Record<string, unknown>[] => (Array.isArray(res) ? res : ((res as { rows?: Record<string, unknown>[] }).rows ?? [])) as Record<string, unknown>[];
const isoOrNull = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

export async function listDiscounts(storeId: string): Promise<DiscountRow[]> {
  const db = await getTenantDb(storeId);
  const res = await db.execute(sql`
    with use as (
      select o.discount_code as code,
        count(*) filter (where o.status <> 'cancelled')::int as orders,
        count(*) filter (where o.status = 'delivered')::int as delivered,
        coalesce(sum(o.total_piasters) filter (where o.status = 'delivered'), 0)::bigint as sales,
        coalesce(sum(o.discount_piasters) filter (where o.status not in ('cancelled', 'returned')), 0)::bigint as given
      from orders o
      where o.store_id = ${storeId} and o.discount_code is not null and o.is_test = false
      group by o.discount_code
    )
    select d.*, coalesce(u.orders, 0) as orders, coalesce(u.delivered, 0) as delivered,
      coalesce(u.sales, 0) as sales, coalesce(u.given, 0) as given
    from discounts d left join use u on u.code = d.code
    where d.store_id = ${storeId}
    order by d.is_active desc, d.created_at desc`);
  return rowsOf(res).map((r) => ({
    id: String(r.id),
    code: String(r.code),
    type: r.type as DiscountRow["type"],
    value: Number(r.value) || 0,
    minSubtotalPiasters: r.min_subtotal_piasters === null ? null : Number(r.min_subtotal_piasters),
    maxUses: r.max_uses === null ? null : Number(r.max_uses),
    usedCount: Number(r.used_count) || 0,
    perCustomerLimit: r.per_customer_limit === null ? null : Number(r.per_customer_limit),
    startsAt: isoOrNull(r.starts_at),
    endsAt: isoOrNull(r.ends_at),
    isActive: r.is_active === true || r.is_active === "t",
    createdAt: new Date(String(r.created_at)).toISOString(),
    orders: Number(r.orders) || 0,
    delivered: Number(r.delivered) || 0,
    salesPiasters: Number(r.sales) || 0,
    givenPiasters: Number(r.given) || 0,
  }));
}
