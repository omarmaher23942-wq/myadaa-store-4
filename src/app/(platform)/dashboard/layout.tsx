// dashboard/layout.tsx — غلاف لوحة التاجر: القائمة، والشريط العلوي، ونبض اللوحة (الشارات وتنبيه الطلب الجديد)،
// ولوحة الأوامر (Ctrl/⌘+K)، والمساعد نوفا، وجولة التاجر الجديد.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getMerchantSession } from "@/server/auth";
import { DashboardPulse } from "@/components/dashboard/DashboardPulse";
import { attentionCounts } from "@/server/repos/attention";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { Copilot } from "@/components/dashboard/Copilot";
import { DASH_THEME_COOKIE } from "@/lib/dash-theme";
import { readRequestId } from "@/lib/correlation";
import { log } from "@/lib/logger";
import { DASHBOARD_TITLE_TEMPLATE, EDITION } from "@/lib/edition";
import { storeUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: DASHBOARD_TITLE_TEMPLATE },
  description: "إدارة متجرك، طلباتك، وعملائك من مكان واحد.",
};

export const dynamic = "force-dynamic";

function isNewMerchant(merchantCreatedAt: Date | null): boolean {
  if (!merchantCreatedAt) return false;
  const age = Date.now() - merchantCreatedAt.getTime();
  return age < 7 * 86_400_000;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqId = await readRequestId();
  const session = await getMerchantSession();

  if (!session) {
    log.info("auth", "dashboard_unauthorized_redirect", { reqId });
    redirect("/login?redirect=/dashboard&reason=no_session");
  }

  // متجر استلمه صاحبه: لوحة المنصة لم تعد مكان إدارته، فكل صفحاتها تحوّل لصفحة "امتلك متجرك".
  if (EDITION === "platform" && session.store?.ownedAt) {
    const path = (await headers()).get("x-pathname") ?? "";
    if (!path.startsWith("/dashboard/own")) redirect("/dashboard/own");
  }

  // بعد الاستلام تبقى صفحة واحدة فقط بلا قائمة ولا أدوات: روابط موقعه الجديد وطرق استرجاع الدخول.
  if (EDITION === "platform" && session.store?.ownedAt) {
    const jar0 = await cookies();
    const theme0 = jar0.get(DASH_THEME_COOKIE)?.value === "light" ? "light" : "dark";
    return (
      <div dir="rtl" className={`dash dash-cosmos min-h-dvh text-ink ${theme0 === "dark" ? "dark" : ""}`}>
        <main id="dashboard-main" className="min-w-0 p-4 py-10 md:p-10">
          {children}
        </main>
      </div>
    );
  }

  // أعداد «ما يحتاج انتباهك» من الخادم مع أول رسم، فلا تومض الشارات من صفر.
  const pulseAt = new Date().toISOString();
  const pulse = session.storeId ? await attentionCounts(session.storeId).catch(() => null) : null;

  // فحص tour الدخول الأول: نستخدم cookie لمنع التكرار المزعج.
  const jar = await cookies();
  const tourSeen = jar.get("clp_tour_v2_seen")?.value === "1";
  const theme = jar.get(DASH_THEME_COOKIE)?.value === "light" ? "light" : "dark";
  const showTour =
    !tourSeen &&
    (isNewMerchant(session.merchant.createdAt) || session.store === null);

  return (
    <div dir="rtl" className={`dash dash-cosmos min-h-dvh text-ink ${theme === "dark" ? "dark" : ""}`}>
      {/* Skip-to-content — يظهر عند focus فقط */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[100] focus:rounded-lg focus:bg-nova focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-edge/40"
      >
        تخطي إلى المحتوى الرئيسي
      </a>

      <DashboardPulse storeId={session.storeId} initial={pulse} initialAt={pulseAt}>
        <div className="flex min-h-dvh">
          <DashboardSidebar
            merchant={{
              displayName: session.merchant.displayName,
              email: session.merchant.email,
              avatarUrl: session.merchant.avatarUrl,
            }}
            store={
              session.store
                ? {
                    id: session.store.id,
                    name: session.store.name,
                    subdomain: session.store.subdomain,
                    status: session.store.status,
                  }
                : null
            }
            allStores={session.stores.map((s) => ({ id: s.id, name: s.name, subdomain: s.subdomain, status: s.status }))}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <DashboardTopbar
              merchantName={session.merchant.displayName}
              merchantEmail={session.merchant.email}
              merchantAvatarUrl={session.merchant.avatarUrl}
              storeStatus={session.store?.status ?? null}
              acceptingOrders={session.store?.acceptingOrders ?? true}
              theme={theme}
            />

            <main
              id="dashboard-main"
              className="min-w-0 flex-1 p-4 pb-40 md:p-8 md:pb-28"
            >
              {children}
            </main>
          </div>
        </div>

        {/* Command Palette — متاح عالمياً بـ ⌘K */}
        <CommandPalette storeHref={session.store ? storeUrl(session.store.subdomain) : null} hasStore={Boolean(session.store)} />

        {/* المساعد الذكي نوفا — يجيب من بيانات المتجر (Ctrl+J) */}
        {session.store ? <Copilot storeName={session.store.name} /> : null}

        {/* Onboarding Tour — للتاجر الجديد فقط */}
        <OnboardingTour autoOpen={showTour} />
      </DashboardPulse>
    </div>
  );
}