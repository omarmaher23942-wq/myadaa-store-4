// dashboard/discounts/page.tsx — أكواد الخصم وأثر كل كود من الطلبات.
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { listDiscounts } from "@/server/repos/discounts-list";
import { DiscountsManager } from "@/components/dashboard/discounts/DiscountsManager";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";
export const metadata = { title: "أكواد الخصم" };

export default async function DiscountsPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/discounts");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  const rows = await listDiscounts(session.storeId);
  return (
    <div className="mx-auto max-w-5xl">
      <DiscountsManager rows={rows} subdomain={session.store.subdomain} storeName={session.store.name} />
    </div>
  );
}
