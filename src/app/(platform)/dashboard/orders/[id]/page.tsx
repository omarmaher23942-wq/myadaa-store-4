// dashboard/orders/[id]/page.tsx — تفاصيل الطلب: الحالة وخطوتها التالية، ومراجعة التحويل، والأصناف والمبالغ
// (بما فيها رسوم التحصيل)، والعميل وسجله مع المتجر، وبيانات الشحن للنسخ، ورسائل واتساب جاهزة، وسجل الطلب.
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, ne, sql } from "drizzle-orm";
import { ArrowRight, Mail, MapPin, Package, Phone, Printer } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orders, orderItems, payments } from "@/db/schema";
import { formatEgp } from "@/lib/money";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { governorateName } from "@/lib/egypt";
import { cn } from "@/lib/utils";
import { collectNote, shippingLabelText, type MessageOrder } from "@/lib/order-messages";
import { reviewToken } from "@/lib/order-access";
import { storeUrl } from "@/lib/utils";
import {
  orderStatusLabel,
  orderStatusTone,
  paymentMethodLabel,
  paymentStatusLabel,
  PAYMENT_STATUS,
  TONE_CHIP,
  TONE_TEXT,
  type OrderStatus,
} from "@/lib/order-status";
import { OrderStatusPanel } from "@/components/dashboard/order/OrderStatusPanel";
import { CopyButton, PaymentReview, ShippingMetaForm, WhatsAppMessages } from "@/components/dashboard/order/OrderParts";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateTime = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Cairo",
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getMerchantSession();
  if (!session?.storeId || !UUID.test(id)) return { title: "الطلب" };
  const db = await getTenantDb(session.storeId);
  const [o] = await db
    .select({ code: orders.code })
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.storeId, session.storeId)))
    .limit(1);
  return { title: o ? `طلب ${o.code}` : "الطلب" };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getMerchantSession();
  if (!session?.storeId || !session.store) redirect("/dashboard");
  if (!UUID.test(id)) notFound();
  const store = session.store;
  const db = await getTenantDb(store.id);

  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.storeId, store.id)))
    .limit(1);
  if (!o) notFound();

  const [items, [paymentRecord], history] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, id), eq(orderItems.storeId, store.id))),
    db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, id), eq(payments.storeId, store.id)))
      .limit(1),
    db
      .select({
        status: orders.status,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.customerPhone, o.customerPhone), ne(orders.id, o.id), eq(orders.isTest, false)))
      .groupBy(orders.status),
  ]);

  const prev = Object.fromEntries(history.map((h) => [h.status, h.n])) as Partial<Record<OrderStatus, number>>;
  const prevTotal = history.reduce((a, h) => a + h.n, 0);
  const isElectronic = o.paymentMethod === "vodafone_cash" || o.paymentMethod === "instapay";
  const msgOrder: MessageOrder = {
    code: o.code,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerAltPhone: o.customerAltPhone,
    governorate: o.governorate,
    city: o.city,
    address: o.address,
    landmark: o.landmark,
    totalPiasters: o.totalPiasters,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    courierName: o.courierName,
    trackingNumber: o.trackingNumber,
    reviewUrl: o.status === "delivered" ? storeUrl(store.subdomain, `/review?o=${encodeURIComponent(o.code)}&t=${reviewToken(store.id, o.id)}`) : null,
  };
  const collect = collectNote(o);
  const timeline = [...o.statusHistory].reverse();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-3">
        <Link
          href="/dashboard/orders"
          className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-bold text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          كل الطلبات
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black text-ink">
              طلب <span dir="ltr">{o.code}</span>
              <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-black", TONE_CHIP[orderStatusTone(o.status)])}>
                {orderStatusLabel(o.status)}
              </span>
              {o.isTest ? <span className="rounded-full bg-warn/12 px-2.5 py-1 text-[12px] font-black text-warn">طلب تجريبي</span> : null}
            </h1>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {dateTime.format(o.createdAt)} · {paymentMethodLabel(o.paymentMethod)} ·{" "}
              <span className={cn("font-bold", TONE_TEXT[PAYMENT_STATUS[o.paymentStatus as keyof typeof PAYMENT_STATUS]?.tone ?? "muted"])}>
                {paymentStatusLabel(o.paymentStatus)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <WhatsAppMessages order={msgOrder} status={o.status} storeName={store.name} />
            <Link
              href={`/print/invoices?ids=${o.id}`}
              target="_blank"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 px-3.5 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink"
            >
              <Printer className="size-4" aria-hidden="true" />
              الفاتورة
            </Link>
          </div>
        </div>
      </header>

      {/* على الموبايل: الحالة أولاً ثم الدفع والأصناف؛ وعلى الشاشات الكبيرة عمودان (contents يذيب الغلافين). */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="contents lg:block lg:space-y-5">
          {isElectronic ? (
            <div className="order-2 lg:order-none">
              <PaymentReview
                orderId={o.id}
                method={o.paymentMethod}
                paymentStatus={o.paymentStatus}
                totalPiasters={o.totalPiasters}
                senderPhone={o.transferSenderPhone ?? paymentRecord?.senderPhone ?? null}
                screenshotUrl={o.transferScreenshotUrl ?? paymentRecord?.screenshotUrl ?? null}
                order={msgOrder}
                storeName={store.name}
              />
            </div>
          ) : null}

          <section aria-labelledby="items-title" className="dash-card order-3 p-4 sm:p-5 lg:order-none">
            <h2 id="items-title" className="mb-3 text-[14px] font-black text-ink">
              الأصناف ({fmtNum(items.reduce((a, i) => a + i.quantity, 0))} قطعة)
            </h2>
            <ul className="divide-y divide-edge/[0.06]">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt="" className="size-14 shrink-0 rounded-xl border border-edge/10 object-cover" />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-edge/10 bg-edge/[0.03] text-ink-3">
                      <Package className="size-5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {i.productId ? (
                      <Link href={`/dashboard/products/${i.productId}`} className="block truncate text-[13px] font-bold text-ink hover:text-nova-2">
                        {i.name}
                      </Link>
                    ) : (
                      <p className="truncate text-[13px] font-bold text-ink">{i.name}</p>
                    )}
                    {i.variantLabel ? <p className="mt-0.5 text-[12px] text-ink-3">{i.variantLabel}</p> : null}
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-[13px] font-black tabular-nums text-ink">{formatEgp(i.totalPiasters)}</p>
                    <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-3">
                      {fmtNum(i.quantity)} × {formatEgp(i.unitPiasters)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-2 border-t border-edge/[0.06] pt-3 text-[13px]">
              <Row label="المنتجات" value={formatEgp(o.subtotalPiasters)} />
              <Row label="الشحن" value={o.shippingPiasters > 0 ? formatEgp(o.shippingPiasters) : "مجاني"} />
              {o.codFeePiasters > 0 ? <Row label="رسوم الدفع عند الاستلام" value={formatEgp(o.codFeePiasters)} /> : null}
              {o.discountPiasters > 0 ? (
                <Row
                  label={`الخصم${o.discountCode ? ` (${o.discountCode})` : ""}`}
                  value={`− ${formatEgp(o.discountPiasters)}`}
                  className="text-ok"
                />
              ) : null}
              <div className="flex items-baseline justify-between border-t border-edge/[0.06] pt-2.5">
                <dt className="text-[14px] font-black text-ink">الإجمالي</dt>
                <dd className="text-[18px] font-black tabular-nums text-ink">{formatEgp(o.totalPiasters)}</dd>
              </div>
              <Row label="يحصّله المندوب" value={collect.text} className={cn("font-black", TONE_TEXT[collect.tone])} />
            </dl>
          </section>

          <section aria-labelledby="customer-title" className="dash-card order-4 p-4 sm:p-5 lg:order-none">
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="customer-title" className="text-[14px] font-black text-ink">
                العميل والتوصيل
              </h2>
              <CopyButton text={shippingLabelText(msgOrder, store.name)} label="انسخ بيانات الشحن" />
            </header>
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              <Field label="الاسم">
                {o.customerId ? (
                  <Link href={`/dashboard/customers/${o.customerId}`} className="font-bold text-ink hover:text-nova-2" title="ملف العميل وطلباته">
                    {o.customerName}
                  </Link>
                ) : (
                  o.customerName
                )}
              </Field>
              <Field label="الموبايل">
                <span className="flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${o.customerPhone}`}
                    dir="ltr"
                    className="inline-flex items-center gap-1.5 font-bold tabular-nums text-ink hover:text-nova-2"
                  >
                    <Phone className="size-3.5 text-ink-3" aria-hidden="true" />
                    {o.customerPhone}
                  </a>
                  {o.customerAltPhone ? (
                    <a href={`tel:${o.customerAltPhone}`} dir="ltr" className="text-[12px] tabular-nums text-ink-3 hover:text-ink">
                      {o.customerAltPhone}
                    </a>
                  ) : null}
                </span>
              </Field>
              <Field label="العنوان" wide>
                <span className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-nova-2" aria-hidden="true" />
                  <span>
                    <b>{governorateName(o.governorate)}</b>
                    {o.city ? ` · ${o.city}` : ""}
                    <span className="mt-0.5 block text-ink-2">{o.address}</span>
                    {o.landmark ? <span className="mt-0.5 block text-[12px] text-ink-3">علامة مميزة: {o.landmark}</span> : null}
                  </span>
                </span>
              </Field>
              {o.customerEmail ? (
                <Field label="البريد" wide>
                  <a href={`mailto:${o.customerEmail}`} dir="ltr" className="inline-flex items-center gap-1.5 text-ink hover:text-nova-2">
                    <Mail className="size-3.5 text-ink-3" aria-hidden="true" />
                    {o.customerEmail}
                  </a>
                </Field>
              ) : null}
              {o.customerNotes ? (
                <div className="rounded-xl border border-warn/20 bg-warn/[0.06] p-3 sm:col-span-2">
                  <dt className="text-[11.5px] font-black text-warn">ملاحظة العميل</dt>
                  <dd className="mt-1 text-[13px] text-ink">{o.customerNotes}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 rounded-xl border border-edge/[0.07] bg-edge/[0.02] p-3 text-[12.5px]">
              {prevTotal === 0 ? (
                <p className="text-ink-2">أول طلب لهذا الرقم من متجرك.</p>
              ) : (
                <p className="text-ink-2">
                  طلب من قبل {arCount(prevTotal, NOUN.order)}
                  {prev.delivered ? <span className="text-ok"> · استلم {fmtNum(prev.delivered)}</span> : null}
                  {prev.returned ? <span className="font-bold text-bad"> · رفض/أرجع {fmtNum(prev.returned)}</span> : null}
                  {prev.cancelled ? <span className="text-ink-3"> · أُلغي {fmtNum(prev.cancelled)}</span> : null}
                  {" · "}
                  <Link href={`/dashboard/orders?q=${encodeURIComponent(o.customerPhone)}`} className="font-bold text-nova-2 hover:text-ink">
                    عرض طلباته
                  </Link>
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="contents lg:block lg:space-y-5">
          <div className="order-1 lg:order-none">
            <OrderStatusPanel
              orderId={o.id}
              code={o.code}
              status={o.status}
              paymentMethod={o.paymentMethod}
              paymentStatus={o.paymentStatus}
              totalPiasters={o.totalPiasters}
              courierName={o.courierName}
              trackingNumber={o.trackingNumber}
              internalNotes={o.internalNotes}
            />
          </div>
          <div className="order-5 lg:order-none">
            <ShippingMetaForm orderId={o.id} courierName={o.courierName} trackingNumber={o.trackingNumber} internalNotes={o.internalNotes} />
          </div>

          <section aria-labelledby="timeline-title" className="dash-card order-6 p-4 sm:p-5 lg:order-none">
            <h2 id="timeline-title" className="mb-3 text-[14px] font-black text-ink">
              سجل الطلب
            </h2>
            <ol className="relative space-y-3 border-s border-edge/10 ps-4">
              {timeline.map((h, i) => (
                <li key={`${h.at}-${i}`} className="relative">
                  <span
                    className={cn("absolute -start-[1.3rem] top-1.5 size-2.5 rounded-full ring-4 ring-space-2", i === 0 ? "bg-nova" : "bg-edge/25")}
                    aria-hidden="true"
                  />
                  <p className="text-[12.5px] font-bold text-ink">{orderStatusLabel(h.status)}</p>
                  {h.note ? <p className="mt-0.5 text-[12px] leading-5 text-ink-2">{h.note}</p> : null}
                  <time dateTime={h.at} className="mt-0.5 block text-[11px] text-ink-3">
                    {dateTime.format(new Date(h.at))}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 text-ink-2", className)}>
      <dt>{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 font-bold text-ink">{children}</dd>
    </div>
  );
}
