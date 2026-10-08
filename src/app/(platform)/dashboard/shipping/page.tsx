import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { shippingZones } from "@/db/schema";
import { ensureShippingZones } from "@/server/repos/shipping";
import { ShippingEditor } from "@/components/dashboard/ShippingEditor";
import { getBlueprint } from "@/lib/tenant";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";
export const metadata = { title: "الشحن" };

export default async function ShippingPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/shipping");
  if (!session.storeId) redirect(NO_STORE_HREF);
  const db = await getTenantDb(session.storeId!);

  await ensureShippingZones(session.storeId);

  const [rows, bp] = await Promise.all([
    db
      .select()
      .from(shippingZones)
      .where(eq(shippingZones.storeId, session.storeId)),
    getBlueprint(session.storeId),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">الشحن والدفع</h1>
        <p className="mt-1 text-xs text-ink-3">
          اضبط أسعار الشحن لـ 27 محافظة ورسوم الدفع عند الاستلام
        </p>
      </header>

      <ShippingEditor
        bp={bp}
        rows={rows.map((z) => ({
          governorate: z.governorate,
          fee: z.feePiasters / 100,
          codExtra: z.codExtraPiasters / 100,
          etaMin: z.etaMinDays,
          etaMax: z.etaMaxDays,
          isActive: z.isActive,
        }))}
      />
    </div>
  );
}