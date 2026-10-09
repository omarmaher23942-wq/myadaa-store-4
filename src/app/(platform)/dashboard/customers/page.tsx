// dashboard/customers/page.tsx — العملاء: شرائح بتعريفات معلنة وأعداد حقيقية (متكرر، جديد، طلب جارٍ، لم يعودوا، أرجعوا،
// محظور)، وبحث بالاسم أو الموبايل، وترتيب، وصفحات. كل رقم محسوب من الطلبات نفسها (customers-list.ts).
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, MessageCircle, Search, SearchX, Users } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { listCustomers, parseCustomersQuery, NEW_DAYS, WINBACK_DAYS, type CustomerRow, type CustomerSegment, type CustomersQuery, type CustomerSort } from "@/server/repos/customers-list";
import { timeAgo } from "@/components/dashboard/orders/parts";
import { formatEgp } from "@/lib/money";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { governorateName } from "@/lib/egypt";
import { prettyPhone } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import { NO_STORE_HREF } from "@/lib/edition";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "العملاء" };

type SP = Record<string, string | undefined>;

const SEGMENTS: { key: CustomerSegment; label: string; hint: string }[] = [
  { key: "all", label: "الكل", hint: "كل من طلب من متجرك" },
  { key: "repeat", label: "متكرر", hint: "استلم طلبين أو أكثر" },
  { key: "new", label: "جديد", hint: `أول طلب خلال ${NEW_DAYS} يوماً` },
  { key: "open", label: "طلب جارٍ", hint: "له طلب لم يُسلَّم بعد" },
  { key: "winback", label: "لم يعد", hint: `اشترى ولم يطلب منذ ${WINBACK_DAYS} يوماً` },
  { key: "returned", label: "أرجع طلباً", hint: "رفض الاستلام أو أرجع" },
  { key: "blocked", label: "محظور", hint: "لا يستطيع إتمام طلب" },
];

const SORTS: { key: CustomerSort; label: string }[] = [
  { key: "recent", label: "آخر طلب" },
  { key: "spent", label: "الأكثر شراءً" },
  { key: "orders", label: "الأكثر طلبات" },
  { key: "newest", label: "الأحدث انضماماً" },
];

function href(q: CustomersQuery, patch: Partial<CustomersQuery>): string {
  const n = { ...q, ...patch };
  const p = new URLSearchParams();
  if (n.segment !== "all") p.set("segment", n.segment);
  if (n.sort !== "recent") p.set("sort", n.sort);
  if (n.q) p.set("q", n.q);
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `/dashboard/customers?${s}` : "/dashboard/customers";
}

function lastSeen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Date.now() - d.getTime() < 7 * 86_400_000) return timeAgo(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "Africa/Cairo" }).format(d);
}

function Tags({ c }: { c: CustomerRow }) {
  const tags: { label: string; cls: string }[] = [];
  if (c.isBlocked) tags.push({ label: "محظور", cls: "bg-bad/12 text-bad" });
  if (c.delivered >= 2) tags.push({ label: "متكرر", cls: "bg-ok/12 text-ok" });
  if (c.open > 0) tags.push({ label: arCount(c.open, NOUN.openOrder), cls: "bg-nova/12 text-nova-2" });
  if (c.returned > 0) tags.push({ label: `أرجع ${arCount(c.returned, NOUN.times)}`, cls: "bg-warn/12 text-warn" });
  if (!tags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t.label} className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-black", t.cls)}>
          {t.label}
        </span>
      ))}
    </span>
  );
}

function Purchases({ c }: { c: CustomerRow }) {
  if (!c.orders) return <span className="text-ink-3">لم يطلب بعد</span>;
  return (
    <span>
      {arCount(c.orders, NOUN.order)}
      {c.delivered !== c.orders ? <span className="text-ink-3"> · استلم {fmtNum(c.delivered)}</span> : null}
    </span>
  );
}

export default async function DashboardCustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/customers");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  const query = parseCustomersQuery(await searchParams);
  const data = await listCustomers(session.storeId, query);
  const repeatRate = data.buyers ? Math.round((data.repeaters / data.buyers) * 100) : null;
  const empty = data.counts.all === 0 && !query.q;
  const seg = SEGMENTS.find((s) => s.key === query.segment)!;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">العملاء</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {empty ? "يظهر هنا كل من يطلب من متجرك تلقائياً." : `${arCount(data.counts.all, NOUN.customer)}${query.q ? " تطابق البحث" : ""}`}
          </p>
        </div>
        {!empty ? (
          <a
            href="/api/dashboard/customers/export"
            download
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-[12.5px] font-bold text-ink transition-colors hover:bg-edge/[0.06]"
          >
            <Download className="size-4" aria-hidden="true" />
            تصدير Excel
          </a>
        ) : null}
      </header>

      {empty ? (
        <div className="dash-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-nova/12 text-nova-2">
            <Users className="size-7" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="text-[15px] font-black text-ink">لا عملاء بعد</p>
          <p className="max-w-md text-[12.5px] leading-6 text-ink-3">مع أول طلب يُنشأ ملف للعميل برقمه: طلباته وما اشتراه وعنوانه، وتراسله على واتساب بضغطة.</p>
        </div>
      ) : (
        <>
          {!query.q ? (
            <dl className="grid grid-cols-3 gap-2">
              <Kpi label="اشتروا فعلاً" value={fmtNum(data.buyers)} hint="استلموا طلباً واحداً على الأقل" />
              <Kpi label="عادوا للشراء" value={repeatRate === null ? "—" : `${fmtNum(repeatRate)}%`} hint="من المشترين استلموا طلبين أو أكثر" />
              <Kpi label="مشترياتهم" value={formatEgp(data.spentPiasters)} hint="مجموع الطلبات المسلَّمة" />
            </dl>
          ) : null}

          <nav aria-label="شرائح العملاء" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {SEGMENTS.filter((s) => s.key === "all" || s.key === query.segment || data.counts[s.key] > 0).map((s) => {
              const active = query.segment === s.key;
              return (
                <Link
                  key={s.key}
                  href={href(query, { segment: s.key, page: 1 })}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  title={s.hint}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-bold transition-colors",
                    active ? "border-nova bg-nova text-white" : "border-edge/10 text-ink-2 hover:bg-edge/[0.05]"
                  )}
                >
                  {s.label}
                  <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-black/15" : "bg-edge/[0.06]")}>{fmtNum(data.counts[s.key])}</span>
                </Link>
              );
            })}
          </nav>
          {query.segment !== "all" ? <p className="-mt-1 text-[12px] text-ink-3">{seg.hint}.</p> : null}

          <form action="/dashboard/customers" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
            {query.segment !== "all" ? <input type="hidden" name="segment" value={query.segment} /> : null}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <input
                name="q"
                type="search"
                defaultValue={query.q}
                placeholder="اسم العميل أو موبايله (ولو آخر 4 أرقام)"
                aria-label="بحث في العملاء"
                enterKeyHint="search"
                className="min-h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] ps-9 pe-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-nova/50 focus:ring-2 focus:ring-nova/20"
              />
            </div>
            <nav aria-label="الترتيب" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {SORTS.map((s) => (
                <Link
                  key={s.key}
                  href={href(query, { sort: s.key, page: 1 })}
                  scroll={false}
                  aria-current={query.sort === s.key ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center rounded-xl border px-3 text-[12px] font-bold transition-colors",
                    query.sort === s.key ? "border-nova/40 bg-nova/12 text-nova-2" : "border-edge/10 text-ink-3 hover:bg-edge/[0.05] hover:text-ink"
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          </form>

          {data.rows.length ? (
            <>
              <div className="dash-card hidden overflow-hidden md:block">
                <table className="w-full text-[12.5px]">
                  <caption className="sr-only">العملاء</caption>
                  <thead className="border-b border-edge/[0.07] text-[11.5px] text-ink-3">
                    <tr>
                      <th scope="col" className="p-3 text-start font-bold">العميل</th>
                      <th scope="col" className="p-3 text-start font-bold">الطلبات</th>
                      <th scope="col" className="p-3 text-end font-bold">اشترى بـ</th>
                      <th scope="col" className="p-3 text-start font-bold">آخر طلب</th>
                      <th scope="col" className="w-14 p-3">
                        <span className="sr-only">واتساب</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge/[0.05]">
                    {data.rows.map((c) => {
                      const wa = waLink(c.phone);
                      return (
                        <tr key={c.id} className="transition-colors hover:bg-edge/[0.025]">
                          <td className="p-3">
                            <Link href={`/dashboard/customers/${c.id}`} className="font-black text-ink hover:text-nova-2">
                              {c.name}
                            </Link>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-3">
                              <span dir="ltr" className="tabular-nums">{prettyPhone(c.phone)}</span>
                              {c.governorate ? <span>{governorateName(c.governorate)}</span> : null}
                              <Tags c={c} />
                            </p>
                          </td>
                          <td className="p-3 text-ink-2">
                            <Purchases c={c} />
                          </td>
                          <td className="p-3 text-end font-black tabular-nums text-ink">{c.spentPiasters ? formatEgp(c.spentPiasters) : <span className="font-normal text-ink-3">—</span>}</td>
                          <td className="p-3 text-ink-2">{lastSeen(c.lastOrderAt)}</td>
                          <td className="p-3">
                            {wa ? (
                              <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`واتساب ${c.name}`} title="واتساب" className="grid size-9 place-items-center rounded-lg border border-ok/25 text-ok transition-colors hover:bg-ok/10">
                                <MessageCircle className="size-4" aria-hidden="true" />
                              </a>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-2 md:hidden">
                {data.rows.map((c) => {
                  const wa = waLink(c.phone);
                  return (
                    <li key={c.id} className="dash-card flex items-start gap-3 p-3.5">
                      <Link href={`/dashboard/customers/${c.id}`} className="min-w-0 flex-1">
                        <p className="flex items-center justify-between gap-2">
                          <span className="truncate text-[14px] font-black text-ink">{c.name}</span>
                          <span className="shrink-0 text-[11.5px] text-ink-3">{lastSeen(c.lastOrderAt)}</span>
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-3" dir="ltr">
                          <span className="tabular-nums">{prettyPhone(c.phone)}</span>
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-2">
                          <Purchases c={c} />
                          {c.spentPiasters ? <b className="tabular-nums text-ink">{formatEgp(c.spentPiasters)}</b> : null}
                        </p>
                        <div className="mt-1.5">
                          <Tags c={c} />
                        </div>
                      </Link>
                      {wa ? (
                        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`واتساب ${c.name}`} className="grid size-11 shrink-0 place-items-center rounded-xl border border-ok/25 text-ok">
                          <MessageCircle className="size-5" aria-hidden="true" />
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {data.pages > 1 ? (
                <nav aria-label="صفحات العملاء" className="flex items-center justify-between gap-3 pt-1">
                  <PageLink disabled={query.page <= 1} href={href(query, { page: query.page - 1 })} label="السابقة" dir="prev" />
                  <span className="text-[12px] font-bold tabular-nums text-ink-3">
                    صفحة {fmtNum(query.page)} من {fmtNum(data.pages)}
                  </span>
                  <PageLink disabled={query.page >= data.pages} href={href(query, { page: query.page + 1 })} label="التالية" dir="next" />
                </nav>
              ) : null}
            </>
          ) : (
            <div className="dash-card flex flex-col items-center gap-2 px-6 py-14 text-center">
              <SearchX className="size-8 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
              <p className="text-[14px] font-black text-ink">لا عملاء يطابقون هذا الاختيار</p>
              <p className="max-w-sm text-[12.5px] leading-6 text-ink-3">جرّب جزءاً من الاسم أو آخر 4 أرقام من الموبايل، أو اعرض كل العملاء.</p>
              <Link href="/dashboard/customers" className="mt-1 inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
                عرض كل العملاء
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="dash-card p-3 sm:p-4" title={hint}>
      <dt className="text-[11.5px] font-bold text-ink-3">{label}</dt>
      <dd className="mt-1 truncate text-[17px] font-black tabular-nums text-ink sm:text-[20px]">{value}</dd>
      <dd className="mt-0.5 hidden text-[11px] leading-5 text-ink-3 sm:block">{hint}</dd>
    </div>
  );
}

function PageLink({ href, label, dir, disabled }: { href: string; label: string; dir: "prev" | "next"; disabled: boolean }) {
  const Icon = dir === "prev" ? ChevronRight : ChevronLeft;
  const cls = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold";
  const body = (
    <>
      {dir === "prev" ? <Icon className="size-4" aria-hidden="true" /> : null}
      {label}
      {dir === "next" ? <Icon className="size-4" aria-hidden="true" /> : null}
    </>
  );
  if (disabled)
    return (
      <span className={cn(cls, "text-ink-3/50")} aria-disabled="true">
        {body}
      </span>
    );
  return (
    <Link href={href} className={cn(cls, "text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink")}>
      {body}
    </Link>
  );
}
