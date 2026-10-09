// dashboard/shipping/page.tsx — الشحن: طريقة الحساب، والشحن المجاني، وجدول المحافظات (كما يحسبه الدفع فعلاً).
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { shippingZones } from "@/db/schema";
import { ensureShippingZones } from "@/server/repos/shipping";
import { ShippingSettings, type ShippingState } from "@/components/dashboard/shipping/ShippingSettings";
import { getBlueprint } from "@/lib/tenant";
import { GOVERNORATES, DEFAULT_SHIPPING_BY_GROUP } from "@/lib/egypt";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";
export const metadata = { title: "الشحن" };

const egp = (p: number) => String(p / 100);

export default async function ShippingPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/shipping");
  if (!session.storeId) redirect(NO_STORE_HREF);
  await ensureShippingZones(session.storeId);
  const db = await getTenantDb(session.storeId);
  const [rows, bp] = await Promise.all([db.select().from(shippingZones).where(eq(shippingZones.storeId, session.storeId)), getBlueprint(session.storeId)]);

  const byGov = new Map(rows.map((z) => [z.governorate, z]));
  const initial: ShippingState = {
    // كل المحافظات بالترتيب نفسه دائماً؛ أي محافظة ناقصة من الجدول تُعرض بقيمها الافتراضية (وتُحفظ عند الحفظ).
    zones: GOVERNORATES.map((g) => {
      const z = byGov.get(g.code);
      const d = DEFAULT_SHIPPING_BY_GROUP[g.group];
      return {
        governorate: g.code,
        fee: egp(z?.feePiasters ?? d.fee),
        codExtra: egp(z?.codExtraPiasters ?? 0),
        etaMin: String(z?.etaMinDays ?? d.etaMin),
        etaMax: String(z?.etaMaxDays ?? d.etaMax),
        isActive: z?.isActive ?? true,
      };
    }),
    mode: bp.shipping.flatRatePiasters !== null ? "flat" : "zones",
    flatRate: bp.shipping.flatRatePiasters !== null ? egp(bp.shipping.flatRatePiasters) : "",
    freeOn: bp.shipping.freeOverPiasters !== null,
    freeOver: bp.shipping.freeOverPiasters !== null ? egp(bp.shipping.freeOverPiasters) : "",
    generalEta: bp.shipping.generalEta,
  };

  return (
    <div className="mx-auto max-w-4xl">
      <ShippingSettings initial={initial} />
    </div>
  );
}
