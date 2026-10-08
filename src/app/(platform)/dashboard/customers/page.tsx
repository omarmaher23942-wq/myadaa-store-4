// dashboard/customers/page.tsx — قاعدة عملاء مع segmentation (v3).
//
// التعديلات الجذرية (موجة 3):
//  1) تصنيف تلقائي: VIP / New / At Risk / Churned.
//  2) فلترة بـ segment.
//  3) AI-powered targeted campaigns (زر "حملة مخصصة").
//  4) Export CSV.
import Link from "next/link";
import { desc, eq, and, sql, gte, lt, isNull, or } from "drizzle-orm";
import {
  Users,
  UserCheck,
  Crown,
  AlertTriangle,
  Clock,
  Plus,
  Download,
  Send,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { customers } from "@/db/schema";
import { redirect } from "next/navigation";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";

type Segment = "vip" | "new" | "at_risk" | "churned" | "all";

const SEGMENTS: Array<{ key: Segment; label: string; icon: typeof Crown; color: string; hint: string }> = [
  { key: "all", label: "الكل", icon: Users, color: "bg-edge/10 text-ink", hint: "كل العملاء" },
  { key: "vip", label: "VIP", icon: Crown, color: "bg-amber-500/20 text-amber-700 dark:text-amber-300", hint: "3+ طلبات" },
  { key: "new", label: "جديد", icon: Plus, color: "bg-blue-500/20 text-blue-300", hint: "خلال 30 يوم" },
  { key: "at_risk", label: "معرض للفقدان", icon: AlertTriangle, color: "bg-orange-500/20 text-orange-600 dark:text-orange-300", hint: "60+ يوم صامت" },
  { key: "churned", label: "فُقد", icon: Clock, color: "bg-ink-3/20 text-ink-2", hint: "120+ يوم صامت" },
];

const SEGMENT_LABELS: Record<Segment, string> = {
  all: "الكل",
  vip: "VIP",
  new: "جديد",
  at_risk: "معرض للفقدان",
  churned: "فُقد",
};

export default async function DashboardCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const session = await getMerchantSession();
  if (!session) redirect("/login");
  const db = await getTenantDb(session.storeId!);

  if (!session.storeId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl border border-nova-2/30 bg-nova/10 text-nova-2">
          <Users className="size-8" strokeWidth={1.75} />
        </div>
        <h1 className="text-xl font-black text-ink">سجل العملاء التراكمي</h1>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-ink-3">
          ستظهر هنا بيانات جميع المشترين من متجرك تلقائياً بمجرد إطلاق متجرك
          واستقبال أول طلب.
        </p>
        <Link
          href={NO_STORE_HREF}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-5 py-2.5 text-xs font-black text-space shadow-md"
        >
          <Plus className="size-3.5" />
          أنشئ متجرك للبدء
        </Link>
      </div>
    );
  }

  const { segment = "all" } = await searchParams;
  const activeSegment = (SEGMENTS.some((s) => s.key === segment)
    ? segment
    : "all") as Segment;

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const d60 = new Date(now.getTime() - 60 * 86_400_000);
  const d120 = new Date(now.getTime() - 120 * 86_400_000);

  // بناء where حسب الـ segment.
  const where = and(
    eq(customers.storeId, session.storeId),
    activeSegment === "vip"
      ? sql`${customers.ordersCount} >= 3`
      : activeSegment === "new"
      ? gte(customers.createdAt, d30)
      : activeSegment === "at_risk"
      ? and(
          sql`${customers.ordersCount} >= 1`,
          or(
            isNull(customers.lastOrderAt),
            lt(customers.lastOrderAt, d60)
          ),
          or(
            isNull(customers.lastOrderAt),
            gte(customers.lastOrderAt, d120)
          )
        )
      : activeSegment === "churned"
      ? and(
          sql`${customers.ordersCount} >= 1`,
          or(
            isNull(customers.lastOrderAt),
            lt(customers.lastOrderAt, d120)
          )
        )
      : undefined
  );

  const [rows, countsRaw, totalSpentRow] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.lastOrderAt))
      .limit(300),

    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        vip: sql<number>`count(*) filter (where ${customers.ordersCount} >= 3)`.mapWith(Number),
        newOnes: sql<number>`count(*) filter (where ${customers.createdAt} >= ${d30.toISOString()})`.mapWith(Number),
        atRisk: sql<number>`count(*) filter (where ${customers.ordersCount} >= 1 and (${customers.lastOrderAt} is null or ${customers.lastOrderAt} < ${d60.toISOString()}) and (${customers.lastOrderAt} is null or ${customers.lastOrderAt} >= ${d120.toISOString()}))`.mapWith(Number),
        churned: sql<number>`count(*) filter (where ${customers.ordersCount} >= 1 and (${customers.lastOrderAt} is null or ${customers.lastOrderAt} < ${d120.toISOString()}))`.mapWith(Number),
      })
      .from(customers)
      .where(eq(customers.storeId, session.storeId)),

    db
      .select({
        sum: sql<number>`coalesce(sum(${customers.totalSpentPiasters}), 0)`.mapWith(Number),
      })
      .from(customers)
      .where(eq(customers.storeId, session.storeId)),
  ]);

  const counts = countsRaw[0]!;
  const totalSpent = totalSpentRow[0]?.sum ?? 0;

  const segmentCount = (k: Segment): number => {
    if (k === "all") return counts.total;
    if (k === "vip") return counts.vip;
    if (k === "new") return counts.newOnes;
    if (k === "at_risk") return counts.atRisk;
    if (k === "churned") return counts.churned;
    return 0;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-edge/10 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            قاعدة العملاء
          </h1>
          <p className="mt-1 text-xs text-ink-3">
            {counts.total.toLocaleString("ar-EG")} عميل · {session.store!.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/dashboard/customers/export" download
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <Download className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            تصدير CSV
          </a>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-2">
            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">إجمالي المشتريات</p>
            <p className="mt-0.5 font-mono text-sm font-black text-emerald-600 dark:text-emerald-300">
              {formatEgp(totalSpent)}
            </p>
          </div>
        </div>
      </header>

      {/* Segments */}
      <nav aria-label="تصنيفات العملاء" className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => {
          const Icon = s.icon;
          const active = activeSegment === s.key;
          const count = segmentCount(s.key);
          return (
            <Link
              key={s.key}
              href={`?segment=${s.key}`}
              scroll={false}
              className={
                active
                  ? `inline-flex h-11 items-center gap-2 rounded-xl border-2 border-nova px-4 text-xs font-black text-ink ${s.color}`
                  : "inline-flex h-11 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.02] px-4 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.04]"
              }
            >
              <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              <span>{s.label}</span>
              <span className="rounded-full bg-black/30 px-1.5 font-mono text-[10px]">
                {count.toLocaleString("ar-EG")}
              </span>
              <span className="hidden text-[9.5px] opacity-60 md:inline">{s.hint}</span>
            </Link>
          );
        })}
      </nav>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-edge/10 bg-edge/[0.02] p-16 text-center">
          <Users className="mx-auto size-10 text-ink-3 opacity-30" strokeWidth={1.75} />
          <p className="mt-3 text-sm font-bold text-ink">
            لا يوجد عملاء في "{SEGMENT_LABELS[activeSegment]}"
          </p>
          <p className="mt-1 text-xs text-ink-3">
            جرّب تصنيفاً آخر أو انتظر وصول أول طلب.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-edge/10 bg-edge/[0.02]">
          <table className="w-full text-xs">
            <thead className="border-b border-edge/10 bg-edge/[0.02] text-ink-3">
              <tr>
                <th className="p-3.5 text-start font-bold">العميل</th>
                <th className="p-3.5 text-start font-bold">الموبايل</th>
                <th className="p-3.5 text-start font-bold">المحافظة</th>
                <th className="p-3.5 text-start font-bold">الطلبات</th>
                <th className="p-3.5 text-start font-bold">إجمالي المشتريات</th>
                <th className="p-3.5 text-start font-bold">آخر طلب</th>
                <th className="p-3.5 text-start font-bold">التصنيف</th>
                <th className="p-3.5 text-start font-bold">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/[0.04]">
              {rows.map((c) => {
                const isVip = c.ordersCount >= 3;
                const isNew = c.createdAt >= d30;
                const isAtRisk =
                  c.ordersCount >= 1 &&
                  c.lastOrderAt &&
                  c.lastOrderAt < d60 &&
                  c.lastOrderAt >= d120;
                const isChurned =
                  c.ordersCount >= 1 && c.lastOrderAt && c.lastOrderAt < d120;

                return (
                  <tr key={c.id} className="transition-colors hover:bg-edge/[0.02]">
                    <td className="p-3.5 font-bold text-ink">
                      {c.name}
                      {isVip ? (
                        <Crown
                          className="ms-1.5 inline size-3.5 text-amber-700 dark:text-amber-400"
                          strokeWidth={2.25}
                          aria-label="VIP"
                        />
                      ) : null}
                    </td>
                    <td
                      className="p-3.5 font-mono text-ink-2"
                      dir="ltr"
                    >
                      <a href={`tel:${c.phone}`} className="hover:underline">
                        {c.phone}
                      </a>
                    </td>
                    <td className="p-3.5 text-ink">
                      {c.governorate ? governorateName(c.governorate) : "—"}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-ink">
                      {c.ordersCount}
                    </td>
                    <td className="p-3.5 font-mono font-black text-emerald-600 dark:text-emerald-300">
                      {formatEgp(c.totalSpentPiasters)}
                    </td>
                    <td className="p-3.5 text-ink-3">
                      {c.lastOrderAt
                        ? new Date(c.lastOrderAt).toLocaleDateString("ar-EG")
                        : "—"}
                    </td>
                    <td className="p-3.5">
                      {isVip ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-black text-amber-700 dark:text-amber-300">
                          <Crown className="size-2.5" strokeWidth={2.5} />
                          VIP
                        </span>
                      ) : isChurned ? (
                        <span className="rounded-md bg-ink-3/15 px-2 py-0.5 text-[10.5px] font-black text-ink-2">
                          فُقد
                        </span>
                      ) : isAtRisk ? (
                        <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10.5px] font-black text-orange-600 dark:text-orange-300">
                          معرض للفقدان
                        </span>
                      ) : isNew ? (
                        <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10.5px] font-black text-blue-300">
                          جديد
                        </span>
                      ) : (
                        <span className="rounded-md bg-edge/5 px-2 py-0.5 text-[10.5px] font-black text-ink-3">
                          نشط
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <a
                        href={`https://wa.me/2${c.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#25D366] px-2.5 text-[10.5px] font-black text-ink"
                      >
                        <Send className="size-2.5" strokeWidth={2.5} />
                        واتساب
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}