// Testimonials — آراء العملاء الحقيقية فقط: تقييمات المشترين المعتمدة من صفحة التقييمات، ولقطات شاشة لرسائل عملاء
// يرفعها التاجر بنفسه (تُعرض صورةً كما هي). أي رأي مكتوب بلا مصدر (كما كان يكتبه الذكاء الاصطناعي سابقاً) لا يُعرض.
// «مشترٍ موثق» فقط لتقييم جاء من طلب فعلي؛ لقطة التاجر لا تحمل الشارة (لا نتحقق منها).
import { z } from "zod";
import Image from "next/image";
import { Star, BadgeCheck } from "lucide-react";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { reviews } from "@/db/schema";
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import { isHostedImage } from "@/lib/media-hosts";
import type * as S from "@/blueprint/schema";
import type { Ctx } from "./_shared";

const SW = 1.75;
type Sec = z.infer<typeof S.testimonialsSection>;
type Review = { name: string; text: string; rating: number; verified: boolean };
type Shot = { url: string; alt: string; name: string; text: string };

export async function Testimonials({ s, ctx }: { s: Sec; ctx: Ctx }) {
  const shots: Shot[] = (Array.isArray(s.items) ? s.items : [])
    .filter((it) => it.screenshot?.url && isHostedImage(it.screenshot.url))
    .map((it) => ({ url: it.screenshot!.url, alt: it.screenshot!.alt || (it.name ? `رسالة من ${it.name}` : "رسالة من عميل"), name: it.name?.trim() ?? "", text: it.text?.trim() ?? "" }));

  let real: Review[] = [];
  if (s.includeVerifiedReviews) {
    try {
      const db = await getTenantDb(ctx.storeId);
      const rows = await db
        .select({ name: reviews.customerName, text: reviews.body, rating: reviews.rating, orderId: reviews.orderId, isVerified: reviews.isVerified })
        .from(reviews)
        .where(and(eq(reviews.storeId, ctx.storeId), eq(reviews.isApproved, true), isNotNull(reviews.body)))
        .orderBy(desc(reviews.rating), desc(reviews.createdAt))
        .limit(6);
      real = rows.filter((r) => r.text?.trim()).map((r) => ({ name: r.name, text: r.text!.trim(), rating: r.rating, verified: r.isVerified && Boolean(r.orderId) }));
    } catch {
      real = [];
    }
  }

  if (!shots.length && !real.length) return null;

  return (
    <SectionShell s={s as never}>
      <SectionHeading title={s.title || "آراء عملائنا"} subtitle={s.subtitle} sectionId={s.id} />
      {real.length ? (
        <div className="grid gap-4 sm:grid-cols-3" dir="rtl">
          {real.map((it, i) => (
            <figure key={i} className="s-card flex flex-col justify-between gap-3 p-5">
              <div className="space-y-2">
                <div className="flex items-center gap-1" style={{ color: "var(--warning)" }} aria-label={`${it.rating} من 5`}>
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="size-3.5" fill={idx < it.rating ? "currentColor" : "none"} strokeWidth={1.5} aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed opacity-90">«{it.text}»</blockquote>
              </div>
              <figcaption className="flex items-center justify-between gap-2 border-t pt-2 text-xs" style={{ borderColor: "var(--border)" }}>
                <span className="font-bold">{it.name}</span>
                {it.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: "var(--success)", background: "color-mix(in srgb, var(--success) 12%, transparent)" }}>
                    <BadgeCheck className="size-3" strokeWidth={SW} aria-hidden="true" /> مشترٍ موثق
                  </span>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {shots.length ? (
        <div className={real.length ? "mt-6 columns-2 gap-4 sm:columns-3" : "columns-2 gap-4 sm:columns-3"}>
          {shots.map((it, i) => (
            <figure key={i} className="s-card mb-4 break-inside-avoid overflow-hidden">
              <Image src={it.url} alt={it.alt} width={600} height={900} sizes="(min-width: 640px) 33vw, 50vw" className="h-auto w-full" />
              {it.name || it.text ? (
                <figcaption className="space-y-1 p-3 text-xs">
                  {it.text ? <p className="leading-relaxed opacity-90">{it.text}</p> : null}
                  {it.name ? <p className="font-bold">{it.name}</p> : null}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      ) : null}
    </SectionShell>
  );
}
