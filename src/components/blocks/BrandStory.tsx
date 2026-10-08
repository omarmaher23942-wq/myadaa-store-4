// BrandStory — قصة المتجر بكلام صاحبه (أو فلسفته)، بتخطيط نصي مقتبس أو نص مع صورة.
import Image from "next/image";
import { Quote } from "lucide-react";
import { SectionShell } from "@/components/storefront/SectionShell";
import { Markdown } from "@/components/storefront/Markdown";
import { cn } from "@/lib/utils";
import type { BrandStorySection } from "@/blueprint/schema";

export function BrandStory({ s }: { s: BrandStorySection }) {
  if (!s.body?.trim()) return null;
  const withImage = Boolean(s.image) && s.variant !== "quote";
  return (
    <SectionShell s={s} hook="s-story">
      <div className={cn("grid items-center gap-8 md:gap-14", withImage ? "md:grid-cols-2" : "mx-auto max-w-3xl text-center")}>
        {withImage ? (
          <div className="s-hero-media s-media relative !aspect-[4/5] !p-0 md:order-2">
            <Image src={s.image!.url} alt={s.image!.alt || ""} fill sizes="(max-width: 768px) 100vw, 45vw" className="!absolute object-cover" />
          </div>
        ) : null}
        <div className={cn("flex flex-col gap-5", !withImage && "items-center")}>
          <h2 className="s-title font-heading">{s.title}</h2>
          <div className="s-sub !max-w-none !text-[15px] !leading-8 [&_p+p]:mt-3">
            <Markdown text={s.body} className="" />
          </div>
          {s.quote ? (
            <figure className={cn("s-card mt-2 flex gap-3 p-5", !withImage && "text-start")}>
              <Quote className="size-6 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <blockquote className="font-heading text-lg font-bold leading-relaxed">{s.quote}</blockquote>
            </figure>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}
