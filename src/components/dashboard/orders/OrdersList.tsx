"use client";

// OrdersList — قائمة الطلبات: جدول على الشاشات الكبيرة، وبطاقات تُلمس على الموبايل، وتحديد متعدد بشريط إجراءات
// جماعية (تأكيد، تجهيز، شحن، تسليم، طباعة الفواتير) يمر بتأكيد لأن كل تغيير يُبلغ العميل بالبريد إن كتبه.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle, PackageCheck, Printer, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { arCount, NOUN } from "@/lib/format";
import { governorateName } from "@/lib/egypt";
import { waLink } from "@/lib/whatsapp";
import { messageKindFor, orderMessage } from "@/lib/order-messages";
import { orderStatusLabel, type OrderStatus } from "@/lib/order-status";
import { bulkUpdateOrdersStatusAction } from "@/server/actions/orders";
import type { OrderRow } from "@/server/repos/orders-list";
import { requestPulse } from "../DashboardPulse";
import { ConfirmDialog } from "../ui/DashDialog";
import { HistoryBadge, PaymentChip, StatusChip, itemsSummary, timeAgo } from "./parts";

const BULK: { to: OrderStatus; label: string; icon: typeof Truck }[] = [
  { to: "confirmed", label: "تأكيد", icon: CheckCircle2 },
  { to: "preparing", label: "تجهيز", icon: PackageCheck },
  { to: "shipped", label: "شحن", icon: Truck },
  { to: "delivered", label: "تسليم", icon: CheckCircle2 },
];

export function OrdersList({ rows, storeName }: { rows: OrderRow[]; storeName: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<OrderStatus | null>(null);

  useEffect(() => setSelected(new Set()), [rows]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  async function applyBulk(to: OrderStatus): Promise<boolean> {
    const ids = [...selected];
    const res = await bulkUpdateOrdersStatusAction(ids, to);
    if (res.done > 0) toast.success(`صار ${arCount(res.done, NOUN.order)}: ${orderStatusLabel(to)}`);
    if (!res.ok) toast.error(res.error);
    setSelected(new Set());
    requestPulse();
    router.refresh();
    return true;
  }

  const wa = (r: OrderRow) => waLink(r.customerPhone, orderMessage(messageKindFor(r.status, r.paymentStatus), r, storeName));

  return (
    <>
      {/* سطح المكتب: جدول */}
      <div className="dash-card hidden overflow-hidden md:block">
        <table className="w-full text-[12.5px]">
          <caption className="sr-only">الطلبات</caption>
          <thead className="border-b border-edge/[0.07] text-[11.5px] text-ink-3">
            <tr>
              <th scope="col" className="w-11 p-3">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="تحديد كل طلبات الصفحة" className="size-4 accent-[var(--dash-nova)]" />
              </th>
              <th scope="col" className="p-3 text-start font-bold">الطلب</th>
              <th scope="col" className="p-3 text-start font-bold">العميل</th>
              <th scope="col" className="hidden p-3 text-start font-bold lg:table-cell">المحتوى</th>
              <th scope="col" className="p-3 text-start font-bold">المحافظة</th>
              <th scope="col" className="p-3 text-end font-bold">الإجمالي</th>
              <th scope="col" className="p-3 text-start font-bold">الحالة</th>
              <th scope="col" className="w-24 p-3">
                <span className="sr-only">إجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/[0.05]">
            {rows.map((r) => {
              const checked = selected.has(r.id);
              const link = wa(r);
              return (
                <tr key={r.id} className={cn("transition-colors", checked ? "bg-nova/[0.06]" : "hover:bg-edge/[0.025]")}>
                  <td className="p-3 align-top">
                    <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} aria-label={`تحديد ${r.code}`} className="mt-0.5 size-4 accent-[var(--dash-nova)]" />
                  </td>
                  <td className="p-3 align-top">
                    <Link href={`/dashboard/orders/${r.id}`} className="font-black text-ink hover:text-nova-2" dir="ltr">
                      {r.code}
                    </Link>
                    <time dateTime={r.createdAt} suppressHydrationWarning className="mt-0.5 block text-[11px] text-ink-3">
                      {timeAgo(r.createdAt)}
                    </time>
                    {r.isTest ? <span className="mt-1 inline-flex rounded-full bg-warn/12 px-1.5 text-[10px] font-black text-warn">تجريبي</span> : null}
                  </td>
                  <td className="p-3 align-top">
                    <p className="font-bold text-ink">{r.customerName}</p>
                    <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-3" dir="ltr" style={{ textAlign: "right" }}>
                      {r.customerPhone}
                    </p>
                    <div className="mt-1">
                      <HistoryBadge h={r.history} />
                    </div>
                  </td>
                  <td className="hidden max-w-[14rem] p-3 align-top text-ink-2 lg:table-cell">
                    <p className="truncate">{itemsSummary(r.items)}</p>
                  </td>
                  <td className="p-3 align-top">
                    <p className="font-bold text-ink">{governorateName(r.governorate)}</p>
                    {r.city ? <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{r.city}</p> : null}
                  </td>
                  <td className="p-3 text-end align-top">
                    <p className="font-black tabular-nums text-ink">{formatEgp(r.totalPiasters)}</p>
                    <div className="mt-1">
                      <PaymentChip row={r} />
                    </div>
                  </td>
                  <td className="p-3 align-top">
                    <StatusChip status={r.status} />
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`راسل ${r.customerName} على واتساب`}
                          title="رسالة واتساب جاهزة لحالة الطلب"
                          className="grid size-9 place-items-center rounded-lg bg-ok/12 text-ok transition-colors hover:bg-ok/20"
                        >
                          <MessageCircle className="size-4" aria-hidden="true" />
                        </a>
                      ) : null}
                      <a
                        href={`/print/invoices?ids=${r.id}`}
                        target="_blank"
                        rel="noopener"
                        aria-label={`فاتورة ${r.code}`}
                        title="الفاتورة"
                        className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5"
                      >
                        <Printer className="size-4" aria-hidden="true" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* الموبايل: بطاقات */}
      <ul className="space-y-2.5 md:hidden">
        {rows.map((r) => {
          const checked = selected.has(r.id);
          const link = wa(r);
          return (
            <li key={r.id} className={cn("dash-card relative p-3.5 transition-colors", checked && "border-nova/40 bg-nova/[0.05]")}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(r.id)}
                  aria-label={`تحديد ${r.code}`}
                  className="relative z-10 mt-1 size-5 shrink-0 accent-[var(--dash-nova)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/dashboard/orders/${r.id}`} className="text-[13.5px] font-black text-ink after:absolute after:inset-0 after:content-['']">
                      {r.customerName}
                    </Link>
                    <span className="shrink-0 text-[13.5px] font-black tabular-nums text-ink">{formatEgp(r.totalPiasters)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-ink-3">
                    <span dir="ltr">{r.code}</span> · {governorateName(r.governorate)} ·{" "}
                    <time dateTime={r.createdAt} suppressHydrationWarning>
                      {timeAgo(r.createdAt)}
                    </time>
                  </p>
                  <p className="mt-1 truncate text-[12px] text-ink-2">{itemsSummary(r.items)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusChip status={r.status} />
                    <PaymentChip row={r} />
                    <HistoryBadge h={r.history} />
                    {r.isTest ? <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[10.5px] font-black text-warn">تجريبي</span> : null}
                  </div>
                </div>
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`راسل ${r.customerName} على واتساب`}
                    className="relative z-10 grid size-11 shrink-0 place-items-center self-center rounded-xl bg-ok/12 text-ok"
                  >
                    <MessageCircle className="size-5" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 ? (
        <div
          role="toolbar"
          aria-label="إجراءات على الطلبات المحددة"
          className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-nova/30 bg-space-2/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:inset-x-auto md:bottom-6 md:start-1/2 md:w-auto md:-translate-x-1/2 rtl:md:translate-x-1/2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-1 text-[12.5px] font-black text-ink">{arCount(selected.size, NOUN.order)}</span>
            {BULK.map((b) => (
              <button
                key={b.to}
                type="button"
                onClick={() => setBulk(b.to)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[12px] font-bold text-ink transition-colors hover:bg-edge/[0.07]"
              >
                <b.icon className="size-4" aria-hidden="true" />
                {b.label}
              </button>
            ))}
            <a
              href={`/print/invoices?print=1&ids=${[...selected].join(",")}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[12px] font-bold text-ink transition-colors hover:bg-edge/[0.07]"
            >
              <Printer className="size-4" aria-hidden="true" />
              الفواتير
            </a>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="إلغاء التحديد"
              className="grid size-10 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={bulk !== null}
        onClose={() => setBulk(null)}
        title={bulk ? `تغيير ${arCount(selected.size, NOUN.order)} إلى «${orderStatusLabel(bulk)}»` : ""}
        description="يُسجَّل التغيير في سجل كل طلب، ويصل كل عميل كتب بريده إشعار بالحالة الجديدة. الطلبات الملغاة أو المرتجعة لا تُعاد فتحاً إلا إن كفى المخزون."
        confirmLabel="غيّر الحالة"
        onConfirm={() => applyBulk(bulk!)}
      />
    </>
  );
}
