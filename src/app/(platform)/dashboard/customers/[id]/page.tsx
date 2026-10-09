// dashboard/customers/[id]/page.tsx — ملف العميل: التواصل (اتصال، واتساب، نسخ)، والعنوان، ومجاميعه الحقيقية من الطلبات،
// وكل طلباته بحالاتها، وأكثر ما يشتريه، وملاحظات خاصة، وحظر برقمه.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Mail, MapPin, MessageCircle, Phone, ShoppingBag } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { customerProfile } from "@/server/repos/customers-list";
import { StatusChip, timeAgo } from "@/components/dashboard/orders/parts";
import { BlockCustomer, CustomerNotes } from "@/components/dashboard/customers/CustomerActions";
import { formatEgp } from "@/lib/money";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { governorateName } from "@/lib/egypt";
import { prettyPhone } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import { paymentMethodLabel } from "@/lib/order-status";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  const session = await getMerchantSession();
  if (!session) redirect(`/login?redirect=/dashboard/customers/${id}`);
  if (!session.storeId) redirect(NO_STORE_HREF);
  if (!UUID.test(id)) notFound();
  const profile = await customerProfile(session.storeId, id);
  if (!profile) notFound();
  return profile;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await load(id);
  return { title: p.customer.name };
}

const day = (iso: string) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(new Date(iso));

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { customer: c, orders, topProducts, firstOrderAt } = await load(id);
  const wa = waLink(c.phone);
  const avg = c.delivered ? Math.round(c.spentPiasters / c.delivered) : null;
  const place = [c.governorate ? governorateName(c.governorate) : null, c.city, c.address].filter(Boolean).join("، ");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/dashboard/customers" className="inline-flex min-h-10 items-center gap-1.5 text-[12.5px] font-bold text-ink-3 transition-colors hover:text-ink">
        <ArrowRight className="size-4" aria-hidden="true" />
        العملاء
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight text-ink">{c.name}</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {firstOrderAt ? `أول طلب ${day(firstOrderAt)}` : `أُضيف ${day(c.createdAt)}`}
            {c.lastOrderAt ? ` · آخر طلب ${timeAgo(c.lastOrderAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-ok px-4 text-[12.5px] font-black text-white">
              <MessageCircle className="size-4" aria-hidden="true" />
              واتساب
            </a>
          ) : null}
          <a href={`tel:${c.phone}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5 hover:text-ink">
            <Phone className="size-4" aria-hidden="true" />
            اتصال
          </a>
          <BlockCustomer id={c.id} name={c.name} blocked={c.isBlocked} />
        </div>
      </header>

      {c.isBlocked ? (
        <p className="rounded-2xl border border-bad/25 bg-bad/[0.07] p-3.5 text-[12.5px] leading-6 text-bad">
          <b>محظور:</b> لا يستطيع إتمام طلب جديد برقم {prettyPhone(c.phone)}. طلباته السابقة كما هي.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="استلم" value={arCount(c.delivered, NOUN.order)} />
        <Stat label="اشترى بـ" value={c.spentPiasters ? formatEgp(c.spentPiasters) : "—"} />
        <Stat label="متوسط الطلب" value={avg ? formatEgp(avg) : "—"} />
        <Stat label="أرجع" value={c.returned ? arCount(c.returned, NOUN.order) : "لا شيء"} tone={c.returned ? "warn" : undefined} />
      </dl>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="dash-card overflow-hidden" aria-labelledby="orders-h">
          <header className="flex items-center justify-between gap-2 border-b border-edge/[0.06] p-4">
            <h2 id="orders-h" className="text-[14px] font-black text-ink">
              الطلبات <span className="font-bold text-ink-3">({fmtNum(orders.length)})</span>
            </h2>
            {c.open ? <span className="rounded-full bg-nova/12 px-2 py-0.5 text-[11px] font-black text-nova-2">{arCount(c.open, NOUN.openOrder)}</span> : null}
          </header>
          {orders.length ? (
            <ul className="divide-y divide-edge/[0.05]">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/dashboard/orders/${o.id}`} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-edge/[0.025]">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12.5px] font-black text-ink" dir="ltr">
                          {o.code}
                        </span>
                        <StatusChip status={o.status} />
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-ink-3">
                        {o.firstItem ? `${o.firstItem}${o.pieces > 1 ? ` و${arCount(o.pieces - 1, NOUN.piece)} أخرى` : ""}` : arCount(o.pieces, NOUN.piece)} · {paymentMethodLabel(o.paymentMethod)}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-[13px] font-black tabular-nums text-ink">{formatEgp(o.totalPiasters)}</p>
                      <p className="text-[11px] text-ink-3">{timeAgo(o.createdAt)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-[12.5px] text-ink-3">لا طلبات لهذا العميل (طلبات التجربة لا تظهر).</p>
          )}
        </section>

        <aside className="space-y-4">
          <section className="dash-card space-y-3 p-4" aria-labelledby="contact-h">
            <h2 id="contact-h" className="text-[14px] font-black text-ink">التواصل والعنوان</h2>
            <ul className="space-y-2.5 text-[12.5px] text-ink-2">
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
                <span>
                  <span dir="ltr" className="font-bold tabular-nums text-ink">
                    {prettyPhone(c.phone)}
                  </span>
                  {c.altPhone ? (
                    <span className="block text-ink-3">
                      بديل: <span dir="ltr" className="tabular-nums">{prettyPhone(c.altPhone)}</span>
                    </span>
                  ) : null}
                </span>
              </li>
              {c.email ? (
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
                  <a href={`mailto:${c.email}`} className="break-all hover:text-nova-2" dir="ltr">
                    {c.email}
                  </a>
                </li>
              ) : null}
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
                <span>{place || <span className="text-ink-3">لا عنوان محفوظ</span>}</span>
              </li>
            </ul>
          </section>

          {topProducts.length ? (
            <section className="dash-card space-y-2.5 p-4" aria-labelledby="top-h">
              <h2 id="top-h" className="flex items-center gap-1.5 text-[14px] font-black text-ink">
                <ShoppingBag className="size-4 text-ink-3" aria-hidden="true" />
                أكثر ما يطلبه
              </h2>
              <ul className="space-y-1.5 text-[12.5px]">
                {topProducts.map((t) => (
                  <li key={`${t.productId}-${t.name}`} className="flex items-center justify-between gap-2">
                    {t.productId ? (
                      <Link href={`/dashboard/products/${t.productId}`} className="truncate font-bold text-ink-2 hover:text-nova-2">
                        {t.name}
                      </Link>
                    ) : (
                      <span className="truncate text-ink-3">{t.name}</span>
                    )}
                    <span className="shrink-0 tabular-nums text-ink-3">{arCount(t.pieces, NOUN.piece)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="dash-card space-y-2.5 p-4" aria-labelledby="notes-h">
            <h2 id="notes-h" className="text-[14px] font-black text-ink">ملاحظاتك</h2>
            <CustomerNotes id={c.id} initial={c.notes} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="dash-card p-3 sm:p-4">
      <dt className="text-[11.5px] font-bold text-ink-3">{label}</dt>
      <dd className={`mt-1 truncate text-[16px] font-black tabular-nums sm:text-[18px] ${tone === "warn" ? "text-warn" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
