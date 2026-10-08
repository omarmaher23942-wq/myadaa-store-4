import type { Metadata } from "next";
import { Moon, CreditCard } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { requireStore, getBlueprint } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { shippingZones } from "@/db/schema";
import { CheckoutForm } from "@/components/storefront/CheckoutForm";

const SW = 1.75;

export const metadata: Metadata = { title: "إتمام الطلب", robots: { index: false, follow: false } };

function Notice({ icon: Icon, text }: { icon: typeof Moon; text: string }) {
  return (
    <div className="surface p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
        <Icon strokeWidth={SW} className="size-6" />
      </span>
      <p className="mt-4 text-xl">{text}</p>
    </div>
  );
}

export default async function CheckoutPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: sub } = await params;
  const store = await requireStore(sub);
  const bp = await getBlueprint(store.id);
  const anyPayment = bp.payments.cod.enabled || bp.payments.vodafoneCash.enabled || bp.payments.instapay.enabled;
  const db = await getTenantDb(store.id);
  const zones = await db
    .select({ code: shippingZones.governorate, fee: shippingZones.feePiasters, etaMin: shippingZones.etaMinDays, etaMax: shippingZones.etaMaxDays, cod: shippingZones.codExtraPiasters })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.isActive, true)));

  return (
    <div className="container-x max-w-5xl py-8">
      <h1 className="mb-6 text-3xl">إتمام الطلب</h1>
      {!store.acceptingOrders ? (
        <Notice icon={Moon} text={store.vacationMessage ?? "المتجر في إجازة قصيرة وسنعود قريبًا"} />
      ) : !anyPayment ? (
        <Notice icon={CreditCard} text="استقبال الطلبات متوقف مؤقتًا، تواصل معنا من صفحتنا لإتمام طلبك" />
      ) : (
        <CheckoutForm
          subdomain={store.subdomain}
          payments={bp.payments}
          remember={bp.conversion.rememberCustomer}
          zones={zones}
          policy={{
            flatPiasters: bp.shipping.flatRatePiasters,
            freeOverPiasters: bp.shipping.freeOverPiasters,
            generalEta: bp.shipping.generalEta,
            inspectionAllowed: bp.shipping.inspectionAllowed,
            returnDays: bp.returns.allowExchange || bp.returns.allowRefund ? bp.returns.windowDays : 0,
          }}
        />
      )}
    </div>
  );
}
