// dashboard/page.tsx — «نظرة عامة»: ما ينتظر التاجر الآن، ثم أداء الفترة المختارة (7/30/90 يوماً) مقارنةً
// بالفترة المساوية قبلها، والأرباح، وأحدث الطلبات، وجاهزية المتجر، والسلات المتروكة، وملاحظات من أرقامه.
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Percent, Plus, ShoppingCart, Sparkles, Wallet } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { EmptyStoreState } from "@/components/dashboard/EmptyStoreState";
import { TrialCountdownCard } from "@/components/dashboard/TrialCountdownCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AttentionStrip } from "@/components/dashboard/overview/AttentionStrip";
import { AbandonedCarts } from "@/components/dashboard/overview/AbandonedCarts";
import {
  EarningsCard,
  NotesCard,
  RangeTabs,
  ReadinessCard,
  RecentOrdersCard,
  TopProductsCard,
  readinessItems,
} from "@/components/dashboard/overview/OverviewCards";
import { buildNotes } from "@/components/dashboard/overview/notes";
import { overviewData, pctChange, OVERVIEW_RANGES, type OverviewRange } from "@/server/repos/overview";
import { merchantAiStatus } from "@/ai/merchant";
import { EDITION, INTEGRATIONS_NAV } from "@/lib/edition";
import { getBlueprintOrNull } from "@/lib/tenant";
import { formatEgp } from "@/lib/money";
import { fmtDec, fmtNum } from "@/lib/format";
import { readRequestId } from "@/lib/correlation";

export const dynamic = "force-dynamic";
export const metadata = { title: "نظرة عامة" };

const PLAN_PRICE_EGP = Number(process.env.PLATFORM_PRICE_EGP ?? process.env.NEXT_PUBLIC_PLATFORM_PRICE ?? 899);

type SearchParams = { onboarding?: string; reason?: string; range?: string };

export default async function DashboardHomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getMerchantSession();
  if (!session) return null;
  const params = await searchParams;

  if (!session.store) {
    const isError = params.onboarding === "error";
    return (
      <EmptyStoreState
        merchantName={session.merchant.displayName}
        errorReason={isError ? (params.reason ?? "unknown") : null}
        correlationId={isError ? await readRequestId() : null}
      />
    );
  }

  const store = session.store;
  const range = (OVERVIEW_RANGES as number[]).includes(Number(params.range)) ? (Number(params.range) as OverviewRange) : 30;
  const showTrial = store.status !== "active" && store.demoExpiresAt !== null && EDITION === "platform";
  const ai = await merchantAiStatus(store).catch(() => null);

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      {ai?.mode === "needs_key" ? (
        <Link
          href={INTEGRATIONS_NAV.href}
          className="dash-card group flex items-center gap-4 border-nova/30 p-4 transition hover:border-nova/50"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-nova to-aurora text-white shadow-lg">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-black text-ink">فعّل الذكاء الاصطناعي في لوحتك</span>
            <span className="block text-[12px] leading-6 text-ink-2">
              أضف مفتاح Groq المجاني (دقيقة واحدة) ليكتب لك أوصاف المنتجات ويجيبك مساعدك نوفا من بيانات متجرك.
            </span>
          </span>
          <ArrowLeft className="size-4 shrink-0 text-ink-3 transition group-hover:-translate-x-1" aria-hidden="true" />
        </Link>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">نظرة عامة</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">أداء {store.name} مقارنةً بالفترة المساوية التي قبلها.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs active={range} />
          <Link
            href="/dashboard/products/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2"
          >
            <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
            منتج جديد
          </Link>
        </div>
      </header>

      {showTrial && store.demoExpiresAt ? (
        <TrialCountdownCard
          expiresAt={store.demoExpiresAt.toISOString()}
          startedAt={(store.demoStartedAt ?? store.deliveredAt)?.toISOString() ?? null}
          serverNow={Date.now()}
          planPrice={PLAN_PRICE_EGP}
        />
      ) : null}

      <AttentionStrip />

      <Suspense key={range} fallback={<OverviewSkeleton />}>
        <OverviewBody storeId={store.id} storeName={store.name} range={range} />
      </Suspense>
    </div>
  );
}

async function OverviewBody({ storeId, storeName, range }: { storeId: string; storeName: string; range: OverviewRange }) {
  const [data, bp] = await Promise.all([overviewData(storeId, range), getBlueprintOrNull(storeId)]);
  const { current: c, previous: p, series } = data;
  const shareHref = EDITION === "store" ? "/" : "/dashboard/store";

  const conv = c.visitors > 0 ? (c.orders / c.visitors) * 100 : null;
  const prevConv = p.visitors > 0 ? (p.orders / p.visitors) * 100 : null;
  const convDelta = conv !== null && prevConv !== null ? Math.round((conv - prevConv) * 10) / 10 : null;
  // متوسط الطلب بالجنيه الصحيح (بلا قروش) لأنه رقم استرشادي.
  const aov = c.orders > 0 ? Math.round(c.sales / c.orders / 100) * 100 : 0;
  const trend = (d: number | null): "up" | "down" | "neutral" => (d === null || d === 0 ? "neutral" : d > 0 ? "up" : "down");

  const salesDelta = pctChange(c.sales, p.sales);
  const ordersDelta = pctChange(c.orders, p.orders);
  const visitsDelta = pctChange(c.visits, p.visits);

  const ready = readinessItems(
    {
      ...data.readiness,
      hasLogo: Boolean(bp?.brand.logo),
      hasContact: Boolean(bp?.channels.whatsappNumber || bp?.channels.phone),
    },
    shareHref
  );
  const readyDone = ready.every((i) => i.ok);

  const notes = buildNotes({
    days: range,
    current: c,
    previous: p,
    topProduct: data.topProducts[0] ? { name: data.topProducts[0].name, qty: data.topProducts[0].qty } : null,
    viewedNotBought: data.viewedNotBought,
    silentRepeat: data.silentRepeat,
    hasOrdersEver: data.readiness.hasOrders,
    shareHref,
  });

  return (
    <>
      <section aria-label="المؤشرات الرئيسية" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="المبيعات"
          value={formatEgp(c.sales)}
          hint={c.orders > 0 ? `متوسط الطلب ${formatEgp(aov)}` : undefined}
          icon={Wallet}
          delta={salesDelta}
          deltaType={trend(salesDelta)}
          sparkline={series.map((d) => d.sales)}
          href="/dashboard/analytics"
        />
        <KpiCard
          title="الطلبات"
          value={fmtNum(c.orders)}
          hint="بلا الملغاة والمرتجعة"
          icon={ShoppingCart}
          delta={ordersDelta}
          deltaType={trend(ordersDelta)}
          sparkline={series.map((d) => d.orders)}
          href="/dashboard/orders"
        />
        <KpiCard
          title="الزيارات"
          value={fmtNum(c.visits)}
          hint={`الزوار المختلفون: ${fmtNum(c.visitors)}`}
          icon={Eye}
          delta={visitsDelta}
          deltaType={trend(visitsDelta)}
          sparkline={series.map((d) => d.visits)}
          href="/dashboard/analytics"
        />
        <KpiCard
          title="معدل التحويل"
          value={conv === null ? "—" : `${fmtDec(conv)}%`}
          hint={conv === null ? "يظهر مع أول زيارات لمتجرك" : "من الزوار إلى طلب"}
          icon={Percent}
          delta={conv === null ? undefined : convDelta}
          deltaUnit="pt"
          deltaType={trend(convDelta)}
          href="/dashboard/analytics"
        />
      </section>

      <EarningsCard data={data} />

      <NotesCard notes={notes} />

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <RecentOrdersCard rows={data.recentOrders} />
        {readyDone ? <TopProductsCard rows={data.topProducts} days={range} /> : <ReadinessCard items={ready} />}
      </div>

      <AbandonedCarts
        storeName={storeName}
        rows={data.carts.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone ?? "",
          subtotal: r.subtotal,
          firstItem: r.items[0]?.name ?? null,
          itemsCount: r.items.length,
          lastSeenAt: r.lastSeenAt.toISOString(),
          contacted: r.contactedAt !== null,
        }))}
      />

      {!readyDone && data.topProducts.length > 0 ? <TopProductsCard rows={data.topProducts} days={range} /> : null}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="جارٍ تحميل الأرقام">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-edge/[0.04]" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-edge/[0.04]" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-edge/[0.04] lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl bg-edge/[0.04]" />
      </div>
    </div>
  );
}
