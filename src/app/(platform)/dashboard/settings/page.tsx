// dashboard/settings/page.tsx — صفحة الإعدادات.
//
// التعديلات الجذرية (موجة 3):
//  1) Server-side prep لبيانات التاجر والمتجر و QR.
//  2) تمرير حزمة واحدة نظيفة لـ SettingsForm.
//  3) Fallback آمن عند غياب المتجر أو الفشل.
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getMerchantSession } from "@/server/auth";
import { getBlueprint } from "@/lib/tenant";
import { storeUrl } from "@/lib/utils";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الإعدادات",
  description: "إدارة الحساب، المتجر، الدفع، والتواصل",
};

export default async function DashboardSettingsPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/settings");

  const merchant = session.merchant;
  const store = session.store;

  let bp = null;
  let url = "";
  let qr = "";

  if (store) {
    try {
      bp = await getBlueprint(store.id);
      url = storeUrl(store.subdomain);
      qr = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: { dark: "#07091a", light: "#ffffff" },
      });
    } catch {
      bp = null;
    }
  }

  return (
    <SettingsForm
      merchant={{
        id: merchant.id,
        displayName: merchant.displayName,
        email: merchant.email,
        phone: merchant.phone,
        avatarUrl: merchant.avatarUrl,
        isActivated: merchant.isActivated,
      }}
      store={
        store
          ? {
              id: store.id,
              name: store.name,
              subdomain: store.subdomain,
              status: store.status,
              acceptingOrders: store.acceptingOrders,
              vacationMessage: store.vacationMessage,
              showcaseOptIn: store.showcaseOptIn,
            }
          : null
      }
      bp={bp}
      url={url}
      qr={qr}
    />
  );
}