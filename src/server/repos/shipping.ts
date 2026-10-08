import "server-only";
import { eq } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { shippingZones } from "@/db/schema";
import { defaultShippingZones } from "@/lib/egypt";

/** يُنشئ جدول الشحن الافتراضي (27 محافظة) لمتجر لا يملك أي منطقة بعد. */
export async function ensureShippingZones(storeId: string) {
  const db = await getTenantDb(storeId);
  const existing = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(eq(shippingZones.storeId, storeId))
    .limit(1);
  if (existing.length) return;
  await db
    .insert(shippingZones)
    .values(defaultShippingZones().map((z) => ({ ...z, storeId })))
    .onConflictDoNothing();
}
