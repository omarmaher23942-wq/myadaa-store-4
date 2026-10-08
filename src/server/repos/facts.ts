import "server-only";
// حقائق المتجر عند العرض: من الـ Blueprint الحالي + مناطق الشحن المفعّلة فعلاً في قاعدة المتجر.
// cache من React: استعلام واحد لكل طلب مهما استدعتها أجزاء الصفحة.
import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { shippingZones } from "@/db/schema";
import { storeFacts, type StoreFact } from "@/blueprint/facts";
import type { StoreBlueprint } from "@/blueprint/schema";

const coverage = cache(async (storeId: string) => {
  try {
    const db = await getTenantDb(storeId);
    const [row] = await db
      .select({ n: sql<number>`count(*)::int`, fastest: sql<number | null>`min(${shippingZones.etaMaxDays})` })
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.isActive, true)));
    return { activeGovernorates: Number(row?.n ?? 0) || undefined, fastestDays: row?.fastest ?? undefined };
  } catch {
    return {};
  }
});

export async function getStoreFacts(storeId: string, bp: StoreBlueprint): Promise<StoreFact[]> {
  return storeFacts(bp, await coverage(storeId));
}
