import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import { T } from "@/editor/EditorProvider";
import { FaqAccordion, FaqBubbles, type FaqItem } from "./FaqClient";
import { jsonLdString } from "@/lib/json-ld";

type FaqEntry = {
  q: string;
  a: string;
};

type Sec = {
  id: string;
  type: "faq";
  enabled: boolean;
  spacing: "compact" | "normal" | "spacious";
  background: "image" | "default" | "muted" | "primary" | "dark" | "gradient";
  reveal: "none" | "fade" | "slide_up" | "zoom" | "stagger";
  title?: string;
  subtitle?: string;
  variant: "accordion" | "two_columns" | "chat_bubbles";
  items: FaqEntry[];
};

export function Faq({ s }: { s: Sec }) {
  const items: FaqItem[] = (s.items ?? []).map((f: FaqEntry, i: number) => ({
    key: `${s.id}-${i}`,
    q: (
      <T sectionId={s.id} path={`items.${i}.q`}>
        {f.q}
      </T>
    ),
    a: (
      <T sectionId={s.id} path={`items.${i}.a`} as="p" className="leading-7 text-muted-foreground">
        {f.a}
      </T>
    ),
  }));

  /** بيانات منظمة للـ SEO: أسئلة الزبائن الحقيقية تظهر في نتائج البحث */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (s.items ?? []).map((f: FaqEntry) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const half = Math.ceil(items.length / 2);
  const variant = s.variant ?? "accordion";

  return (
    <SectionShell s={s as never} hook="s-faq">
      <SectionHeading title={s.title} subtitle={s.subtitle} sectionId={s.id} />
      {variant === "chat_bubbles" ? (
        <FaqBubbles items={items} />
      ) : variant === "two_columns" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <FaqAccordion items={items.slice(0, half)} />
          <FaqAccordion items={items.slice(half)} defaultOpen={null} />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <FaqAccordion items={items} />
        </div>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
    </SectionShell>
  );
}