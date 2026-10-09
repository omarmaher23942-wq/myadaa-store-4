// dashboard-search.ts — بحث لوحة الأوامر: طلب بكوده أو موبايل العميل أو اسمه، ومنتج باسمه (بالتطبيع العربي
// والفرانكو نفسه الذي يستخدمه بحث المتجر)، وعميل باسمه أو رقمه. كل استعلام محصور في متجر التاجر.
import "server-only";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { customers, orders, products } from "@/db/schema";
import { normalizeArabic, normalizeQuery } from "@/lib/arabic";

export type SearchHit =
  | { kind: "order"; id: string; title: string; sub: string; totalPiasters: number; status: string }
  | { kind: "product"; id: string; title: string; sub: string; pricePiasters: number; image: string | null; status: string }
  | { kind: "customer"; id: string; title: string; sub: string; ordersCount: number };

const PER_KIND = 5;

/** يهرب محارف LIKE حتى يُبحث عن النص كما كُتب. */
const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function dashboardSearch(storeId: string, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 60);
  if (q.length < 2) return [];
  const db = await getTenantDb(storeId);

  const text = `%${likeSafe(q)}%`;
  const digits = normalizeArabic(q).replace(/\D/g, "");
  const phone = digits.length >= 4 ? `%${likeSafe(digits)}%` : null;
  const nq = normalizeQuery(q);

  const [orderRows, productRows, customerRows] = await Promise.all([
    db
      .select({
        id: orders.id,
        code: orders.code,
        name: orders.customerName,
        phone: orders.customerPhone,
        total: orders.totalPiasters,
        status: orders.status,
      })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, storeId),
          or(ilike(orders.code, text), ilike(orders.customerName, text), phone ? ilike(orders.customerPhone, phone) : undefined)
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(PER_KIND),
    nq
      ? db
          .select({
            id: products.id,
            name: products.name,
            price: products.pricePiasters,
            images: products.images,
            status: products.status,
            stock: products.stock,
            trackStock: products.trackStock,
          })
          .from(products)
          .where(
            and(
              eq(products.storeId, storeId),
              isNull(products.deletedAt),
              or(
                sql`${products.searchText} ILIKE ${`%${likeSafe(nq)}%`}`,
                sql`${products.searchText} % ${nq}`,
                ilike(products.sku, text)
              )
            )
          )
          .orderBy(sql`similarity(coalesce(${products.searchText}, ''), ${nq}) desc`)
          .limit(PER_KIND)
      : Promise.resolve([]),
    db
      .select({ id: customers.id, name: customers.name, phone: customers.phone, ordersCount: customers.ordersCount })
      .from(customers)
      .where(and(eq(customers.storeId, storeId), or(ilike(customers.name, text), phone ? ilike(customers.phone, phone) : undefined)))
      .orderBy(desc(customers.ordersCount))
      .limit(PER_KIND),
  ]);

  return [
    ...orderRows.map((o) => ({
      kind: "order" as const,
      id: o.id,
      title: o.code,
      sub: `${o.name} · ${o.phone}`,
      totalPiasters: o.total,
      status: o.status,
    })),
    ...productRows.map((p) => ({
      kind: "product" as const,
      id: p.id,
      title: p.name,
      sub: p.trackStock ? (p.stock && p.stock > 0 ? `المخزون: ${p.stock}` : "نفد المخزون") : "بلا تتبع مخزون",
      pricePiasters: p.price,
      image: p.images?.[0]?.url ?? null,
      status: p.status,
    })),
    ...customerRows.map((c) => ({
      kind: "customer" as const,
      id: c.id,
      title: c.name,
      sub: c.phone,
      ordersCount: c.ordersCount,
    })),
  ];
}
