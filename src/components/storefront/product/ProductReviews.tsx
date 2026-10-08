// تقييمات المنتج: ملخص (متوسط وتوزيع النجوم) ثم المراجعات المعتمدة فقط.
import { Star, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  customerName: string | null;
  rating: number;
  body: string | null;
  imageUrls: string[] | null;
  isVerified: boolean;
  createdAt: Date;
};

const fmtDate = (d: Date) => new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(d);

export function ProductReviews({ reviews, avg, count }: { reviews: Review[]; avg: number; count: number }) {
  if (!count && !reviews.length) return null;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  const max = Math.max(1, ...dist.map((d) => d.c));

  return (
    <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--border)" }} aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="font-heading text-xl font-black">
        آراء العملاء
      </h2>
      <div className="mt-6 grid gap-8 md:grid-cols-[260px_1fr]">
        <div className="space-y-4 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <div className="flex items-end gap-2">
            <span className="font-heading text-5xl font-black leading-none">{avg.toFixed(1)}</span>
            <span className="pb-1 text-sm opacity-60">من 5</span>
          </div>
          <Stars value={avg} />
          <p className="text-xs opacity-70">بناءً على {count} تقييم</p>
          <ul className="space-y-1.5">
            {dist.map((d) => (
              <li key={d.n} className="flex items-center gap-2 text-xs">
                <span className="w-3 font-bold">{d.n}</span>
                <Star className="size-3 fill-current" style={{ color: "var(--primary)" }} />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--muted)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${(d.c / max) * 100}%`, background: "var(--primary)" }} />
                </span>
                <span className="w-5 text-end tabular-nums opacity-60">{d.c}</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="space-y-4">
          {reviews.slice(0, 12).map((r) => (
            <li key={r.id} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid size-9 place-items-center rounded-full text-sm font-black"
                    style={{ background: "color-mix(in srgb, var(--primary) 14%, transparent)", color: "var(--primary)" }}
                  >
                    {Array.from(r.customerName?.trim() || "ع")[0]}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{r.customerName?.trim() || "عميل"}</p>
                    <p className="text-[11px] opacity-60">{fmtDate(r.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" }}>
                      <BadgeCheck className="size-3.5" /> مشتري مؤكد
                    </span>
                  ) : null}
                  <Stars value={r.rating} small />
                </div>
              </div>
              {r.body ? <p className="mt-3 text-sm leading-7 opacity-85">{r.body}</p> : null}
              {r.imageUrls?.length ? (
                <div className="mt-3 flex gap-2">
                  {r.imageUrls.slice(0, 4).map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="" loading="lazy" className="size-16 rounded-xl object-cover" />
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stars({ value, small }: { value: number; small?: boolean }) {
  return (
    <div className="flex" style={{ color: "var(--primary)" }} aria-label={`${value.toFixed(1)} من 5`}>
      {Array.from({ length: 5 }).map((_, k) => (
        <Star key={k} strokeWidth={1.75} className={cn(small ? "size-3.5" : "size-5", k < Math.round(value) ? "fill-current" : "opacity-25")} />
      ))}
    </div>
  );
}
