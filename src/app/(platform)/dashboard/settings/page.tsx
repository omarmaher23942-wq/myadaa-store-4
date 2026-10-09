// dashboard/settings — الإعدادات: الدفع والتواصل واستقبال الطلبات ورابط المتجر وكود QR، وحسابك.
// الإعدادات تُقرأ من القاعدة مباشرة (لا من كاش المتجر) لتعرض آخر ما حُفظ من أي صفحة.
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getMerchantSession } from "@/server/auth";
import { db } from "@/db/client";
import { storeBlueprints } from "@/db/schema";
import { blueprintSchema } from "@/blueprint/schema";
import { storeUrl } from "@/lib/utils";
import { draftFrom } from "@/lib/store-settings";
import { SettingsPage, type SettingsTab } from "@/components/dashboard/settings/SettingsPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "الإعدادات" };

const TABS: SettingsTab[] = ["store", "payments", "contact", "account"];

export default async function DashboardSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/settings");
  const { tab } = await searchParams;
  const store = session.store;

  let info = null;
  let settings = null;
  if (store) {
    const [row] = await db.select({ data: storeBlueprints.data }).from(storeBlueprints).where(eq(storeBlueprints.storeId, store.id)).limit(1);
    const bp = row ? blueprintSchema.safeParse(row.data) : null;
    if (bp?.success) {
      const url = storeUrl(store.subdomain);
      info = {
        name: store.name,
        subdomain: store.subdomain,
        status: store.status,
        url,
        qr: await QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#07091a", light: "#ffffff" } }),
      };
      settings = draftFrom(bp.data, store);
    }
  }

  return (
    <SettingsPage
      initialTab={TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : "store"}
      store={info}
      settings={settings}
      account={{ displayName: session.merchant.displayName, email: session.merchant.email, phone: session.merchant.phone, avatarUrl: session.merchant.avatarUrl }}
    />
  );
}
