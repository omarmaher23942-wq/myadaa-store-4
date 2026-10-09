// dashboard/page.tsx — الصفحة الرئيسية للداشبورد (v4).
import { Suspense } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Wallet,
  Users,
  Eye,
  Plus,
  ArrowLeft,
  Inbox,
  Sparkles,
  Package,
  BarChart3,
  MessageCircle,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { EmptyStoreState } from "@/components/dashboard/EmptyStoreState";
import { TrialCountdownCard } from "@/components/dashboard/TrialCountdownCard";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { HealthScore } from "@/components/dashboard/HealthScore";
import { NewOrderNotifier } from "@/components/dashboard/NewOrderNotifier";
import { AIInsightsPanel } from "@/components/dashboard/AIInsightsPanel";
// ↓ التعديل: استيراد من lib/insights (server-safe) بدل client component
import { generateInsights } from "@/lib/insights";
import { dashboardStats } from "@/server/repos/analytics";
import { merchantAiStatus } from "@/ai/merchant";
import { INTEGRATIONS_NAV } from "@/lib/edition";
import { getBlueprintOrNull } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { orders, products, reviews } from "@/db/schema";
import { and, eq, sql, gte, isNull, desc, lt } from "drizzle-orm";
import { formatEgp } from "@/lib/money";
import { readRequestId } from "@/lib/correlation";

const PLAN_PRICE_EGP = Number(process.env.NEXT_PUBLIC_PLATFORM_PRICE ?? 899);

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  returned: "مُرتجع",
};

type DashboardSearchParams = {
  onboarding?: string;
  reason?: string;
};

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const session = await getMerchantSession();
  if (!session) return null;

  if (!session.store) {
    const params = await searchParams;
    const isError = params.onboarding === "error";
    const reqId = isError ? await readRequestId() : null;
    return (
      <EmptyStoreState
        merchantName={session.merchant.displayName}
        errorReason={isError ? (params.reason ?? "unknown") : null}
        correlationId={reqId}
      />
    );
  }

  const store = session.store;
  const showTrial =
    store.status !== "active" &&
    store.demoExpiresAt !== null &&
    store.demoExpiresAt.getTime() > Date.now();

  const ai = await merchantAiStatus(store).catch(() => null);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <NewOrderNotifier />

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
            <span className="block text-[12px] leading-6 text-ink-2">أضف مفتاح Groq المجاني (دقيقة واحدة) ليكتب لك أوصاف المنتجات ويجيبك مساعدك نوفا من بيانات متجرك.</span>
          </span>
          <ArrowLeft className="size-4 shrink-0 text-ink-3 transition group-hover:-translate-x-1" aria-hidden="true" />
        </Link>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            نظرة عامة
          </h1>
          <p className="mt-1 text-xs text-ink-3">
            ملخص أداء {store.name} خلال آخر 30 يوماً.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/analytics"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
          >
            <BarChart3 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            <span>التحليلات</span>
          </Link>
          <Link
            href="/dashboard/products/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-3.5 text-xs font-black text-white shadow-md transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2"
          >
            <Plus className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            <span>منتج جديد</span>
          </Link>
        </div>
      </header>

      {showTrial && store.demoExpiresAt ? (
        <TrialCountdownCard
          expiresAt={store.demoExpiresAt.toISOString()}
          storeName={store.name}
          planPrice={PLAN_PRICE_EGP}
        />
      ) : null}

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData
          storeId={store.id}
          merchantCreatedAt={session.merchant.createdAt}
        />
      </Suspense>
    </div>
  );
}

// ─── Data loader ───────────────────────────────────────────────────────────
async function DashboardData({
  storeId,
  merchantCreatedAt,
}: {
  storeId: string;
  merchantCreatedAt: Date;
}) {
  const db = await getTenantDb(storeId);
  const stats = await dashboardStats(storeId, 30);

  const now = new Date();
  const prev30 = new Date(now.getTime() - 60 * 86_400_000);
  const last30 = new Date(now.getTime() - 30 * 86_400_000);
  const silentVipCutoff = new Date(now.getTime() - 60 * 86_400_000);

  const [
    prevRevenueRow,
    lowStockCountRow,
    pendingReviewsRow,
    vipSilentRow,
    topViewedRow,
  ] = await Promise.all([
    db
      .select({
        sum: sql<number>`coalesce(sum(${orders.totalPiasters}) filter (where ${orders.status} not in ('cancelled','returned')), 0)`.mapWith(Number),
        count: sql<number>`count(*) filter (where ${orders.status} not in ('cancelled','returned'))`.mapWith(Number),
      })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, storeId),
          gte(orders.createdAt, prev30),
          lt(orders.createdAt, last30)
        )
      ),

    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          eq(products.trackStock, true),
          eq(products.status, "active"),
          isNull(products.deletedAt),
          sql`${products.stock} <= 3`
        )
      ),

    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(reviews)
      .where(and(eq(reviews.storeId, storeId), eq(reviews.isApproved, false))),

    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(
        sql<{ id: string }>`(
          select c.id from customers c
          where c.store_id = ${storeId}
          and c.orders_count >= 3
          and (c.last_order_at is null or c.last_order_at < ${silentVipCutoff.toISOString()})
        ) as customers`
      ),

    db
      .select({
        id: products.id,
        name: products.name,
        views: products.viewCount,
        orders: products.orderCount,
      })
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          eq(products.status, "active"),
          isNull(products.deletedAt),
          sql`${products.viewCount} >= 50`,
          sql`${products.orderCount} = 0`
        )
      )
      .orderBy(desc(products.viewCount))
      .limit(1),
  ]);

  const prevRevenue = prevRevenueRow[0]?.sum ?? 0;
  const prevOrders = prevRevenueRow[0]?.count ?? 0;
  const revenueDelta =
    prevRevenue > 0
      ? Math.round(((stats.od.gross - prevRevenue) / prevRevenue) * 100)
      : stats.od.gross > 0
      ? 100
      : 0;
  const ordersDelta =
    prevOrders > 0
      ? Math.round(((stats.od.count - prevOrders) / prevOrders) * 100)
      : stats.od.count > 0
      ? 100
      : 0;

  const abandonedValue = stats.abandoned.reduce((a, c) => a + c.subtotal, 0);

  const insights = generateInsights({
    ordersCount: stats.od.count,
    ordersDelta,
    revenueEgp: Math.round(stats.od.gross / 100),
    revenueDelta,
    abandonedCount: stats.abandoned.length,
    abandonedValueEgp: Math.round(abandonedValue / 100),
    customersCount: stats.cust.total,
    customersDelta: 0,
    pendingReviewsCount: pendingReviewsRow[0]?.c ?? 0,
    lowStockCount: lowStockCountRow[0]?.c ?? 0,
    topViewedNotPurchased: topViewedRow[0]
      ? {
          productId: topViewedRow[0].id,
          name: topViewedRow[0].name,
          views: topViewedRow[0].views,
        }
      : null,
    vipSilentCount: vipSilentRow[0]?.c ?? 0,
  });

  const isNew = Date.now() - merchantCreatedAt.getTime() < 7 * 86_400_000;

  return (
    <>
      {insights.length > 0 ? <AIInsightsPanel insights={insights} /> : null}

      <section
        aria-label="صافي الأرباح"
        className="relative overflow-hidden rounded-2xl border border-emerald-400/20 p-5"
        style={{
          background:
            "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(7,9,26,0.4) 60%)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 end-0 size-64 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
              <Sparkles className="size-3" strokeWidth={2.25} aria-hidden="true" />
              صافي الأرباح (آخر 30 يوماً)
            </p>
            <p className="mt-2 font-mono text-3xl font-black tabular-nums text-ink">
              {formatEgp(stats.od.net)}
            </p>
            <p className="mt-1 text-[11px] text-ink-3">
              من {stats.od.count.toLocaleString("ar-EG")} طلب نشط
              {revenueDelta !== 0 ? (
                <span
                  className={
                    revenueDelta > 0
                      ? "ms-2 text-emerald-600 dark:text-emerald-300"
                      : "ms-2 text-rose-600 dark:text-rose-300"
                  }
                >
                  {revenueDelta > 0 ? "+" : ""}
                  {revenueDelta}% مقارنة بالفترة السابقة
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-[11px]">
            {stats.od.pending > 0 ? (
              <Link
                href="/dashboard/orders?status=new"
                className="rounded-full border border-nova/30 bg-nova/10 px-2.5 py-1 font-bold text-nova-2 transition-colors hover:bg-nova/20"
              >
                {stats.od.pending} طلب بانتظار المعالجة
              </Link>
            ) : (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-bold text-emerald-600 dark:text-emerald-300">
                لا توجد طلبات معلقة
              </span>
            )}
            {stats.od.reviewPay > 0 ? (
              <Link
                href="/dashboard/orders?payment=under_review"
                className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-bold text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-400/20"
              >
                {stats.od.reviewPay} إيصال بانتظار المراجعة
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section
        aria-label="المؤشرات الرئيسية"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {isNew ? (
          <>
            <KpiCard
              title="أول طلب"
              value={stats.od.count > 0 ? "تم" : "بانتظار"}
              icon={ShoppingCart}
              delta={0}
              deltaType="neutral"
            />
            <KpiCard
              title="زيارات أول 100"
              value={`${Math.min(stats.ev.visitors, 100)}/100`}
              icon={Eye}
              delta={0}
              deltaType="neutral"
            />
            <KpiCard
              title="المنتجات النشطة"
              value={String(stats.prodCounts.total)}
              icon={Package}
              delta={0}
              deltaType="neutral"
            />
            <KpiCard
              title="متابعة أول عميل"
              value={String(stats.cust.total)}
              icon={Users}
              delta={0}
              deltaType="neutral"
            />
          </>
        ) : (
          <>
            <KpiCard
              title="الطلبات"
              value={stats.od.count.toLocaleString("ar-EG")}
              icon={ShoppingCart}
              delta={ordersDelta}
              deltaType={
                ordersDelta > 0 ? "up" : ordersDelta < 0 ? "down" : "neutral"
              }
            />
            <KpiCard
              title="الإيرادات الإجمالية"
              value={formatEgp(stats.od.gross)}
              icon={Wallet}
              delta={revenueDelta}
              deltaType={
                revenueDelta > 0 ? "up" : revenueDelta < 0 ? "down" : "neutral"
              }
            />
            <KpiCard
              title="العملاء"
              value={stats.cust.total.toLocaleString("ar-EG")}
              icon={Users}
              delta={0}
              deltaType="neutral"
            />
            <KpiCard
              title="زيارات المتجر"
              value={stats.ev.views.toLocaleString("ar-EG")}
              icon={Eye}
              delta={0}
              deltaType="neutral"
            />
          </>
        )}
      </section>

      {stats.abandoned.length > 0 ? (
        <section
          aria-label="صائد السلات المتروكة"
          className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-5"
        >
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle
                className="size-4 text-amber-700 dark:text-amber-300"
                strokeWidth={2}
                aria-hidden="true"
              />
              <h2 className="text-sm font-black text-ink">
                صائد السلات المتروكة
              </h2>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10.5px] font-black text-amber-700 dark:text-amber-300">
                {stats.abandoned.length}
              </span>
            </div>
            <p className="hidden text-[11px] text-ink-3 sm:block">
              راسل العملاء وأكمل البيع
            </p>
          </header>

          <ul className="space-y-2">
            {stats.abandoned.slice(0, 5).map((c) => {
              const waNumber = c.phone?.replace(/\D/g, "") ?? "";
              const waText = `أهلاً ${c.name ?? "بك"}, لاحظنا أنك تركت منتجات في سلة متجرك بقيمة ${formatEgp(c.subtotal)}. متوفرين لمساعدتك على إكمال الطلب.`;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-edge/5 bg-edge/[0.02] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">
                      {c.name ?? "زائر"}
                    </p>
                    <p
                      className="mt-0.5 truncate font-mono text-[11px] text-ink-3"
                      dir="ltr"
                    >
                      {c.phone}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-black text-emerald-600 dark:text-emerald-300">
                    {formatEgp(c.subtotal)}
                  </span>
                  <a
                    href={
                      waNumber
                        ? `https://wa.me/2${waNumber}?text=${encodeURIComponent(waText)}`
                        : "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 text-[11px] font-black text-emerald-600 dark:text-emerald-300 transition-colors hover:bg-emerald-500/25"
                  >
                    <MessageCircle
                      className="size-3.5"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                    واتساب
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-ink">أحدث الطلبات</h2>
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-nova-2 transition-colors hover:text-ink"
            >
              عرض الكل
              <ArrowLeft className="size-3" aria-hidden="true" />
            </Link>
          </div>

          {stats.recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-edge/10 px-6 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-edge/5">
                <Inbox
                  className="size-5 text-ink-3"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">لا توجد طلبات بعد</p>
                <p className="mt-1 text-[11px] text-ink-3">
                  ستظهر هنا فور وصول أول طلب.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-edge/5">
              {stats.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/dashboard/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 py-3 transition-opacity hover:opacity-90"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate font-mono text-xs font-black text-ink"
                        dir="ltr"
                      >
                        {o.code}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-3">
                        {o.customerName} · {o.governorate}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-nova/10 px-2 py-1 text-[10.5px] font-bold text-nova-2">
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-black text-ink">
                      {formatEgp(o.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Suspense
          fallback={
            <div
              className="h-64 animate-pulse rounded-2xl bg-edge/[0.02]"
              aria-busy="true"
            />
          }
        >
          <HealthScoreData storeId={storeId} productCount={stats.prodCounts.total} />
        </Suspense>
      </section>
    </>
  );
}

async function HealthScoreData({
  storeId,
  productCount,
}: {
  storeId: string;
  productCount: number;
}) {
  // استخدام النسخة الآمنة: لا notFound()، تعامل مع الغياب بأناقة.
  const bp = await getBlueprintOrNull(storeId);
  if (!bp) {
    return (
      <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
        <p className="text-xs font-bold text-ink">مؤشر صحة المتجر</p>
        <p className="mt-2 text-[11px] text-ink-3">
          سيظهر بعد اكتمال بناء المتجر.
        </p>
      </div>
    );
  }
  return (
    <HealthScore
      bp={bp}
      productCount={productCount}
      hasLogo={Boolean(bp.brand.logo)}
      hasOrders={true}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-32 animate-pulse rounded-2xl bg-edge/[0.02]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-edge/[0.02]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-edge/[0.02] lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl bg-edge/[0.02]" />
      </div>
    </div>
  );
}