// transfer-tables.ts — جداول المتجر التي تنتقل من المنصة إلى مشروع التاجر الخاص، بترتيب
// يحترم المفاتيح الأجنبية. مشترك بين المنصة (التصدير) ومشروع التاجر (الاستيراد)، فلا يختلف
// الطرفان أبداً على اسم جدول أو ترتيبه.
import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as s from "@/db/schema";

export const TRANSFER_ORDER = [
  ["merchants", s.merchants],
  ["stores", s.stores],
  ["store_blueprints", s.storeBlueprints],
  ["store_snapshots", s.storeSnapshots],
  ["categories", s.categories],
  ["products", s.products],
  ["product_variants", s.productVariants],
  ["customers", s.customers],
  ["shipping_zones", s.shippingZones],
  ["discounts", s.discounts],
  ["orders", s.orders],
  ["order_items", s.orderItems],
  ["payments", s.payments],
  ["reviews", s.reviews],
  ["abandoned_carts", s.abandonedCarts],
  ["analytics_events", s.analyticsEvents],
  ["analytics_daily", s.analyticsDaily],
  ["support_threads", s.supportThreads],
  ["support_messages", s.supportMessages],
  ["marketing_campaigns", s.marketingCampaigns],
] as const satisfies readonly (readonly [string, PgTable])[];

export type TransferTable = (typeof TRANSFER_ORDER)[number][0];

export const TRANSFER_TABLE_NAMES: TransferTable[] = TRANSFER_ORDER.map(([n]) => n);

export function transferTable(name: string): PgTable | undefined {
  return TRANSFER_ORDER.find(([n]) => n === name)?.[1];
}

/** جداول لا تحتوي صوراً (لا داعي لفحصها عند جمع الوسائط). */
export const MEDIA_FREE_TABLES = new Set<string>(["analytics_events", "analytics_daily", "shipping_zones", "discounts", "abandoned_carts"]);

/** يستبدل روابط الصور القديمة (حساب المنصة) بنسخها الجديدة (حساب التاجر) في أي صفوف. */
export function rewriteMedia<T>(rows: T[], media: Record<string, string>): T[] {
  const pairs = Object.entries(media).filter(([a, b]) => a && b && a !== b);
  if (!pairs.length) return rows;
  let text = JSON.stringify(rows);
  for (const [from, to] of pairs) text = text.split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1));
  return JSON.parse(text) as T[];
}

/** صفوف وصلت عبر JSON: التواريخ نصوص، فتُعاد Date حتى يقبلها الإدراج. */
export function reviveRows(table: PgTable, rows: unknown[]): Record<string, unknown>[] {
  const dates = Object.entries(getTableColumns(table))
    .filter(([, c]) => c.dataType === "date")
    .map(([k]) => k);
  return (rows as Record<string, unknown>[]).map((r) => {
    const out = { ...r };
    for (const k of dates) if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
    return out;
  });
}
