"use client";

// OrdersBoard — لوحة مراحل الطلبات الجارية: عمود لكل مرحلة (جديد، مؤكد، قيد التجهيز، تم الشحن، وتم التسليم آخر 3 أيام)،
// وفي كل بطاقة زرٌّ ينقل الطلب للمرحلة التالية مباشرة. على الموبايل تُسحب الأعمدة أفقياً عموداً عموداً.
import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { fmtNum } from "@/lib/format";
import { governorateName } from "@/lib/egypt";
import { ORDER_STATUS, orderStatusLabel, type OrderStatus } from "@/lib/order-status";
import { setOrderStatusAction } from "@/server/actions/orders";
import type { OrderRow } from "@/server/repos/orders-list";
import { requestPulse } from "../DashboardPulse";
import { HistoryBadge, PaymentChip, itemsSummary, timeAgo } from "./parts";

const COLUMNS: OrderStatus[] = ["new", "confirmed", "preparing", "shipped", "delivered"];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { new: "confirmed", confirmed: "preparing", preparing: "shipped", shipped: "delivered" };
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = { new: "أكّد", confirmed: "جهّز", preparing: "اشحن", shipped: "سُلّم" };

export function OrdersBoard({ rows }: { rows: OrderRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [list, move] = useOptimistic(rows, (cur, m: { id: string; to: OrderStatus }) => cur.map((r) => (r.id === m.id ? { ...r, status: m.to } : r)));

  const advance = (r: OrderRow) => {
    const to = NEXT[r.status];
    if (!to) return;
    start(async () => {
      move({ id: r.id, to });
      const res = await setOrderStatusAction(r.id, to);
      if (!res.ok) toast.error(res.error);
      else toast.success(`${r.code}: ${orderStatusLabel(to)}`);
      requestPulse();
      router.refresh();
    });
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0">
      <div className="grid snap-x snap-mandatory auto-cols-[85%] grid-flow-col gap-3 sm:auto-cols-[45%] lg:auto-cols-fr">
        {COLUMNS.map((col) => {
          const items = list.filter((r) => r.status === col);
          return (
            <section key={col} aria-label={`${ORDER_STATUS[col].label}: ${fmtNum(items.length)}`} className="flex min-h-48 snap-start flex-col rounded-2xl border border-edge/[0.07] bg-edge/[0.02] p-2.5">
              <header className="mb-2 flex items-center justify-between px-1 py-1">
                <h2 className="text-[13px] font-black text-ink">
                  {ORDER_STATUS[col].label}
                  {col === "delivered" ? <span className="ms-1 text-[11px] font-bold text-ink-3">(آخر 3 أيام)</span> : null}
                </h2>
                <span className="rounded-full bg-edge/[0.06] px-2 py-0.5 text-[11px] font-black tabular-nums text-ink-2">{fmtNum(items.length)}</span>
              </header>
              <ul className="flex-1 space-y-2">
                {items.map((r) => (
                  <li key={r.id} className="dash-card relative space-y-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/orders/${r.id}`} className="min-w-0 truncate text-[12.5px] font-black text-ink after:absolute after:inset-0 after:content-['']">
                        {r.customerName}
                      </Link>
                      <span className="shrink-0 text-[12.5px] font-black tabular-nums text-ink">{formatEgp(r.totalPiasters)}</span>
                    </div>
                    <p className="truncate text-[11px] text-ink-3">
                      <span dir="ltr">{r.code}</span> · {governorateName(r.governorate)} ·{" "}
                      <time dateTime={r.createdAt} suppressHydrationWarning>
                        {timeAgo(r.createdAt)}
                      </time>
                    </p>
                    <p className="truncate text-[11.5px] text-ink-2">{itemsSummary(r.items)}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      <PaymentChip row={r} />
                      <HistoryBadge h={r.history} />
                    </div>
                    {NEXT[r.status] ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => advance(r)}
                        className={cn(
                          "relative z-10 mt-1 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-nova/25 bg-nova/10 text-[12px] font-black text-nova-2 transition-colors hover:bg-nova/20 disabled:opacity-60"
                        )}
                      >
                        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                        {NEXT_LABEL[r.status]}
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">: {orderStatusLabel(NEXT[r.status]!)}</span>
                      </button>
                    ) : null}
                  </li>
                ))}
                {items.length === 0 ? <li className="px-2 py-8 text-center text-[12px] text-ink-3">لا طلبات هنا</li> : null}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
