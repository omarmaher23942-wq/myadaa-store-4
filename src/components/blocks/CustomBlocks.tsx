// CustomBlocks — بلوكات نصية حرة (heading / paragraph / divider) بشريط جانبي مميز.
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import type * as S from "@/blueprint/schema";
import type { z } from "zod";

type CustomBlocksSection = z.infer<typeof S.customBlocksSection>;

export function CustomBlocks({ s }: { s: CustomBlocksSection }) {
  const blocks = s.blocks ?? [];
  if (blocks.length === 0) return null;

  return (
    <SectionShell s={s}>
      {s.title ? <SectionHeading title={s.title} sectionId={s.id} /> : null}
      <div className="mx-auto max-w-3xl space-y-4" dir="rtl">
        {blocks.map((b, i) => {
          if (b.kind === "heading") {
            return (
              <h3
                key={i}
                className="mt-4 font-black font-heading text-xl tracking-tight sm:text-2xl"
                style={{ color: "var(--foreground)" }}
              >
                {b.text}
              </h3>
            );
          }
          if (b.kind === "paragraph") {
            return (
              <p
                key={i}
                className="text-xs leading-relaxed opacity-85 sm:text-sm"
                style={{ color: "var(--foreground)" }}
              >
                {b.text}
              </p>
            );
          }
          if (b.kind === "divider") {
            return (
              <hr
                key={i}
                className="my-6 border-t opacity-30"
                style={{ borderColor: "var(--border)" }}
              />
            );
          }
          return null;
        })}
      </div>
    </SectionShell>
  );
}