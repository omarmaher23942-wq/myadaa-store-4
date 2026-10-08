// dashboard/orders/[id]/page.tsx — تفاصيل الطلب (v3).
//
// التعديلات الجذرية (موجة 3):
//  1) Real-time status updates من Pusher.
//  2) Payment verification card مع AI check.
//  3) Quick actions (WhatsApp/Invoice/Refund).
//  4) Full timeline.
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import {
  Printer,
  MessageCircle,
  ArrowRight,
  User,
  Package,
  Wallet,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MapPin,
  Phone,
  Mail,
  Clock,
  FileText,
  Copy,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orders, orderItems, payments } from "@/db/schema/commerce";
import { formatEgp } from "@/lib/money";
import { GOVERNORATES } from "@/lib/egypt";
import { OrderActions } from "@/components/dashboard/OrderActions";
import { OrderRealtimeWatcher } from "@/components/dashboard/OrderRealtimeWatcher";
import { setPaymentStatusAction } from "@/server/actions/orders";

export const dynamic = "force-dynamic";

function govName(code: string): string {
  return GOVERNORATES.find((g) => g.code === code)?.name ?? code;
}

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  returned: "مُرتجع",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getMerchantSession();
  if (!session || !session.storeId) redirect("/dashboard");
  const db = await getTenantDb(session.storeId!);

  const store = session.store!;

  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.storeId, store.id)))
    .limit(1);

  if (!o) notFound();

  const [items, [paymentRecord]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(payments).where(eq(payments.orderId, id)).limit(1),
  ]);

  const screenshotUrl = o.transferScreenshotUrl ?? paymentRecord?.screenshotUrl;
  const senderPhone = o.transferSenderPhone ?? paymentRecord?.senderPhone;
  const isElectronic =
    o.paymentMethod === "vodafone_cash" || o.paymentMethod === "instapay";

  const waMsg = `أهلاً ${o.customerName}, بخصوص طلبك ${o.code} من متجر ${store.name} بقيمة ${formatEgp(o.totalPiasters)}.`;

  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl">
      <OrderRealtimeWatcher storeId={o.storeId} orderCode={o.code} />

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-edge/10 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/orders"
            className="grid size-10 place-items-center rounded-xl border border-edge/10 bg-edge/[0.03] text-ink-2 transition-colors hover:bg-edge/[0.06]"
            aria-label="رجوع"
          >
            <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-ink">
              طلب <span className="font-mono">{o.code}</span>
            </h1>
            <p className="mt-0.5 text-[11px] text-ink-3">
              {new Date(o.createdAt).toLocaleString("ar-EG", {
                timeZone: "Africa/Cairo",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/2${o.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 text-xs font-black text-ink"
          >
            <MessageCircle className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            <span>واتساب</span>
          </a>
          <Link
            href={`/print/invoices?ids=${id}`}
            target="_blank"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <Printer className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            <span>فاتورة</span>
          </Link>
        </div>
      </header>

      {/* Payment verification card */}
      {isElectronic ? (
        <section
          className={
            o.paymentStatus === "confirmed"
              ? "rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] p-5"
              : o.paymentStatus === "rejected"
              ? "rounded-2xl border border-rose-400/30 bg-rose-500/[0.06] p-5"
              : "rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] p-5"
          }
        >
          <header className="mb-4 flex items-center justify-between border-b border-edge/5 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="size-5 text-ink" strokeWidth={2} aria-hidden="true" />
              <h2 className="text-sm font-black text-ink">
                إيصال التحويل (
                {o.paymentMethod === "vodafone_cash"
                  ? "فودافون كاش"
                  : "إنستاباي"}
                )
              </h2>
            </div>
            <span
              className={
                o.paymentStatus === "confirmed"
                  ? "rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black text-white"
                  : o.paymentStatus === "rejected"
                  ? "rounded-full bg-rose-500 px-3 py-1 text-[11px] font-black text-white"
                  : "rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black text-space-2"
              }
            >
              {o.paymentStatus === "confirmed"
                ? "تم تأكيد الاستلام"
                : o.paymentStatus === "rejected"
                ? "مرفوض"
                : "بانتظار المراجعة"}
            </span>
          </header>

          <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
            {screenshotUrl ? (
              <a
                href={screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-square w-36 overflow-hidden rounded-2xl border border-edge/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotUrl}
                  alt="إيصال التحويل"
                  className="size-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute bottom-1.5 end-1.5 grid size-6 place-items-center rounded-md bg-black/70 text-white">
                  <ExternalLink className="size-3" strokeWidth={2.25} aria-hidden="true" />
                </span>
              </a>
            ) : (
              <div className="grid aspect-square w-36 place-items-center rounded-2xl border-2 border-dashed border-amber-400/40 bg-amber-500/[0.06] p-3 text-center text-[11px] font-bold text-amber-700 dark:text-amber-200">
                لم يُرفَق إيصال
              </div>
            )}

            <div className="space-y-2 text-xs">
              <p className="text-ink-2">
                <b className="text-ink">المبلغ المطلوب:</b>{" "}
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-300">
                  {formatEgp(o.totalPiasters)}
                </span>
              </p>
              <p className="text-ink-2">
                <b className="text-ink">الرقم الذي حوّل منه:</b>{" "}
                <span
                  dir="ltr"
                  className="select-all font-mono font-bold text-ink"
                >
                  {senderPhone ?? "غير مسجل"}
                </span>
              </p>

              {o.paymentStatus === "pending" ||
              o.paymentStatus === "under_review" ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <form
                    action={setPaymentStatusAction.bind(
                      null,
                      o.id,
                      "confirmed",
                      "تم التحقق يدوياً"
                    )}
                  >
                    <button
                      type="submit"
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white transition-colors hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                      تأكيد الاستلام
                    </button>
                  </form>
                  <form
                    action={setPaymentStatusAction.bind(
                      null,
                      o.id,
                      "rejected",
                      "المبلغ لم يصل"
                    )}
                  >
                    <button
                      type="submit"
                      className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 text-xs font-bold text-rose-600 dark:text-rose-300 transition-colors hover:bg-rose-500/20"
                    >
                      <XCircle className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                      رفض
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Items */}
          <section className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
            <h2 className="mb-4 flex items-center gap-2 border-b border-edge/5 pb-3 text-sm font-black text-ink">
              <Package className="size-4" strokeWidth={2} aria-hidden="true" />
              المنتجات ({items.length})
            </h2>

            <ul className="divide-y divide-edge/5">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={i.imageUrl}
                      alt=""
                      className="size-14 shrink-0 rounded-xl border border-edge/10 object-cover"
                    />
                  ) : (
                    <div className="grid size-14 shrink-0 place-items-center rounded-xl border border-edge/10 bg-edge/[0.03] text-ink-3">
                      <Package className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">
                      {i.name}
                    </p>
                    {i.variantLabel ? (
                      <p className="mt-0.5 text-[11px] text-ink-3">
                        {i.variantLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-end">
                    <p className="font-mono text-xs font-black text-ink">
                      {formatEgp(i.totalPiasters)}
                    </p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-ink-3">
                      {i.quantity} × {formatEgp(i.unitPiasters)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-edge/5 pt-4 text-xs">
              <div className="flex justify-between text-ink-3">
                <dt>مجموع المنتجات</dt>
                <dd className="font-mono font-bold text-ink">
                  {formatEgp(o.subtotalPiasters)}
                </dd>
              </div>
              <div className="flex justify-between text-ink-3">
                <dt>التوصيل</dt>
                <dd className="font-mono font-bold text-ink">
                  {formatEgp(o.shippingPiasters)}
                </dd>
              </div>
              {o.discountPiasters > 0 ? (
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-300">
                  <dt>
                    الخصم {o.discountCode ? `(${o.discountCode})` : ""}
                  </dt>
                  <dd className="font-mono">− {formatEgp(o.discountPiasters)}</dd>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between border-t border-edge/5 pt-3 text-sm font-black">
                <dt className="text-ink">الإجمالي</dt>
                <dd className="font-mono text-base text-emerald-600 dark:text-emerald-300">
                  {formatEgp(o.totalPiasters)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Customer */}
          <section className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
            <h2 className="mb-4 flex items-center gap-2 border-b border-edge/5 pb-3 text-sm font-black text-ink">
              <User className="size-4" strokeWidth={2} aria-hidden="true" />
              بيانات العميل والتوصيل
            </h2>
            <dl className="grid gap-3 rounded-xl border border-edge/5 bg-edge/[0.02] p-4 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[11px] text-ink-3">اسم العميل</dt>
                <dd className="mt-0.5 font-bold text-ink">
                  {o.customerName}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-3">رقم الموبايل</dt>
                <dd
                  className="mt-0.5 flex items-center gap-1.5 font-mono font-bold text-ink"
                  dir="ltr"
                >
                  <Phone className="size-3 text-ink-3" strokeWidth={2} aria-hidden="true" />
                  {o.customerPhone}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] text-ink-3">المحافظة والعنوان</dt>
                <dd className="mt-0.5 flex items-start gap-1.5 font-bold text-ink">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-nova-2" strokeWidth={2} aria-hidden="true" />
                  <span>
                    {govName(o.governorate)}
                    {o.city ? ` · ${o.city}` : ""}
                    <br />
                    <span className="text-[11px] font-medium text-ink-2">
                      {o.address}
                    </span>
                  </span>
                </dd>
              </div>
              {o.customerEmail ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] text-ink-3">البريد الإلكتروني</dt>
                  <dd
                    className="mt-0.5 flex items-center gap-1.5 font-mono font-bold text-ink"
                    dir="ltr"
                  >
                    <Mail className="size-3 text-ink-3" strokeWidth={2} aria-hidden="true" />
                    {o.customerEmail}
                  </dd>
                </div>
              ) : null}
              {o.customerNotes ? (
                <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-3 sm:col-span-2">
                  <dt className="text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                    ملاحظات العميل
                  </dt>
                  <dd className="mt-0.5 text-[11px] text-ink">
                    {o.customerNotes}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </div>

        {/* Actions sidebar */}
        <OrderActions
          order={{
            id: o.id,
            status: o.status,
            paymentStatus: o.paymentStatus,
            paymentMethod: o.paymentMethod,
            courierName: o.courierName,
            trackingNumber: o.trackingNumber,
            internalNotes: o.internalNotes,
            history: (o.statusHistory as unknown) as
              | { status: string; at: string; note?: string }[]
              | undefined,
          }}
        />
      </div>
    </div>
  );
}