// dashboard/policies — سياسات المتجر (الاستبدال، المعيب، المعاينة، الشحن المجاني، الاستلام) بمعاينة حية.
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { getBlueprint } from "@/lib/tenant";
import { storeUrl } from "@/lib/utils";
import { NO_STORE_HREF } from "@/lib/edition";
import { PoliciesEditor } from "@/components/dashboard/policies/PoliciesEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "السياسات والضمان" };

export default async function PoliciesPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/policies");
  if (!session.store) redirect(NO_STORE_HREF);
  const bp = await getBlueprint(session.store.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">السياسات والضمان</h1>
        <p className="mt-1 text-[13px] text-ink-2">ما تختاره هنا هو ما يُكتب في صفحات متجرك وما يُعِد به عملاءك، لا أكثر ولا أقل.</p>
      </header>
      <PoliciesEditor bp={bp} storeUrl={storeUrl(session.store.subdomain)} />
    </div>
  );
}
