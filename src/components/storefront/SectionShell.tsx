// SectionShell — غلاف كل قسم: المسافات والإيقاع والخلفية كلها من تصميم المتجر (blueprint/design.ts).
// data-tone يحدد نغمة القسم (أساسي/بديل/ملون/داكن)، والمخرج الفني يبادل بينها لإيقاع بصري مريح.
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";
import type { Section } from "@/blueprint/schema";
import { T } from "@/editor/EditorProvider";

const SPACING = {
  compact: "[--section-y:clamp(1.5rem,3vw,2.5rem)]",
  normal: "",
  spacious: "[--section-y:clamp(4rem,9vw,8rem)]",
} as const;

function toneOf(bg: Section["background"] | undefined): "base" | "alt" | "brand" | "ink" {
  switch (bg) {
    case "muted":
    case "gradient":
    case "ambient":
      return "alt";
    case "primary":
      return "brand";
    case "dark":
      return "ink";
    default:
      return "base";
  }
}

export function SectionShell({
  s,
  children,
  className,
  fullBleed = false,
  hook,
}: {
  s: Section;
  children: React.ReactNode;
  className?: string;
  fullBleed?: boolean;
  /** خطاف إضافي لجلد المتجر (مثل s-trust أو s-faq). */
  hook?: string;
}) {
  const hasImageBg = s.background === "image" && Boolean(s.backgroundImage);
  return (
    <Reveal
      as="section"
      kind={s.reveal}
      data-tone={hasImageBg ? "ink" : toneOf(s.background)}
      className={cn("s-section", hook, SPACING[(s.spacing as keyof typeof SPACING) ?? "normal"], hasImageBg && "overflow-hidden", className)}
    >
      {hasImageBg ? (
        <>
          <Image src={s.backgroundImage!.url} alt="" fill sizes="100vw" className="-z-10 object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/60" />
        </>
      ) : null}
      <div id={s.anchor ?? s.id} className={fullBleed ? undefined : "container-x"}>
        {children}
      </div>
    </Reveal>
  );
}

/** عنوان القسم بطابع المتجر (سطر علوي، أو خط سفلي، أو زخرفة...) حسب design.heading.style. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  sectionId,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  sectionId?: string;
}) {
  if (!title && !subtitle) return null;
  return (
    <div className="s-head" dir="rtl">
      {eyebrow ? <span className="s-eyebrow">{eyebrow}</span> : null}
      <div className="flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          {title ? (
            sectionId ? (
              <T sectionId={sectionId} path="title" as="h2" className="s-title font-heading">
                {title}
              </T>
            ) : (
              <h2 className="s-title font-heading">{title}</h2>
            )
          ) : null}
          {subtitle ? (
            sectionId ? (
              <T sectionId={sectionId} path="subtitle" as="p" className="s-sub mt-2">
                {subtitle}
              </T>
            ) : (
              <p className="s-sub mt-2">{subtitle}</p>
            )
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}
