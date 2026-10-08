// TrustBadges — وعود المتجر الحقيقية (مفلترة بحقائقه في registry قبل الوصول هنا).
// الشبكة تتبع عدد العناصر بالضبط، فلا تبقى أعمدة فارغة أبداً:
//   2 = عمودان، 3 = ثلاثة أعمدة (وصفوف أفقية مريحة على الموبايل)، 4 = عمودان على الموبايل وأربعة على الكمبيوتر.
import { SectionShell } from "@/components/storefront/SectionShell";
import { Icon } from "@/components/storefront/Icon";
import { cn } from "@/lib/utils";
import type { TrustBadgesSection as Sec } from "@/blueprint/schema";

const GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function TrustBadges({ s }: { s: Sec }) {
  const items = (s.items ?? []).slice(0, 4);
  if (items.length < 2) return null;
  const n = items.length;
  const strip = s.variant === "compact_strip" || s.variant === "row";

  if (strip) {
    return (
      <SectionShell s={s} hook="s-trust">
        {/* فواصل نظيفة في أي عدد أعمدة: خلفية القائمة بلون الحد وفجوة 1px بين العناصر. */}
        <ul className={cn("s-card grid gap-px overflow-hidden", GRID[n])} style={{ background: "color-mix(in srgb, var(--foreground) 10%, var(--card))" }} aria-label="ما نضمنه لك">
          {items.map((it, i) => (
            <li key={`${it.title}-${i}`} className="flex items-center gap-3 bg-[var(--card)] p-4 sm:justify-center">
              <Icon name={it.icon} className="s-stroke size-5 shrink-0 text-[var(--primary)]" />
              <span className="min-w-0">
                <span className="block text-[13px] font-black leading-snug">{it.title}</span>
                {it.text ? <span className="mt-0.5 block text-[11.5px] leading-5 opacity-70">{it.text}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </SectionShell>
    );
  }

  return (
    <SectionShell s={s} hook="s-trust">
      <ul className={cn("grid gap-3 sm:gap-4", GRID[n])} aria-label="ما نضمنه لك">
        {items.map((it, i) => (
          <li
            key={`${it.title}-${i}`}
            className={cn("s-card flex gap-3.5 p-4 sm:p-5", n === 3 ? "items-center sm:flex-col sm:items-center sm:text-center" : "flex-col items-center text-center sm:items-center")}
          >
            <span className="s-icon">
              <Icon name={it.icon} className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black leading-snug">{it.title}</span>
              {it.text ? <span className="mt-1 block text-[12px] leading-relaxed opacity-75">{it.text}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
