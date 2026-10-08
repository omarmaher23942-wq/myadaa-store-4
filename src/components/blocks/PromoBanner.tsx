// PromoBanner — بانرات خصم بشبكة 2 أعمدة + زر نسخ الكود.
import { Tag, Percent } from "lucide-react";
import { z } from "zod";
import { SectionShell } from "@/components/storefront/SectionShell";
import { CopyCode } from "@/components/storefront/CopyCode";
import type * as S from "@/blueprint/schema";

type PromoBannerSection = z.infer<typeof S.promoBannerSection>;

export function PromoBanner({ s }: { s: PromoBannerSection }) {
  const items = s.items ?? [];
  if (items.length === 0) return null;

  return (
    <SectionShell s={s}>
      <div className="grid gap-4 sm:grid-cols-2" dir="rtl">
        {items.map((it, i) => (
          <article
            key={i}
            className="flex flex-col gap-3 rounded-3xl border p-6 shadow-xs sm:p-8"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--card-foreground)",
            }}
          >
            <span
              className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-black"
              style={{
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Percent className="size-3" strokeWidth={2.5} aria-hidden="true" />
              عرض حصري
            </span>
            <h3 className="font-black font-heading text-lg sm:text-xl">
              {it.title}
            </h3>
            {it.text ? (
              <p className="text-xs leading-relaxed opacity-80">{it.text}</p>
            ) : null}
            {it.couponCode ? (
              <div className="pt-1">
                <CopyCode code={it.couponCode} />
              </div>
            ) : (
              <Tag
                className="size-4 opacity-30"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            )}
          </article>
        ))}
      </div>
    </SectionShell>
  );
}