// dashboard/orders/page.tsx — الطلبات: تبويبات الحالة بأعدادها، وفلتر الدفع، وبحث بالكود أو الموبايل أو الاسم،
// وعرض قائمة (بصفحات) أو لوحة مراحل للطلبات الجارية، وتصدير Excel بنفس الفلتر.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Inbox, Kanban, List, Search, SearchX } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { boardOrders, listOrders, parseOrdersQuery, type OrdersQuery, type PayFilter } from "@/server/repos/orders-list";
import { OrdersList } from "@/components/dashboard/orders/OrdersList";
import { OrdersBoard } from "@/components/dashboard/orders/OrdersBoard";
import { ORDER_STATUS, type OrderStatus } from "@/lib/order-status";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { NO_STORE_HREF } from "@/lib/edition";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "الطلبات" };

type SP = Record<string, string | undefined>;

const TABS: (OrderStatus | "all")[] = ["all", "new", "confirmed", "preparing", "shipped", "delivered", "returned", "cancelled"];
const PAY_LABEL: Record<PayFilter, string> = { all: "كل طرق الدفع", review: "إيصالات للمراجعة", cod: "عند الاستلام", transfer: "تحويل" };

function href(q: OrdersQuery & { view: "list" | "board" }, patch: Partial<OrdersQuery & { view: "list" | "board" }>): string {
  const n = { ...q, ...patch };
  const p = new URLSearchParams();
  if (n.view === "board") p.set("view", "board");
  if (n.status !== "all" && n.view !== "board") p.set("status", n.status);
  if (n.pay !== "all") p.set("pay", n.pay);
  if (n.q) p.set("q", n.q);
  if (n.page > 1 && n.view !== "board") p.set("page", String(n.page));
  const s = p.toString();
  return s ? `/dashboard/orders?${s}` : "/dashboard/orders";
}

export default async function DashboardOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/orders");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  const store = session.store;
  const sp = await searchParams;
  const view: "list" | "board" = sp.view === "board" || sp.view === "kanban" ? "board" : "list";
  const query = parseOrdersQuery(sp);
  const filtered = Boolean(query.q) || query.pay !== "all";

  const list = view === "list" ? await listOrders(store.id, query) : null;
  const board = view === "board" ? await boardOrders(store.id, query) : null;
  const exportHref = `/api/dashboard/orders/export${query.status !== "all" && view === "list" ? `?status=${query.status}` : ""}`;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">الطلبات</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {list ? (filtered ? `${arCount(list.all, NOUN.order)} تطابق البحث` : list.all ? `${arCount(list.all, NOUN.order)} في متجرك` : "لا طلبات بعد") : "الطلبات الجارية حسب مرحلتها"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="طريقة العرض" className="inline-flex rounded-xl border border-edge/10 bg-edge/[0.03] p-1">
            {(["list", "board"] as const).map((v) => {
              const Icon = v === "list" ? List : Kanban;
              return (
                <Link
                  key={v}
                  href={href({ ...query, view }, { view: v, page: 1 })}
                  aria-current={view === v ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold transition-colors",
                    view === v ? "bg-nova text-white shadow-sm" : "text-ink-3 hover:bg-edge/5 hover:text-ink"
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {v === "list" ? "قائمة" : "مراحل"}
                </Link>
              );
            })}
          </nav>
          <a
            href={exportHref}
            download
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-[12.5px] font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">تصدير Excel</span>
            <span className="sr-only sm:hidden">تصدير Excel</span>
          </a>
        </div>
      </header>

      {view === "list" && list ? (
        <nav aria-label="حالة الطلب" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {TABS.map((t) => {
            const active = query.status === t;
            const n = t === "all" ? list.all : (list.byStatus[t] ?? 0);
            return (
              <Link
                key={t}
                href={href({ ...query, view }, { status: t, page: 1 })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-bold transition-colors",
                  active ? "border-nova bg-nova text-white" : "border-edge/10 text-ink-2 hover:bg-edge/[0.05]"
                )}
              >
                {t === "all" ? "الكل" : ORDER_STATUS[t].label}
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-black/15" : "bg-edge/[0.06]")}>{fmtNum(n)}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form action="/dashboard/orders" method="get" role="search" className="relative flex-1">
          {view === "board" ? <input type="hidden" name="view" value="board" /> : null}
          {query.status !== "all" && view === "list" ? <input type="hidden" name="status" value={query.status} /> : null}
          {query.pay !== "all" ? <input type="hidden" name="pay" value={query.pay} /> : null}
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="كود الطلب، أو موبايل العميل، أو اسمه"
            aria-label="بحث في الطلبات"
            className="min-h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] ps-9 pe-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-nova/50 focus:ring-2 focus:ring-nova/20"
          />
        </form>
        <nav aria-label="طريقة الدفع" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(Object.keys(PAY_LABEL) as PayFilter[]).map((p) => (
            <Link
              key={p}
              href={href({ ...query, view }, { pay: p, page: 1 })}
              scroll={false}
              aria-current={query.pay === p ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center rounded-xl border px-3 text-[12px] font-bold transition-colors",
                query.pay === p ? "border-nova/40 bg-nova/12 text-nova-2" : "border-edge/10 text-ink-3 hover:bg-edge/[0.05] hover:text-ink"
              )}
            >
              {PAY_LABEL[p]}
            </Link>
          ))}
        </nav>
      </div>

      {board ? (
        board.length ? (
          <OrdersBoard rows={board} />
        ) : (
          <Empty filtered={filtered} clearHref="/dashboard/orders?view=board" />
        )
      ) : list && list.rows.length ? (
        <>
          <OrdersList rows={list.rows} storeName={store.name} />
          {list.pages > 1 ? (
            <nav aria-label="صفحات الطلبات" className="flex items-center justify-between gap-3 pt-1">
              <PageLink disabled={query.page <= 1} href={href({ ...query, view }, { page: query.page - 1 })} label="الأحدث" dir="prev" />
              <span className="text-[12px] font-bold tabular-nums text-ink-3">
                صفحة {fmtNum(query.page)} من {fmtNum(list.pages)}
              </span>
              <PageLink disabled={query.page >= list.pages} href={href({ ...query, view }, { page: query.page + 1 })} label="الأقدم" dir="next" />
            </nav>
          ) : null}
        </>
      ) : list ? (
        <Empty filtered={filtered || query.status !== "all"} clearHref="/dashboard/orders" hasAny={list.all > 0 || filtered} />
      ) : null}
    </div>
  );
}

function PageLink({ href, label, dir, disabled }: { href: string; label: string; dir: "prev" | "next"; disabled: boolean }) {
  const Icon = dir === "prev" ? ChevronRight : ChevronLeft;
  const cls = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold";
  if (disabled) return <span className={cn(cls, "text-ink-3/50")} aria-disabled="true">{dir === "prev" ? <Icon className="size-4" aria-hidden="true" /> : null}{label}{dir === "next" ? <Icon className="size-4" aria-hidden="true" /> : null}</span>;
  return (
    <Link href={href} className={cn(cls, "text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink")}>
      {dir === "prev" ? <Icon className="size-4" aria-hidden="true" /> : null}
      {label}
      {dir === "next" ? <Icon className="size-4" aria-hidden="true" /> : null}
    </Link>
  );
}

function Empty({ filtered, clearHref, hasAny = true }: { filtered: boolean; clearHref: string; hasAny?: boolean }) {
  const Icon = filtered ? SearchX : Inbox;
  return (
    <div className="dash-card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <Icon className="size-8 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
      <p className="text-[14px] font-black text-ink">{filtered ? "لا طلبات تطابق هذا الاختيار" : hasAny ? "لا طلبات جارية الآن" : "لا طلبات بعد"}</p>
      <p className="max-w-sm text-[12.5px] leading-6 text-ink-3">
        {filtered
          ? "جرّب كود الطلب كاملاً أو آخر 4 أرقام من الموبايل، أو اعرض كل الحالات."
          : "سيظهر هنا كل طلب فور وصوله، ومعه نغمة وتنبيه في أي صفحة من اللوحة."}
      </p>
      {filtered ? (
        <Link href={clearHref} className="mt-1 inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
          عرض كل الطلبات
        </Link>
      ) : null}
    </div>
  );
}
