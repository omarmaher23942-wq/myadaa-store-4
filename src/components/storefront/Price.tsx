import { formatEgp, savingsPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

// Price — نسخة مُحسَّنة:
// - عرض السعر الحالي بخط عريض واضح.
// - السعر المشطوب بخط رقيق.
// - شارة "وفّر X%" بخلفية خفيفة + حدود متناسقة مع هوية المتجر.
export function Price({
  price,
  compareAt,
  size = "md",
  showSavings = true,
}: {
  price: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  showSavings?: boolean;
}) {
  const pct = savingsPercent(price, compareAt);
  const hasDiscount = pct > 0;

  const sizes = {
    sm: {
      current: "text-sm",
      was: "text-[11px]",
      badge: "text-[10px] px-1.5 py-0.5 rounded",
    },
    md: {
      current: "text-base",
      was: "text-xs",
      badge: "text-[11px] px-2 py-0.5 rounded-md",
    },
    lg: {
      current: "text-2xl sm:text-3xl",
      was: "text-sm",
      badge: "text-xs px-2.5 py-1 rounded-lg",
    },
  }[size];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          "font-mono font-black tabular-nums leading-none",
          sizes.current
        )}
        style={{ color: "var(--foreground)" }}
      >
        {formatEgp(price)}
      </span>

      {hasDiscount && compareAt ? (
        <span
          className={cn(
            "font-mono font-semibold tabular-nums leading-none line-through opacity-50",
            sizes.was
          )}
        >
          {formatEgp(compareAt)}
        </span>
      ) : null}

      {hasDiscount && showSavings ? (
        <span
          className={cn(
            "inline-flex items-center font-black",
            sizes.badge
          )}
          style={{
            background: "color-mix(in srgb, #dc2626 12%, transparent)",
            color: "#dc2626",
          }}
        >
          وفّر {pct}%
        </span>
      ) : null}
    </div>
  );
}