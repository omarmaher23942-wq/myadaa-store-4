"use client";

// components/dashboard/OrdersView.tsx — العرض التفاعلي للطلبات.
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  MessageCircle,
  Printer,
  Eye,
  Inbox,
  Truck,
  CheckCircle2,
  Package,
  ShieldAlert,
  Loader2,
  X,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { useRealtimeEvent, useRealtimeChannel } from "@/lib/realtime-hooks";
import { channels, type OrderCreatedPayload, type OrderStatusChangedPayload } from "@/server/realtime/events";
import { bulkUpdateOrdersStatusAction } from "@/server/actions/orders";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { cn } from "@/lib/utils";

const SW = 1.75;

type Row = {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  governorate: string;
  city: string | null;
  address: string;
  totalPiasters: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  isTest: boolean;
  createdAt: string;
  transferScreenshotUrl: string | null;
  itemsCount: number;
};

const STATUS_META: Record<
  string,
  { label: string; tone: string }
> = {
  new: { label: "جديد", tone: "bg-blue-500/15 text-blue-300 border-blue-400/30" },
  confirmed: { label: "مؤكد", tone: "bg-teal-500/15 text-teal-600 dark:text-teal-300 border-teal-400/30" },
  preparing: { label: "قيد التجهيز", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-400/30" },
  shipped: { label: "مع المندوب", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30" },
  delivered: { label: "تم التوصيل", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-400/30" },
  returned: { label: "مرتجع", tone: "bg-ink-3/15 text-ink-2 border-edge/15" },
  cancelled: { label: "ملغي", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-400/30" },
};

const KANBAN_COLUMNS = [
  { key: "new", label: "جديد" },
  { key: "confirmed", label: "مؤكد" },
  { key: "preparing", label: "قيد التجهيز" },
  { key: "shipped", label: "مع المندوب" },
  { key: "delivered", label: "تم التوصيل" },
] as const;

const STATUS_TABS = [
  { key: "all", label: "الكل" },
  { key: "new", label: "جديدة" },
  { key: "confirmed", label: "مؤكدة" },
  { key: "preparing", label: "قيد التجهيز" },
  { key: "shipped", label: "مع الشحن" },
  { key: "delivered", label: "تم التوصيل" },
  { key: "returned", label: "مرتجعة" },
  { key: "cancelled", label: "ملغية" },
] as const;

function riskOf(r: Row): { safe: boolean; note?: string } {
  const phone = r.customerPhone.replace(/\D/g, "");
  if (phone.endsWith("0000") || phone.endsWith("1234")) {
    return { safe: false, note: "رقم مشبوه" };
  }
  if (r.address.length < 10) return { safe: false, note: "عنوان قصير" };
  return { safe: true };
}

export function OrdersView({
  storeId,
  storeName,
  view,
  rows: initialRows,
  counts,
  activeStatus,
  activePayment,
  query,
  totalCount,
}: {
  storeId: string;
  storeName: string;
  view: "list" | "kanban";
  rows: Row[];
  counts: Record<string, number>;
  activeStatus: string;
  activePayment: string;
  query: string;
  totalCount: number;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [liveCount, setLiveCount] = useState(0);

  // إعادة المزامنة عند تغيّر server props.
  useEffect(() => {
    setRows(initialRows);
    setSelected(new Set());
  }, [initialRows]);

  // ─── Real-time: order created ──────────────────────────────────────────
  useRealtimeEvent<OrderCreatedPayload>(
    channels.store(storeId),
    "order:created",
    (payload) => {
      // إذا كان الطلب مطابقاً للفلتر، نضيفه في الأعلى.
      const isMatching =
        (activeStatus === "all" || activeStatus === "new") &&
        (activePayment === "all");
      if (isMatching) {
        setRows((prev) => {
          if (prev.some((r) => r.id === payload.orderId)) return prev;
          return [
            {
              id: payload.orderId,
              code: payload.code,
              customerName: payload.customerName,
              customerPhone: "",
              governorate: payload.governorate,
              city: null,
              address: "",
              totalPiasters: payload.totalPiasters,
              status: "new",
              paymentMethod: payload.paymentMethod,
              paymentStatus:
                payload.paymentMethod === "cod" ? "pending" : "under_review",
              isTest: false,
              createdAt: payload.createdAt,
              transferScreenshotUrl: null,
              itemsCount: payload.itemsCount,
            },
            ...prev,
          ];
        });
      }
      setLiveCount((c) => c + 1);
    }
  );

  // ─── Real-time: order status changed ──────────────────────────────────
  useRealtimeEvent<OrderStatusChangedPayload>(
    channels.store(storeId),
    "order:status-changed",
    (payload) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === payload.orderId ? { ...r, status: payload.toStatus } : r
        )
      );
    }
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const bulkUpdate = (status: string) => {
    start(async () => {
      const ids = Array.from(selected);
      const res = await bulkUpdateOrdersStatusAction(ids, status);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`تم تحديث ${ids.length} طلب`);
      setSelected(new Set());
      router.refresh();
    });
  };

  // Kanban columns filtering.
  const kanbanBuckets = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const col of KANBAN_COLUMNS) map.set(col.key, []);
    for (const r of rows) {
      const bucket = map.get(r.status);
      if (bucket) bucket.push(r);
    }
    return map;
  }, [rows]);

  return (
    <>
      {/* Live indicator */}
      {liveCount > 0 ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-2.5"
        >
          <span className="inline-flex items-center gap-2 text-[11.5px] font-bold text-emerald-600 dark:text-emerald-200">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            {liveCount} طلب جديد وصل الآن
          </span>
          <button
            type="button"
            onClick={() => {
              setLiveCount(0);
              router.refresh();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-edge/[0.03] px-2.5 py-1 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-200 transition-colors hover:bg-edge/[0.06]"
          >
            <RefreshCw className="size-3" strokeWidth={2.5} aria-hidden="true" />
            تحديث
          </button>
        </motion.div>
      ) : null}

      {/* Tabs */}
      {view === "list" ? (
        <nav
          aria-label="تصفية بحالة الطلب"
          className="flex gap-1 overflow-x-auto rounded-2xl border border-edge/10 bg-edge/[0.02] p-1.5"
        >
          {STATUS_TABS.map((t) => {
            const active = activeStatus === t.key;
            const count = t.key === "all" ? totalCount : counts[t.key] ?? 0;
            return (
              <Link
                key={t.key}
                href={`?view=list&status=${t.key}${activePayment !== "all" ? `&payment=${activePayment}` : ""}`}
                scroll={false}
                className={
                  active
                    ? "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-nova px-3.5 text-xs font-black text-white shadow"
                    : "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.04]"
                }
              >
                <span>{t.label}</span>
                <span
                  className={
                    active
                      ? "rounded-full bg-black/20 px-1.5 font-mono text-[10.5px]"
                      : "rounded-full bg-edge/5 px-1.5 font-mono text-[10.5px]"
                  }
                >
                  {count.toLocaleString("ar-EG")}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {/* Search */}
      <form
        action="/dashboard/orders"
        method="get"
        className="flex items-center gap-2"
      >
        <input type="hidden" name="view" value={view} />
        {activeStatus !== "all" ? (
          <input type="hidden" name="status" value={activeStatus} />
        ) : null}
        {activePayment !== "all" ? (
          <input type="hidden" name="payment" value={activePayment} />
        ) : null}
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-50"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={query}
            placeholder="ابحث بكود الطلب، اسم العميل، أو رقم الهاتف…"
            className="h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 pe-10 text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-nova/40"
            aria-label="بحث في الطلبات"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06]"
        >
          <Filter className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          <span>تصفية</span>
        </button>
      </form>

      {view === "kanban" ? (
        <KanbanBoard
          buckets={kanbanBuckets}
          storeName={storeName}
          onStatusChange={bulkUpdate}
        />
      ) : (
        <OrdersTable
          rows={rows}
          storeName={storeName}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-nova/30 bg-space-2/95 p-3 shadow-2xl backdrop-blur-xl md:inset-x-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-black text-ink">
              {selected.size.toLocaleString("ar-EG")} طلب مُحدَّد
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => bulkUpdate("confirmed")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-500/20 px-3 text-[11px] font-bold text-teal-600 dark:text-teal-300 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                تأكيد الكل
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => bulkUpdate("shipped")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 text-[11px] font-bold text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
              >
                <Truck className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                مع الشحن
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => bulkUpdate("delivered")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                تم التوصيل
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => window.open(`/print/invoices?print=1&ids=${[...selected].join(",")}`, "_blank", "noopener")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 text-[11px] font-bold text-violet-600 dark:text-violet-300 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
              >
                <Printer className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                طباعة الكل
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-9 rounded-lg px-3 text-[11px] font-bold text-ink-3 transition-colors hover:text-ink"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ─── Table (List view) ─────────────────────────────────────────────────────
function OrdersTable({
  rows,
  storeName,
  selected,
  onToggle,
  onToggleAll,
}: {
  rows: Row[];
  storeName: string;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-edge/10 bg-edge/[0.02]">
      <table className="w-full min-w-[900px] text-xs">
        <thead className="border-b border-edge/10 bg-edge/[0.02] text-ink-3">
          <tr>
            <th className="w-10 p-3">
              <input
                type="checkbox"
                checked={selected.size === rows.length && rows.length > 0}
                onChange={onToggleAll}
                aria-label="تحديد الكل"
                className="size-4 accent-nova"
              />
            </th>
            <th className="p-3 text-start font-bold">كود الطلب</th>
            <th className="p-3 text-start font-bold">العميل والموبايل</th>
            <th className="p-3 text-start font-bold">المحافظة والعنوان</th>
            <th className="p-3 text-start font-bold">الإجمالي</th>
            <th className="p-3 text-start font-bold">الحالة</th>
            <th className="p-3 text-start font-bold">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge/[0.04]">
          {rows.map((r) => {
            const st = STATUS_META[r.status] ?? {
              label: r.status,
              tone: "bg-edge/5 text-ink-2 border-edge/10",
            };
            const risk = riskOf(r);
            const waMsg = `أهلاً ${r.customerName}, بخصوص طلبك ${r.code} من متجر ${storeName} بقيمة ${formatEgp(r.totalPiasters)}.`;
            const checked = selected.has(r.id);

            return (
              <tr
                key={r.id}
                className={cn(
                  "transition-colors",
                  checked ? "bg-nova/[0.06]" : "hover:bg-edge/[0.02]"
                )}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(r.id)}
                    aria-label={`تحديد ${r.code}`}
                    className="size-4 accent-nova"
                  />
                </td>
                <td className="p-3">
                  <Link
                    href={`/dashboard/orders/${r.id}`}
                    className="font-mono font-black text-ink hover:underline"
                  >
                    {r.code}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {r.isTest ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                        تجريبي
                      </span>
                    ) : null}
                    {risk.safe ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-300">
                        <CheckCircle2 className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
                        موثوق
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-300"
                        title={risk.note}
                      >
                        <ShieldAlert className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
                        {risk.note}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <p className="font-bold text-ink">{r.customerName}</p>
                  <p
                    className="mt-0.5 font-mono text-[11px] text-ink-3"
                    dir="ltr"
                  >
                    {r.customerPhone}
                  </p>
                </td>
                <td className="p-3">
                  <p className="font-bold text-ink">
                    {governorateName(r.governorate)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-3">
                    {r.address || "—"}
                  </p>
                </td>
                <td className="p-3">
                  <span className="font-mono text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-300">
                    {formatEgp(r.totalPiasters)}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={cn(
                      "inline-block rounded-lg border px-2.5 py-1 text-[11px] font-bold",
                      st.tone
                    )}
                  >
                    {st.label}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://wa.me/2${r.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#25D366] px-2.5 text-[11px] font-black text-ink transition-transform active:scale-95"
                      aria-label="واتساب"
                    >
                      <MessageCircle className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                    </a>
                    <Link
                      href={`/print/invoices?ids=${r.id}`}
                      target="_blank"
                      className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5"
                      aria-label="طباعة"
                    >
                      <Printer className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/dashboard/orders/${r.id}`}
                      className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5"
                      aria-label="تفاصيل"
                    >
                      <Eye className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rows.length === 0 ? (
        <div className="p-16 text-center">
          <Inbox className="mx-auto size-10 opacity-30" strokeWidth={SW} aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-ink">لا توجد طلبات</p>
          <p className="mt-1 text-xs text-ink-3">
            ستظهر هنا فور وصول أول طلب.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Kanban (Kanban view) ─────────────────────────────────────────────────
function KanbanBoard({
  buckets,
  storeName,
  onStatusChange,
}: {
  buckets: Map<string, Row[]>;
  storeName: string;
  onStatusChange: (status: string) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {KANBAN_COLUMNS.map((col) => {
        const items = buckets.get(col.key) ?? [];
        return (
          <div
            key={col.key}
            className="flex flex-col rounded-2xl border border-edge/10 bg-edge/[0.02] p-3"
          >
            <header className="mb-3 flex items-center justify-between border-b border-edge/5 pb-2.5">
              <span className="text-xs font-black text-ink">{col.label}</span>
              <span className="rounded-full bg-edge/5 px-2 py-0.5 font-mono text-[10px] font-black text-ink-3">
                {items.length}
              </span>
            </header>

            <ul className="flex-1 space-y-2">
              {items.slice(0, 20).map((r) => {
                const waMsg = `أهلاً ${r.customerName}, بخصوص طلبك ${r.code} من ${storeName}.`;
                return (
                  <li key={r.id}>
                    <article className="space-y-2 rounded-xl border border-edge/5 bg-edge/[0.03] p-2.5 transition-colors hover:border-nova/30">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/dashboard/orders/${r.id}`}
                          className="font-mono text-[11px] font-black text-ink hover:underline"
                        >
                          {r.code}
                        </Link>
                        <span className="font-mono text-[11px] font-black text-emerald-600 dark:text-emerald-300">
                          {formatEgp(r.totalPiasters)}
                        </span>
                      </div>
                      <p className="truncate text-[11px] font-bold text-ink-2">
                        {r.customerName}
                      </p>
                      <p className="truncate text-[10px] text-ink-3">
                        {governorateName(r.governorate)}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        <a
                          href={`https://wa.me/2${r.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grid size-7 place-items-center rounded-md bg-[#25D366] text-ink"
                          aria-label="واتساب"
                        >
                          <MessageCircle className="size-3" strokeWidth={SW} aria-hidden="true" />
                        </a>
                        <Link
                          href={`/dashboard/orders/${r.id}`}
                          className="grid size-7 place-items-center rounded-md border border-edge/10 text-ink-2"
                          aria-label="تفاصيل"
                        >
                          <Eye className="size-3" strokeWidth={SW} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  </li>
                );
              })}
              {items.length === 0 ? (
                <li className="py-6 text-center text-[10.5px] text-ink-3">
                  لا طلبات
                </li>
              ) : null}
            </ul>
          </div>
        );
      })}
    </div>
  );
}