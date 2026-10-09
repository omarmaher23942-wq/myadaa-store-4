"use client";

// OrderStatusPanel — مسار الطلب: الخطوة التالية زرٌّ واحد واضح، وما يغيّر المخزون أو يُبلغ العميل (إلغاء، ارتجاع،
// إعادة فتح) يمر بنافذة تأكيد بسبب اختياري يُحفظ في سجل الطلب. التسليم للشحن يطلب شركة الشحن ورقم الشحنة اختيارياً
// قبل تغيير الحالة، فيصل العميلَ بريدُ الشحن كاملاً.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronDown, PackageCheck, RotateCcw, Truck, Undo2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { ORDER_STATUS, orderStatusLabel, type OrderStatus } from "@/lib/order-status";
import { setOrderStatusAction, updateOrderMetaAction } from "@/server/actions/orders";
import { requestPulse } from "../DashboardPulse";
import { ConfirmDialog, DashDialog } from "../ui/DashDialog";

const FLOW: OrderStatus[] = ["new", "confirmed", "preparing", "shipped", "delivered"];

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof Check }>> = {
  new: { to: "confirmed", label: "أكّد الطلب", icon: CheckCircle2 },
  confirmed: { to: "preparing", label: "ابدأ التجهيز", icon: PackageCheck },
  preparing: { to: "shipped", label: "سلّمته لشركة الشحن", icon: Truck },
  shipped: { to: "delivered", label: "تم التسليم للعميل", icon: Check },
};

type Props = {
  orderId: string;
  code: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  totalPiasters: number;
  courierName: string | null;
  trackingNumber: string | null;
  internalNotes: string | null;
};

type Pending = { to: OrderStatus; title: string; description: string; confirmLabel: string; tone: "primary" | "danger"; noteLabel?: string } | null;

export function OrderStatusPanel(p: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [shipOpen, setShipOpen] = useState(false);
  const [manual, setManual] = useState<OrderStatus>(p.status);

  const closed = p.status === "cancelled" || p.status === "returned";
  const step = FLOW.indexOf(p.status);
  const next = NEXT[p.status];
  const cod = p.paymentMethod === "cod";

  async function apply(to: OrderStatus, note?: string): Promise<boolean> {
    const res = await setOrderStatusAction(p.orderId, to, note);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(`صار الطلب: ${orderStatusLabel(to)}`);
    requestPulse();
    router.refresh();
    return true;
  }

  const run = (to: OrderStatus) => start(async () => void (await apply(to)));

  function primary() {
    if (!next) return;
    if (next.to === "shipped") return setShipOpen(true);
    if (next.to === "confirmed" && p.paymentMethod !== "cod" && p.paymentStatus === "under_review") {
      return setConfirming({
        to: "confirmed",
        title: "تأكيد طلب لم يُراجَع تحويله",
        description: "إيصال التحويل لم يُراجَع بعد. الأفضل أن تتأكد من وصول المبلغ أولاً من بطاقة الإيصال. تريد تأكيد الطلب الآن؟",
        confirmLabel: "أكّد الطلب",
        tone: "primary",
      });
    }
    run(next.to);
  }

  const secondary: { label: string; icon: typeof Check; pending: NonNullable<Pending> }[] = [];
  if (p.status === "new" || p.status === "confirmed" || p.status === "preparing") {
    secondary.push({
      label: "إلغاء الطلب",
      icon: XCircle,
      pending: {
        to: "cancelled",
        title: `إلغاء الطلب ${p.code}`,
        description: "تعود الكميات للمخزون، ويصل العميل بريد بالإلغاء إن كتب بريده.",
        confirmLabel: "ألغِ الطلب",
        tone: "danger",
        noteLabel: "سبب الإلغاء (يظهر لك في سجل الطلب فقط)",
      },
    });
  }
  if (p.status === "shipped") {
    secondary.push({
      label: "رفض العميل الاستلام",
      icon: Undo2,
      pending: {
        to: "returned",
        title: "تسجيل رفض الاستلام",
        description: "يُسجَّل الطلب مرتجعاً وتعود كمياته للمخزون الآن.",
        confirmLabel: "سجّله مرتجعاً",
        tone: "danger",
        noteLabel: "ماذا حدث؟ (اختياري)",
      },
    });
  }
  if (p.status === "delivered") {
    secondary.push({
      label: "تسجيل مرتجع",
      icon: Undo2,
      pending: {
        to: "returned",
        title: "تسجيل الطلب مرتجعاً",
        description: "تعود الكميات للمخزون. رد المبلغ للعميل يتم بينكما خارج اللوحة.",
        confirmLabel: "سجّله مرتجعاً",
        tone: "danger",
        noteLabel: "سبب الارتجاع (اختياري)",
      },
    });
  }
  if (closed) {
    secondary.push({
      label: "إعادة فتح الطلب",
      icon: RotateCcw,
      pending: {
        to: "new",
        title: `إعادة فتح ${p.code}`,
        description: "يعود الطلب «جديداً» وتُخصم كمياته من المخزون من جديد. إن لم يكفِ المخزون الحالي سنخبرك بذلك.",
        confirmLabel: "أعد فتحه",
        tone: "primary",
        noteLabel: "سبب إعادة الفتح (اختياري)",
      },
    });
  }

  return (
    <section aria-labelledby="status-title" className="dash-card p-4 sm:p-5">
      <h2 id="status-title" className="mb-4 text-[14px] font-black text-ink">
        حالة الطلب
      </h2>

      {closed ? (
        <p className={cn("mb-4 rounded-xl px-3.5 py-3 text-[13px] font-bold", p.status === "cancelled" ? "bg-edge/[0.05] text-ink-2" : "bg-bad/10 text-bad")}>
          {p.status === "cancelled" ? "هذا الطلب ملغي." : "هذا الطلب مرتجع."} عادت كمياته للمخزون.
        </p>
      ) : (
        <ol className="mb-5 grid grid-cols-5 gap-1" aria-label="مراحل الطلب">
          {FLOW.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s} className="flex flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full border-2 text-[11px] font-black transition-colors",
                    done && "border-nova bg-nova text-white",
                    current && "border-nova bg-nova/15 text-nova-2",
                    !done && !current && "border-edge/15 text-ink-3"
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn("text-[10.5px] font-bold leading-4", current ? "text-ink" : "text-ink-3")}>{ORDER_STATUS[s].label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="space-y-2">
        {next ? (
          <button
            type="button"
            disabled={busy}
            onClick={primary}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[14px] font-black text-white shadow-md transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <next.icon className="size-4" strokeWidth={2.25} aria-hidden="true" />}
            {next.label}
          </button>
        ) : null}
        {next?.to === "delivered" && cod ? (
          <p className="text-center text-[11.5px] text-ink-3">ويُسجَّل المبلغ ({formatEgp(p.totalPiasters)}) محصّلاً.</p>
        ) : null}

        {secondary.map((s) => (
          <button
            key={s.label}
            type="button"
            disabled={busy}
            onClick={() => setConfirming(s.pending)}
            className={cn(
              "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-[12.5px] font-bold transition-colors disabled:opacity-60",
              s.pending.tone === "danger" ? "border-bad/25 text-bad hover:bg-bad/10" : "border-edge/10 text-ink-2 hover:bg-edge/5"
            )}
          >
            <s.icon className="size-4" strokeWidth={2} aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>

      <details className="group mt-4 rounded-xl border border-edge/[0.07]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 text-[12px] font-bold text-ink-3 hover:text-ink">
          تصحيح الحالة يدوياً
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="flex gap-2 px-3.5 pb-3.5">
          <label className="sr-only" htmlFor="manual-status">
            الحالة
          </label>
          <select
            id="manual-status"
            value={manual}
            onChange={(e) => setManual(e.target.value as OrderStatus)}
            className="min-h-11 flex-1 rounded-xl border border-edge/10 bg-space-2 px-3 text-[13px] font-bold text-ink outline-none focus:ring-2 focus:ring-nova/30"
          >
            {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS[s].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || manual === p.status}
            onClick={() =>
              setConfirming({
                to: manual,
                title: `تغيير الحالة إلى «${orderStatusLabel(manual)}»`,
                description:
                  manual === "cancelled" || manual === "returned"
                    ? "تعود كميات الطلب للمخزون."
                    : closed
                      ? "يُعاد فتح الطلب وتُخصم كمياته من المخزون من جديد."
                      : "يُسجَّل التغيير في سجل الطلب، ويُبلغ العميل بالبريد إن كتبه.",
                confirmLabel: "غيّر الحالة",
                tone: manual === "cancelled" || manual === "returned" ? "danger" : "primary",
                noteLabel: "ملاحظة (اختيارية)",
              })
            }
            className="min-h-11 rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-edge/5 disabled:opacity-40"
          >
            تطبيق
          </button>
        </div>
      </details>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming?.title ?? ""}
        description={confirming?.description}
        confirmLabel={confirming?.confirmLabel ?? ""}
        tone={confirming?.tone}
        noteLabel={confirming?.noteLabel}
        onConfirm={(note) => apply(confirming!.to, note)}
      />

      <ShipDialog
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        orderId={p.orderId}
        courierName={p.courierName}
        trackingNumber={p.trackingNumber}
        internalNotes={p.internalNotes}
        onShipped={() => apply("shipped")}
      />
    </section>
  );
}

function ShipDialog({
  open,
  onClose,
  orderId,
  courierName,
  trackingNumber,
  internalNotes,
  onShipped,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  courierName: string | null;
  trackingNumber: string | null;
  internalNotes: string | null;
  onShipped: () => Promise<boolean>;
}) {
  const [courier, setCourier] = useState(courierName ?? "");
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    if (courier.trim() !== (courierName ?? "") || tracking.trim() !== (trackingNumber ?? "")) {
      const meta = await updateOrderMetaAction(orderId, { courierName: courier, trackingNumber: tracking, internalNotes: internalNotes ?? "" });
      if (!meta.ok) {
        toast.error(meta.error);
        setBusy(false);
        return;
      }
    }
    const ok = await onShipped();
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <DashDialog
      open={open}
      onClose={() => !busy && onClose()}
      title="تسليم الطلب لشركة الشحن"
      description="اكتب شركة الشحن ورقم الشحنة إن وُجد ليصلا العميل في بريد الشحن ورسالة واتساب. الحقلان اختياريان."
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
            تراجع
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Truck className="size-4" aria-hidden="true" />}
            تم التسليم للشحن
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-ink-2">شركة الشحن أو اسم المندوب</span>
          <input
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            maxLength={80}
            placeholder="مثل: بوسطة، أرامكس، مندوب المتجر"
            className="min-h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-nova/50 focus:ring-2 focus:ring-nova/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-ink-2">رقم الشحنة</span>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            maxLength={80}
            dir="ltr"
            inputMode="text"
            className="min-h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-end text-[13px] text-ink outline-none focus:border-nova/50 focus:ring-2 focus:ring-nova/20"
          />
        </label>
      </div>
    </DashDialog>
  );
}
