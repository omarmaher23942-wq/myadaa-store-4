import { z } from "zod";
import Image from "next/image";
import { Star, BadgeCheck } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { reviews } from "@/db/schema";
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import type * as S from "@/blueprint/schema";
import type { Ctx } from "./_shared";

const SW = 1.75;
type Sec = z.infer<typeof S.testimonialsSection>;

export async function Testimonials({ s, ctx }: { s: Sec; ctx: Ctx }) {
  // آراء حقيقية فقط: تقييمات العملاء المعتمدة، أو لقطات شاشة رفعها التاجر بنفسه.
  // أي رأي مكتوب بلا مصدر (مثل ما كان يكتبه الذكاء الاصطناعي سابقاً) لا يُعرض أبداً.
  let items: any[] = Array.isArray(s.items) ? s.items.filter((it) => Boolean(it.screenshot)) : [];

  if (s.includeVerifiedReviews) {
    try {
      const db = await getTenantDb(ctx.storeId);
      const dbReviews = await db
        .select({
          id: reviews.id,
          customerName: reviews.customerName,
          rating: reviews.rating,
          body: reviews.body,
        })
        .from(reviews)
        .where(and(eq(reviews.storeId, ctx.storeId), eq(reviews.isApproved, true)))
        .orderBy(desc(reviews.createdAt))
        .limit(6);

      for (const r of dbReviews) {
        if (r.body) {
          items.push({
            name: r.customerName,
            text: r.body,
            rating: r.rating,
            verified: true,
          });
        }
      }
    } catch {}
  }

  // إخفاء القسم بالكامل إذا لم تكن هناك تقييمات معتمدة
  if (!items.length) return null;

  return (
    <SectionShell s={s as any}>
      <SectionHeading title={s.title || "آراء عملائنا"} subtitle={(s as { subtitle?: string }).subtitle} sectionId={s.id} />
      <div className="grid gap-4 sm:grid-cols-3" dir="rtl">
        {items.map((it, i) => (
          <div
            key={i}
            className="p-5 rounded-3xl border shadow-xs space-y-3 flex flex-col justify-between"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--card-foreground)",
            }}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={idx}
                    className="size-3.5"
                    fill={idx < (it.rating || 5) ? "currentColor" : "none"}
                    strokeWidth={1.5}
                  />
                ))}
              </div>
              <p className="text-xs leading-relaxed font-medium opacity-90">"{it.text}"</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: "var(--border)" }}>
              <span className="font-bold">{it.name}</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <BadgeCheck className="size-3" strokeWidth={SW} /> مشترٍ موثق
              </span>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}