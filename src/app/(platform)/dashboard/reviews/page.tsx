// dashboard/reviews/page.tsx — التقييمات: بانتظار الاعتماد أولاً، ومتوسط التقييم المعتمد، وفلتر النجوم، وصفحات، وشرح
// صادق لكيف تصل التقييمات (رابط في بريد «وصل طلبك»، وزر في «طلباتي»، ورسالة واتساب من صفحة الطلب).
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageSquareHeart, Star } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { listReviews, parseReviewsQuery, type ReviewsQuery } from "@/server/repos/reviews-list";
import { ReviewsManager } from "@/components/dashboard/reviews/ReviewsManager";
import { arCount, fmtDec, fmtNum, NOUN } from "@/lib/format";
import { NO_STORE_HREF } from "@/lib/edition";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "التقييمات" };

function href(q: ReviewsQuery, patch: Partial<ReviewsQuery>): string {
  const n = { ...q, ...patch };
  const p = new URLSearchParams();
  if (n.state !== "pending") p.set("state", n.state);
  if (n.stars) p.set("stars", String(n.stars));
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `/dashboard/reviews?${s}` : "/dashboard/reviews";
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/reviews");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  const q = parseReviewsQuery(await searchParams);
  const data = await listReviews(session.storeId, q);
  const { counts } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-ink">التقييمات</h1>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
          {counts.all ? (
            <>
              {arCount(counts.all, NOUN.review)}
              {counts.avg !== null ? (
                <>
                  {" "}· متوسط المعتمد <Star className="size-3.5 fill-warn text-warn" aria-hidden="true" />
                  <b className="tabular-nums text-ink">{fmtDec(Math.round(counts.avg * 10) / 10)}</b> من 5
                </>
              ) : null}
            </>
          ) : (
            "لا تقييمات بعد"
          )}
        </p>
      </header>

      <nav aria-label="حالة التقييم" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(
          [
            ["pending", "بانتظار اعتمادك", counts.pending],
            ["approved", "معتمد", counts.approved],
            ["all", "الكل", counts.all],
          ] as const
        ).map(([k, label, n]) => (
          <Link
            key={k}
            href={href(q, { state: k, page: 1 })}
            scroll={false}
            aria-current={q.state === k ? "page" : undefined}
            className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-bold transition-colors", q.state === k ? "border-nova bg-nova text-white" : "border-edge/10 text-ink-2 hover:bg-edge/[0.05]")}
          >
            {label}
            <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", q.state === k ? "bg-black/15" : "bg-edge/[0.06]")}>{fmtNum(n)}</span>
          </Link>
        ))}
        <span className="mx-1 hidden w-px self-stretch bg-edge/10 md:block" aria-hidden="true" />
        {[5, 4, 3, 2, 1].map((s) => (
          <Link
            key={s}
            href={href(q, { stars: q.stars === s ? null : s, page: 1 })}
            scroll={false}
            aria-current={q.stars === s ? "page" : undefined}
            className={cn("inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border px-2.5 text-[12px] font-bold transition-colors", q.stars === s ? "border-warn/40 bg-warn/12 text-warn" : "border-edge/10 text-ink-3 hover:bg-edge/[0.05]")}
          >
            {s}
            <Star className={cn("size-3.5", q.stars === s ? "fill-warn" : "")} aria-hidden="true" />
          </Link>
        ))}
      </nav>

      {data.rows.length ? (
        <>
          <ReviewsManager rows={data.rows} storeName={session.store.name} />
          {data.pages > 1 ? (
            <nav aria-label="صفحات التقييمات" className="flex items-center justify-between gap-3 pt-1">
              <PageLink disabled={q.page <= 1} href={href(q, { page: q.page - 1 })} label="السابقة" dir="prev" />
              <span className="text-[12px] font-bold tabular-nums text-ink-3">
                صفحة {fmtNum(q.page)} من {fmtNum(data.pages)}
              </span>
              <PageLink disabled={q.page >= data.pages} href={href(q, { page: q.page + 1 })} label="التالية" dir="next" />
            </nav>
          ) : null}
        </>
      ) : (
        <div className="dash-card flex flex-col items-center gap-2 px-6 py-12 text-center">
          <MessageSquareHeart className="size-8 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[14px] font-black text-ink">{q.state === "pending" && counts.all ? "لا تقييمات تنتظر اعتمادك" : q.stars ? `لا تقييمات بـ ${fmtNum(q.stars)} نجوم هنا` : "لا تقييمات هنا"}</p>
        </div>
      )}

      <section className="dash-card space-y-2 p-4 text-[12.5px] leading-6 text-ink-2" aria-labelledby="how-h">
        <h2 id="how-h" className="text-[13.5px] font-black text-ink">كيف تصلك التقييمات؟</h2>
        <ul className="list-disc space-y-1 ps-5">
          <li>حين تجعل الطلب «تم التسليم» يصل العميل بريد فيه زر «قيّم مشترياتك» (إن كتب بريده).</li>
          <li>ومن صفحة الطلب: زر واتساب «شكر وطلب تقييم» برابط يفتح التقييم مباشرة.</li>
          <li>ويظهر للعميل زر «قيّم مشترياتك» في «طلباتي» على جهازه بعد التسليم.</li>
        </ul>
        <p className="text-[12px] text-ink-3">كل تقييم من طلب مُسلَّم «موثّق»، ولا يظهر في صفحة المنتج قبل أن تعتمده.</p>
      </section>
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
