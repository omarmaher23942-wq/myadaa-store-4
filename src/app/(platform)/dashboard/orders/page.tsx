// dashboard/orders/page.tsx — إدارة الطلبات (v3).
//
// التعديلات الجذرية (موجة 3):
//  1) Kanban view + List view toggle.
//  2) Real-time updates من Pusher.
//  3) Bulk actions (PDF batch printing, status update).
//  4) Advanced filters (payment status, governorate, date range).
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, ilike, or, sql, inArray } from "drizzle-orm";
import {
  Inbox,
  Package,
  Plus,
  Download,
  Printer,
  Filter,
  LayoutGrid,
  List,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema/commerce";
import { OrdersView } from "@/components/dashboard/OrdersView";

export const dynamic = "force-dynamic";

export default async function DashboardOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    status?: string;
    payment?: string;
    q?: string;
  }>;
}) {
  const session = await getMerchantSession();
  if (!session || !session.storeId) redirect("/dashboard");
  const db = await getTenantDb(session.storeId!);

  const store = session.store!;
  const { view = "list", status, payment, q } = await searchParams;

  const where = and(
    eq(orders.storeId, store.id),
    status && status !== "all"
      ? eq(orders.status, status as typeof orders.$inferSelect.status)
      : undefined,
    payment && payment !== "all"
      ? eq(
          orders.paymentStatus,
          payment as typeof orders.$inferSelect.paymentStatus
        )
      : undefined,
    q
      ? or(
          ilike(orders.code, `%${q}%`),
          ilike(orders.customerPhone, `%${q}%`),
          ilike(orders.customerName, `%${q}%`)
        )
      : undefined
  );

  const [rows, countsRaw] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(300),

    db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(eq(orders.storeId, store.id))
      .groupBy(orders.status),
  ]);

  const counts = Object.fromEntries(
    countsRaw.map((c) => [c.status, c.count])
  ) as Record<string, number>;
  const totalCount = countsRaw.reduce((a, c) => a + c.count, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            إدارة الطلبات
          </h1>
          <p className="mt-1 text-xs text-ink-3">
            {totalCount.toLocaleString("ar-EG")} طلب · {store.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-edge/10 bg-black/40 p-1">
            <Link
              href="?view=list"
              aria-label="عرض قائمة"
              className={
                view === "list"
                  ? "rounded-lg bg-nova p-2 text-white"
                  : "rounded-lg p-2 text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink"
              }
            >
              <List className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            </Link>
            <Link
              href="?view=kanban"
              aria-label="عرض kanban"
              className={
                view === "kanban"
                  ? "rounded-lg bg-nova p-2 text-white"
                  : "rounded-lg p-2 text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink"
              }
            >
              <LayoutGrid className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            </Link>
          </div>

          <a
            href="/api/dashboard/orders/export" download
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <Download className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            تصدير Excel
          </a>
        </div>
      </header>

      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-2xl bg-edge/[0.02]" />}
      >
        <OrdersView
          storeId={store.id}
          storeName={store.name}
          view={view as "list" | "kanban"}
          rows={rows.map((o) => ({
            id: o.id,
            code: o.code,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            governorate: o.governorate,
            city: o.city,
            address: o.address,
            totalPiasters: o.totalPiasters,
            status: o.status,
            paymentMethod: o.paymentMethod,
            paymentStatus: o.paymentStatus,
            isTest: o.isTest,
            createdAt: o.createdAt.toISOString(),
            transferScreenshotUrl: o.transferScreenshotUrl,
            itemsCount: 0,
          }))}
          counts={counts}
          activeStatus={status ?? "all"}
          activePayment={payment ?? "all"}
          query={q ?? ""}
          totalCount={totalCount}
        />
      </Suspense>
    </div>
  );
}