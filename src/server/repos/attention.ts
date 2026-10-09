// attention.ts — «ما يحتاج انتباهك» في لوحة التاجر: أعداد حقيقية من قاعدة المتجر في استعلام واحد،
// والطلبات التي وصلت منذ آخر فحص (لتنبيه الطلب الجديد في أي صفحة). يعمل في المنصة وفي مشروع التاجر
// بلا أي خدمة وقت فعلي (Pusher)؛ اللوحة تسأل دورياً، وPusher إن وُجد يسرّع السؤال فقط.
import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema";

/** حد «مخزون منخفض» في اللوحة (نفس حد صفحة المنتجات). */
export const LOW_STOCK_MAX = 3;

export type AttentionCounts = {
  /** طلبات بحالة «جديد» لم يؤكدها التاجر بعد. */
  newOrders: number;
  /** طلبات تحتاج إجراء في صفحة الطلبات: جديدة أو بإيصال تحويل قيد المراجعة (بلا تكرار). */
  ordersToHandle: number;
  /** إيصالات تحويل بانتظار مراجعة التاجر. */
  receipts: number;
  /** تقييمات العملاء بانتظار الاعتماد. */
  pendingReviews: number;
  /** منتجات منشورة نفد مخزونها بالكامل. */
  outOfStock: number;
  /** منتجات منشورة بقي منها 1 إلى LOW_STOCK_MAX. */
  lowStock: number;
  /** منتجات متاحة نفدت منها تركيبة مقاس/لون واحدة على الأقل. */
  variantsOut: number;
  /** سلات متروكة برقم موبايل خلال 7 أيام لم يُتواصل معها ولم تتحول لطلب. */
  abandoned: number;
};

export type ArrivedOrder = {
  id: string;
  code: string;
  customerName: string;
  totalPiasters: number;
  governorate: string;
  createdAt: string;
};

export type AttentionSnapshot = {
  /** وقت الخادم عند بدء الفحص؛ يُرسل في الفحص التالي كـ since. */
  at: string;
  counts: AttentionCounts;
  /** الطلبات التي وصلت بعد since (الأحدث أولاً، حتى 5). فارغة في أول فحص. */
  arrived: ArrivedOrder[];
};

/** هامش يغطي طلباً كُتب أثناء الفحص السابق؛ التكرار يُصفّى في المتصفح بمعرّف الطلب. */
const OVERLAP_MS = 10_000;

export async function attentionCounts(storeId: string): Promise<AttentionCounts> {
  const db = await getTenantDb(storeId);
  const res = await db.execute(sql`
    select
      (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false and o.status = 'new') as new_orders,
      (select count(*) from orders o where o.store_id = ${storeId} and o.is_test = false
         and (o.status = 'new' or (o.payment_status = 'under_review' and o.status not in ('cancelled','returned')))) as orders_to_handle,
      (select count(*) from orders o where o.store_id = ${storeId} and o.payment_status = 'under_review'
         and o.status not in ('cancelled','returned')) as receipts,
      (select count(*) from reviews r where r.store_id = ${storeId} and r.is_approved = false) as pending_reviews,
      (select count(*) from products p where p.store_id = ${storeId} and p.deleted_at is null and p.status = 'active'
         and p.track_stock = true and coalesce(p.stock, 0) <= 0) as out_of_stock,
      (select count(*) from products p where p.store_id = ${storeId} and p.deleted_at is null and p.status = 'active'
         and p.track_stock = true and p.stock between 1 and ${LOW_STOCK_MAX}) as low_stock,
      (select count(distinct v.product_id) from product_variants v
         join products p on p.id = v.product_id and p.store_id = ${storeId}
         where v.store_id = ${storeId} and p.deleted_at is null and p.status = 'active' and p.track_stock = true
           and coalesce(p.stock, 0) > 0 and v.is_available = true and coalesce(v.stock, 0) <= 0) as variants_out,
      (select count(*) from abandoned_carts c where c.store_id = ${storeId} and c.phone is not null
         and c.recovered_order_id is null and c.whatsapp_contacted_at is null
         and c.last_seen_at >= now() - interval '7 days') as abandoned
  `);
  const row = (res.rows?.[0] ?? {}) as Record<string, unknown>;
  const n = (k: string) => {
    const v = Number(row[k] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    newOrders: n("new_orders"),
    ordersToHandle: n("orders_to_handle"),
    receipts: n("receipts"),
    pendingReviews: n("pending_reviews"),
    outOfStock: n("out_of_stock"),
    lowStock: n("low_stock"),
    variantsOut: n("variants_out"),
    abandoned: n("abandoned"),
  };
}

export async function attentionSnapshot(storeId: string, since: Date | null): Promise<AttentionSnapshot> {
  const at = new Date();
  const db = await getTenantDb(storeId);
  const [counts, arrived] = await Promise.all([
    attentionCounts(storeId),
    since
      ? db
          .select({
            id: orders.id,
            code: orders.code,
            customerName: orders.customerName,
            totalPiasters: orders.totalPiasters,
            governorate: orders.governorate,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(
            and(
              eq(orders.storeId, storeId),
              eq(orders.isTest, false),
              gt(orders.createdAt, new Date(since.getTime() - OVERLAP_MS))
            )
          )
          .orderBy(desc(orders.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ]);
  return {
    at: at.toISOString(),
    counts,
    arrived: arrived.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
  };
}
