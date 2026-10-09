// C:\Users\ahmed maher\Desktop\colapia\src\app\(platform)\dashboard\layout.tsx — غلاف الداشبورد الكوني (v2).
//
// التعديلات الجذرية (موجة 3 + موجة 5):
//  1) RealtimeProvider مُركّب مرة واحدة على مستوى الـ layout → لا اتصالات مكررة.
//  2) CommandPalette متاح عالمياً (⌘K).
//  3) OnboardingTour يظهر للتاجر الجديد (أول 7 أيام أو أول 3 زيارات).
//  4) Skip-to-content link للأكيسيبيليتي.
//  5) Mobile bottom nav على < md (في Sidebar).
//  6) Theme toggle عبر next-themes (light/dark/auto).
//  7) RealtimeSoundManager مُدمج داخل RealtimeProvider (موجة 5).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getMerchantSession } from "@/server/auth";
import { RealtimeProvider } from "@/components/dashboard/RealtimeProvider";
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

function computeTrialDaysLeft(demoExpiresAt: Date | null): number | null {
  if (!demoExpiresAt) return null;
  const ms = demoExpiresAt.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

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

  const trialDaysLeft = session.store
    ? computeTrialDaysLeft(session.store.demoExpiresAt ?? null)
    : null;

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

      <RealtimeProvider
        merchantId={session.merchantId}
        storeId={session.storeId}
      >
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
                    name: session.store.name,
                    subdomain: session.store.subdomain,
                    status: session.store.status,
                  }
                : null
            }
            badges={{
              orders: 0,
              trialDaysLeft,
            }}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <DashboardTopbar
              merchantName={session.merchant.displayName}
              merchantEmail={session.merchant.email}
              merchantAvatarUrl={session.merchant.avatarUrl}
              storeStatus={session.store?.status ?? null}
              notificationCount={0}
              theme={theme}
            />

            <main
              id="dashboard-main"
              className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8"
            >
              {children}
            </main>
          </div>
        </div>

        {/* Command Palette — متاح عالمياً بـ ⌘K */}
        <CommandPalette storeHref={session.store ? storeUrl(session.store.subdomain) : null} />

        {/* المساعد الذكي نوفا — يجيب من بيانات المتجر (Ctrl+J) */}
        {session.store ? <Copilot storeName={session.store.name} /> : null}

        {/* Onboarding Tour — للتاجر الجديد فقط */}
        {showTour ? <OnboardingTour /> : null}
      </RealtimeProvider>
    </div>
  );
}