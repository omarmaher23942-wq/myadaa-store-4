"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";

/** عدد الطلبات الجديدة في متجر التاجر منذ لحظة معيّنة (لإشعار الطلبات في الداشبورد). */
export async function newOrdersSinceAction(sinceIso: string): Promise<number> {
  const s = await getMerchantStoreOrNull();
  if (!s) return 0;
  const db = await getTenantDb(s.storeId);
  const since = new Date(sinceIso);
  if (Number.isNaN(since.getTime())) return 0;

  const [row] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
    .where(and(eq(orders.storeId, s.storeId), gt(orders.createdAt, since)));
  return row?.c ?? 0;
}
