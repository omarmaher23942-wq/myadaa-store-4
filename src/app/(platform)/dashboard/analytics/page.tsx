// dashboard/analytics/page.tsx — تحليلات متقدمة (v3).
//
// التعديلات الجذرية (موجة 3):
//  1) Comparison periods (current vs previous).
//  2) Cohort analysis (customers by month).
//  3) Drill-down links.
//  4) Export PDF/CSV.
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  ShoppingCart,
  Eye,
  Package,
  AlertTriangle,
  MapPin,
  ArrowLeft,
  Target,
  Download,
  BarChart3,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { analyticsStats, type RangeDays } from "@/server/repos/analytics";
import { formatEgp } from "@/lib/money";
import { GOVERNORATES } from "@/lib/egypt";
import { getTenantDb } from "@/db/tenant";
import { orders, customers, analyticsEvents } from "@/db/schema";
import { and, eq, gte, lt, sql, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

const RANGES: { value: RangeDays; label: string }[] = [
  { value: 7, label: "7 أيام" },
  { value: 30, label: "30 يوماً" },
  { value: 90, label: "90 يوماً" },
];

function parseDays(v: string | undefined): RangeDays {
  const n = Number(v);
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

function govName(code: string): string {
  return GOVERNORATES.find((g) => g.code === code)?.name ?? code;
}

function DeltaChip({
  current,
  previous,
  suffix = "%",
}: {
  current: number;
  previous: number;
  suffix?: string;
}) {
  if (previous === 0 && current === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-ink-3">
        —
      </span>
    );
  }
  const delta =
    previous > 0
      ? Math.round(((current - previous) / previous) * 100)
      : current > 0
      ? 100
      : 0;
  const positive = delta > 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-black ${
        positive ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
      }`}
    >
      <Icon className="size-3" strokeWidth={2.5} aria-hidden="true" />
      {positive ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await getMerchantSession();
  if (!session) redirect("/login");
  if (!session.store) redirect("/dashboard");
  const db = await getTenantDb(session.storeId!);

  const { days: daysParam } = await searchParams;
  const days = parseDays(daysParam);
  const storeId = session.store.id;

  const stats = await analyticsStats(storeId, days);

  // Fetch previous period.
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 86_400_000);
  const prevPeriodStart = new Date(now.getTime() - 2 * days * 86_400_000);

  const [prevPeriod, cohorts, visitsCmp, customersCmp] = await Promise.all([
    db
      .select({
        orders: sql<number>`count(*)`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${orders.totalPiasters}) filter (where ${orders.status} not in ('cancelled','returned')), 0)`.mapWith(Number),
        visitors: sql<number>`0`.mapWith(Number),
      })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, storeId),
          gte(orders.createdAt, prevPeriodStart),
          lt(orders.createdAt, periodStart)
        )
      ),

    // Cohort: عملاء مسجلون شهرياً.
    db
      .select({
        month: sql<string>`to_char(${customers.createdAt} at time zone 'Africa/Cairo', 'YYYY-MM')`,
        count: sql<number>`count(*)`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${customers.totalSpentPiasters}), 0)`.mapWith(Number),
      })
      .from(customers)
      .where(eq(customers.storeId, storeId))
      .groupBy(sql`1`)
      .orderBy(sql`1 desc`)
      .limit(6),

    // زيارات الفترة السابقة الحقيقية للمقارنة (جهاز في يوم).
    db
      .select({
        prev: sql<number>`count(distinct (visitor_id || ':' || to_char(created_at at time zone 'Africa/Cairo','YYYY-MM-DD'))) filter (where name='page_view' and created_at < ${periodStart.toISOString()})`.mapWith(Number),
      })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.storeId, storeId), gte(analyticsEvents.createdAt, prevPeriodStart))),

    // العملاء الجدد في الفترة الحالية والسابقة.
    db
      .select({
        current: sql<number>`count(*) filter (where ${customers.createdAt} >= ${periodStart.toISOString()})`.mapWith(Number),
        previous: sql<number>`count(*) filter (where ${customers.createdAt} >= ${prevPeriodStart.toISOString()} and ${customers.createdAt} < ${periodStart.toISOString()})`.mapWith(Number),
      })
      .from(customers)
      .where(eq(customers.storeId, storeId)),
  ]);

  const prev = prevPeriod[0]!;
  const { funnel } = stats;

  const funnelSteps = [
    { label: "زيارات", value: funnel.views, icon: Eye },
    { label: "مشاهدة منتج", value: funnel.productViews, icon: Target },
    { label: "إضافة للسلة", value: funnel.atc, icon: ShoppingCart },
    { label: "بدء الدفع", value: funnel.checkouts, icon: TrendingUp },
    { label: "شراء", value: funnel.purchases, icon: Package },
  ];
  const maxFunnelValue = Math.max(1, ...funnelSteps.map((s) => s.value));

  const currentOrders = stats.daily.reduce((s, d) => s + d.orders, 0);
  const currentRevenue = stats.daily.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            التحليلات
          </h1>
          <p className="mt-1 text-xs text-ink-3">
            مؤشرات الأداء لمتجر {session.store.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav
            aria-label="النطاق الزمني"
            className="flex items-center gap-1 rounded-xl border border-edge/10 bg-edge/[0.02] p-1"
          >
            {RANGES.map((r) => (
              <Link
                key={r.value}
                href={`?days=${r.value}`}
                className={
                  r.value === days
                    ? "rounded-lg bg-nova px-3 py-1.5 text-[11px] font-black text-white"
                    : "rounded-lg px-3 py-1.5 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/5"
                }
              >
                {r.label}
              </Link>
            ))}
          </nav>
          <a
            href={`/api/dashboard/analytics/export?days=${days}`} download
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <Download className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            تصدير
          </a>
        </div>
      </header>

      {/* Top KPIs with comparison */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBlock
          icon={ShoppingCart}
          label="الطلبات"
          value={currentOrders.toLocaleString("ar-EG")}
          current={currentOrders}
          previous={prev.orders}
        />
        <KpiBlock
          icon={Wallet}
          label="الإيرادات"
          value={formatEgp(currentRevenue)}
          current={currentRevenue}
          previous={prev.revenue}
        />
        <KpiBlock
          icon={Users}
          label="عملاء جدد"
          value={(customersCmp[0]?.current ?? 0).toLocaleString("ar-EG")}
          current={customersCmp[0]?.current ?? 0}
          previous={customersCmp[0]?.previous ?? 0}
        />
        <KpiBlock
          icon={Eye}
          label="زيارات المتجر"
          value={funnel.views.toLocaleString("ar-EG")}
          current={funnel.views}
          previous={visitsCmp[0]?.prev ?? 0}
        />
      </section>

      {/* Revenue chart */}
      <section className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black text-ink">المبيعات اليومية</h2>
          <span className="font-mono text-[11px] text-ink-3">
            {days} يوماً · {currentOrders} طلب
          </span>
        </div>
        <RevenueChart data={stats.daily} />
      </section>

      {/* Funnel + Top products */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
          <h2 className="mb-4 text-sm font-black text-ink">قمع التحويل</h2>
          <ul className="space-y-3">
            {funnelSteps.map((s) => {
              const Icon = s.icon;
              const pct = (s.value / maxFunnelValue) * 100;
              return (
                <li key={s.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 font-bold text-ink">
                      <Icon
                        className="size-3.5 text-nova-2"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      {s.label}
                    </span>
                    <span className="font-mono font-black tabular-nums text-ink">
                      {s.value.toLocaleString("ar-EG")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-edge/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-nova to-aurora transition-[width] duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
          <h2 className="mb-4 text-sm font-black text-ink">الأكثر مبيعاً</h2>
          {stats.topProducts.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-3">
              لا توجد مبيعات بعد.
            </p>
          ) : (
            <ul className="divide-y divide-edge/5">
              {stats.topProducts.map((p, i) => (
                <li
                  key={`${p.productId}-${i}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-nova/15 font-mono text-[10.5px] font-black text-nova-2">
                      {i + 1}
                    </span>
                    <p className="truncate text-xs font-bold text-ink">{p.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-[11px]">
                    <span className="font-mono tabular-nums text-ink-3">
                      {p.qty} قطعة
                    </span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-300">
                      {formatEgp(p.revenue)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Cohorts */}
      <section className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3
            className="size-4 text-nova-2"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <h2 className="text-sm font-black text-ink">
            كوهورتات العملاء (آخر 6 شهور)
          </h2>
        </div>
        {cohorts.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-3">
            لا توجد بيانات كافية بعد.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-edge/10 text-ink-3">
                <tr>
                  <th className="py-2 text-start font-bold">الشهر</th>
                  <th className="py-2 text-start font-bold">عملاء جدد</th>
                  <th className="py-2 text-start font-bold">إجمالي المشتريات</th>
                  <th className="py-2 text-start font-bold">متوسط المشتريات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/5">
                {cohorts.map((c) => (
                  <tr key={c.month}>
                    <td className="py-2.5 font-mono font-bold text-ink">
                      {c.month}
                    </td>
                    <td className="py-2.5 font-mono text-ink">
                      {c.count.toLocaleString("ar-EG")}
                    </td>
                    <td className="py-2.5 font-mono font-black text-emerald-600 dark:text-emerald-300">
                      {formatEgp(c.revenue)}
                    </td>
                    <td className="py-2.5 font-mono text-ink-2">
                      {c.count > 0 ? formatEgp(Math.round(c.revenue / c.count)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Low stock + Governorates */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle
              className="size-4 text-amber-700 dark:text-amber-300"
              strokeWidth={2}
              aria-hidden="true"
            />
            <h2 className="text-sm font-black text-ink">
              تنبيه المخزون المنخفض
            </h2>
          </div>
          {stats.lowStock.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-3">
              كل المنتجات بمخزون كافٍ.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-2.5"
                >
                  <Link
                    href={`/dashboard/products/${p.id}`}
                    className="truncate text-xs font-bold text-ink hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="shrink-0 rounded-md bg-amber-400/15 px-2 py-0.5 font-mono text-[11px] font-black text-amber-700 dark:text-amber-300">
                    {p.stock} قطع
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <MapPin
              className="size-4 text-nova-2"
              strokeWidth={2}
              aria-hidden="true"
            />
            <h2 className="text-sm font-black text-ink">التوزيع الجغرافي</h2>
          </div>
          {stats.governorates.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-3">
              لا توجد بيانات بعد.
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.governorates.map((g) => (
                <li
                  key={g.governorate}
                  className="flex items-center justify-between gap-3 border-b border-edge/5 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-xs font-bold text-ink">
                    {govName(g.governorate)}
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="font-mono text-ink-3">
                      {g.count} طلب
                    </span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-300">
                      {formatEgp(g.revenue)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-nova-2 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          رجوع إلى النظرة العامة
        </Link>
      </div>
    </div>
  );
}

function KpiBlock({
  icon: Icon,
  label,
  value,
  current,
  previous,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
  current: number;
  previous: number;
}) {
  return (
    <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-4">
      <div className="flex items-start justify-between">
        <div className="flex size-8 items-center justify-center rounded-lg border border-edge/10 bg-edge/[0.03]">
          <Icon className="size-4 text-nova-2" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <DeltaChip current={current} previous={previous} />
      </div>
      <div className="mt-4">
        <p className="text-[24px] font-black leading-none text-ink tabular-nums">
          {value}
        </p>
        <p className="mt-1.5 text-[11px] font-bold text-ink-3">{label}</p>
      </div>
    </div>
  );
}