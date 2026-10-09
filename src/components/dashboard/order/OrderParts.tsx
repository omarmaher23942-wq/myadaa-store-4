"use client";

// OrderParts — أجزاء صفحة الطلب التفاعلية: مراجعة إيصال التحويل، ورسائل واتساب الجاهزة، وبيانات الشحن
// والملاحظات الداخلية، وزر النسخ.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Loader2, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { waLink } from "@/lib/whatsapp";
import { MESSAGE_LABEL, messageKindFor, orderMessage, type MessageKind, type MessageOrder } from "@/lib/order-messages";
import { setPaymentStatusAction, updateOrderMetaAction } from "@/server/actions/orders";
import { requestPulse } from "../DashboardPulse";
import { ConfirmDialog } from "../ui/DashDialog";

export function CopyButton({ text, label, done = "نُسخ", className }: { text: string; label: string; done?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error("تعذر النسخ تلقائياً؛ حدّد النص وانسخه يدوياً");
        }
      }}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova",
        className
      )}
    >
      {copied ? <Check className="size-3.5 text-ok" strokeWidth={2.5} aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}

/** زر واتساب برسالة تناسب حالة الطلب الآن، وقائمة ببقية الرسائل الجاهزة. */
export function WhatsAppMessages({ order, status, storeName }: { order: MessageOrder; status: string; storeName: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const suggested = messageKindFor(status, order.paymentStatus);
  const kinds: MessageKind[] = ["confirm", "preparing", "shipped", "delivered", "payment_rejected", "cancelled", "general"];
  const primary = waLink(order.customerPhone, orderMessage(suggested, order, storeName));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!primary) return <span className="text-[12px] text-ink-3">رقم العميل غير صالح لواتساب</span>;

  return (
    <div ref={wrap} className="relative inline-flex">
      <a
        href={primary}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-s-xl bg-ok/12 ps-3.5 pe-3 text-[12.5px] font-black text-ok transition-colors hover:bg-ok/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ok"
      >
        <MessageCircle className="size-4" strokeWidth={2.25} aria-hidden="true" />
        واتساب: {MESSAGE_LABEL[suggested]}
      </a>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="رسائل جاهزة أخرى"
        className="inline-flex min-h-11 items-center rounded-e-xl border-s border-ok/20 bg-ok/12 px-2.5 text-ok transition-colors hover:bg-ok/20"
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="absolute end-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-edge/10 bg-space-2 p-1.5 shadow-2xl shadow-black/30">
          {kinds.map((k) => (
            <a
              key={k}
              role="menuitem"
              href={waLink(order.customerPhone, orderMessage(k, order, storeName)) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-[12.5px] font-bold transition-colors hover:bg-edge/5",
                k === suggested ? "text-ok" : "text-ink-2"
              )}
            >
              {MESSAGE_LABEL[k]}
              {k === suggested ? <span className="text-[10.5px] font-black">المقترحة</span> : null}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PaymentReview({
  orderId,
  method,
  paymentStatus,
  totalPiasters,
  senderPhone,
  screenshotUrl,
  order,
  storeName,
}: {
  orderId: string;
  method: string;
  paymentStatus: string;
  totalPiasters: number;
  senderPhone: string | null;
  screenshotUrl: string | null;
  order: MessageOrder;
  storeName: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const reviewable = paymentStatus === "pending" || paymentStatus === "under_review";
  const methodName = method === "vodafone_cash" ? "فودافون كاش" : "إنستاباي";

  async function decide(decision: "confirmed" | "rejected", note?: string) {
    const r = await setPaymentStatusAction(orderId, decision, note);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(decision === "confirmed" ? "سُجّل وصول التحويل" : "سُجّل رفض الإيصال. أبلغ العميل على واتساب.");
    requestPulse();
    router.refresh();
    return true;
  }

  const state =
    paymentStatus === "confirmed"
      ? { label: "وصل التحويل", cls: "bg-ok/12 text-ok", box: "border-ok/25" }
      : paymentStatus === "rejected"
        ? { label: "الإيصال مرفوض", cls: "bg-bad/12 text-bad", box: "border-bad/25" }
        : { label: "بانتظار مراجعتك", cls: "bg-warn/12 text-warn", box: "border-warn/30" };

  const rejectLink = waLink(order.customerPhone, orderMessage("payment_rejected", order, storeName));

  return (
    <section aria-labelledby="payment-title" className={cn("dash-card border p-4 sm:p-5", state.box)}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="payment-title" className="text-[14px] font-black text-ink">
          تحويل {methodName}
        </h2>
        <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-black", state.cls)}>{state.label}</span>
      </header>

      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        {screenshotUrl ? (
          <a
            href={screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block aspect-[3/4] w-full max-w-[9rem] overflow-hidden rounded-2xl border border-edge/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={screenshotUrl} alt="صورة إيصال التحويل" className="size-full object-cover transition-transform group-hover:scale-105" />
            <span className="absolute bottom-1.5 end-1.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10.5px] font-bold text-white">
              <ExternalLink className="size-3" aria-hidden="true" />
              تكبير
            </span>
          </a>
        ) : (
          <div className="grid aspect-[3/4] w-full max-w-[9rem] place-items-center rounded-2xl border-2 border-dashed border-warn/40 bg-warn/[0.06] p-3 text-center text-[12px] font-bold text-warn">
            لم يُرفق العميل صورة إيصال
          </div>
        )}

        <div className="space-y-3 text-[13px]">
          <dl className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-ink-3">المبلغ المطلوب</dt>
              <dd className="text-[16px] font-black tabular-nums text-ink">{formatEgp(totalPiasters)}</dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-ink-3">حُوّل من رقم</dt>
              <dd className="flex items-center gap-2">
                <span dir="ltr" className="font-bold tabular-nums text-ink">
                  {senderPhone ?? "لم يُكتب"}
                </span>
                {senderPhone ? <CopyButton text={senderPhone} label="نسخ" className="min-h-8 px-2" /> : null}
              </dd>
            </div>
          </dl>
          {reviewable ? (
            <>
              <p className="text-[12px] leading-6 text-ink-3">افتح {methodName} وتأكد أن المبلغ وصل من هذا الرقم قبل أن تؤكد.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => start(async () => void (await decide("confirmed")))}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[12.5px] font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                  وصل المبلغ
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-bad/25 px-4 text-[12.5px] font-bold text-bad transition-colors hover:bg-bad/10 disabled:opacity-60"
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  لم يصل
                </button>
              </div>
            </>
          ) : paymentStatus === "rejected" && rejectLink ? (
            <a
              href={rejectLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ok/12 px-4 text-[12.5px] font-black text-ok hover:bg-ok/20"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              أبلغ العميل أن التحويل لم يصل
            </a>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="المبلغ لم يصل"
        description="يُسجَّل الإيصال مرفوضاً ويبقى الطلب كما هو حتى يعيد العميل التحويل أو تلغيه."
        confirmLabel="سجّل الرفض"
        tone="danger"
        noteLabel="السبب (اختياري، يظهر في سجل الطلب)"
        notePlaceholder="مثل: المبلغ ناقص، أو لم يصل أي تحويل"
        onConfirm={(note) => decide("rejected", note)}
      />
    </section>
  );
}

export function ShippingMetaForm({
  orderId,
  courierName,
  trackingNumber,
  internalNotes,
}: {
  orderId: string;
  courierName: string | null;
  trackingNumber: string | null;
  internalNotes: string | null;
}) {
  const initial = { courierName: courierName ?? "", trackingNumber: trackingNumber ?? "", internalNotes: internalNotes ?? "" };
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [busy, start] = useTransition();
  const dirty = form.courierName !== saved.courierName || form.trackingNumber !== saved.trackingNumber || form.internalNotes !== saved.internalNotes;

  const save = () =>
    start(async () => {
      const r = await updateOrderMetaAction(orderId, form);
      if (!r.ok) return void toast.error(r.error);
      setSaved(form);
      toast.success("حُفظت بيانات الشحن والملاحظات");
    });

  const field = "min-h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-nova/50 focus:ring-2 focus:ring-nova/20";

  return (
    <section aria-labelledby="meta-title" className="dash-card p-4 sm:p-5">
      <h2 id="meta-title" className="mb-3 text-[14px] font-black text-ink">
        الشحن وملاحظاتك
      </h2>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-ink-2">شركة الشحن أو المندوب</span>
          <input className={field} value={form.courierName} maxLength={80} onChange={(e) => setForm({ ...form, courierName: e.target.value })} placeholder="مثل: بوسطة" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-ink-2">رقم الشحنة</span>
          <input className={cn(field, "text-end")} dir="ltr" value={form.trackingNumber} maxLength={80} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-ink-2">ملاحظات داخلية (لا يراها العميل)</span>
          <textarea className={cn(field, "py-2.5")} rows={3} maxLength={2000} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
        </label>
        <button
          type="submit"
          disabled={!dirty || busy}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-nova px-4 text-[12.5px] font-black text-white transition hover:bg-nova-deep disabled:bg-edge/10 disabled:text-ink-3"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "جارٍ الحفظ…" : dirty ? "حفظ" : "محفوظ"}
        </button>
      </form>
    </section>
  );
}
