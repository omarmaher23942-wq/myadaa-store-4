"use client";

// AbandonedCarts — سلات متروكة خلال 7 أيام لعملاء كتبوا رقمهم ولم يكملوا الطلب: رسالة واتساب جاهزة باسم المتجر
// وما في السلة، وفتحها يسجّل «تواصلت» فتخرج السلة من «ما يحتاج انتباهك» (ويمكن التراجع).
import { useOptimistic, useTransition } from "react";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { waLink } from "@/lib/whatsapp";
import { markCartContactedAction } from "@/server/actions/carts";
import { requestPulse } from "../DashboardPulse";

export type CartRow = {
  id: string;
  name: string | null;
  phone: string;
  subtotal: number;
  firstItem: string | null;
  itemsCount: number;
  lastSeenAt: string;
  contacted: boolean;
};

function ago(iso: string): string {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600e3));
  if (h < 1) return "منذ أقل من ساعة";
  if (h < 24) return h === 1 ? "منذ ساعة" : h === 2 ? "منذ ساعتين" : `منذ ${h} ${h <= 10 ? "ساعات" : "ساعة"}`;
  const d = Math.round(h / 24);
  return d === 1 ? "منذ يوم" : d === 2 ? "منذ يومين" : `منذ ${d} أيام`;
}

function message(storeName: string, c: CartRow): string {
  const hello = c.name ? `أهلاً ${c.name}` : "أهلاً بك";
  const what = c.firstItem ? `«${c.firstItem}»${c.itemsCount > 1 ? " ومنتجات أخرى" : ""}` : "منتجاتك";
  return `${hello}، معك ${storeName}. لاحظنا أن طلبك لـ${what} لم يكتمل. هل تحب أن نساعدك في إتمامه؟`;
}

export function AbandonedCarts({ storeName, rows }: { storeName: string; rows: CartRow[] }) {
  const [pending, start] = useTransition();
  const [list, setOptimistic] = useOptimistic(rows, (cur, upd: { id: string; contacted: boolean }) =>
    cur.map((r) => (r.id === upd.id ? { ...r, contacted: upd.contacted } : r))
  );

  const mark = (id: string, contacted: boolean) =>
    start(async () => {
      setOptimistic({ id, contacted });
      const res = await markCartContactedAction({ cartId: id, contacted });
      if (!res.ok) toast.error(res.error);
      requestPulse();
    });

  if (list.length === 0) return null;
  const open = list.filter((r) => !r.contacted).length;

  return (
    <section id="abandoned" aria-labelledby="abandoned-title" className="dash-card scroll-mt-24 p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="abandoned-title" className="text-[14px] font-black text-ink">
          سلات متروكة يمكن استرجاعها
        </h2>
        <p className="text-[11.5px] text-ink-3">
          {open > 0 ? "عملاء كتبوا رقمهم ولم يكملوا الطلب خلال 7 أيام" : "تواصلت مع كل أصحاب السلات"}
        </p>
      </header>

      <ul className="divide-y divide-edge/[0.06]">
        {list.map((c) => {
          const href = waLink(c.phone, message(storeName, c));
          return (
            <li key={c.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-3", c.contacted && "opacity-60")}>
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <p className="truncate text-[13px] font-bold text-ink">
                  {c.name ?? "عميل بلا اسم"}
                  <span className="ms-2 text-[11px] font-normal text-ink-3">{ago(c.lastSeenAt)}</span>
                </p>
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-3">
                  <span className="truncate">{c.firstItem ?? "سلة"}</span>
                  {c.itemsCount > 1 ? (
                    <span className="shrink-0 rounded-full bg-edge/[0.06] px-1.5 text-[10.5px] font-bold" title={`${c.itemsCount} منتجات في السلة`}>
                      +{c.itemsCount - 1}
                    </span>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span dir="ltr" className="shrink-0">
                    {c.phone}
                  </span>
                </p>
              </div>
              <span className="me-auto shrink-0 text-[13px] font-black tabular-nums text-ink sm:me-0">{formatEgp(c.subtotal)}</span>
              {c.contacted ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => mark(c.id, false)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink"
                >
                  <Check className="size-3.5 text-ok" strokeWidth={2.5} aria-hidden="true" />
                  تواصلت
                  <RotateCcw className="size-3" aria-label="تراجع" />
                </button>
              ) : href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => mark(c.id, true)}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ok/12 px-3.5 text-[12px] font-black text-ok transition-colors hover:bg-ok/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok"
                >
                  <MessageCircle className="size-4" strokeWidth={2.25} aria-hidden="true" />
                  راسله على واتساب
                </a>
              ) : (
                <span className="text-[11.5px] text-ink-3">رقم غير صالح لواتساب</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
