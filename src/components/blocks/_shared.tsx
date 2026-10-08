// Shared helpers لهذا المجلد.
// ملاحظة: كُتب هنا للتوثيق — الملف موجود أصلاً في المشروع.
import Link from "next/link";
import type { z } from "zod";
import type { StoreBlueprint, Section } from "@/blueprint/schema";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";

/** نوع بيانات القسم من مخطط Zod الخاص به. */
export type Of<T extends z.ZodTypeAny> = z.infer<T>;
export type Ctx = {
  storeId: string;
  channels: StoreBlueprint["channels"];
};

export function Cta({
  cta,
  lg = false,
}: {
  cta: { label: string; target: StoreBlueprint["header"]["nav"][number]["target"]; style?: "primary" | "secondary" | "ghost" };
  lg?: boolean;
}) {
  const href = hrefFor(cta.target);
  const style = cta.style ?? "primary";
  const base =
    "inline-flex items-center justify-center rounded-2xl font-black transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
  const sizes = lg ? "h-12 px-7 text-sm sm:text-base" : "h-11 px-5 text-xs sm:text-sm";
  const styles = {
    primary: "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg hover:brightness-110",
    secondary:
      "bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)] hover:border-[var(--primary)]",
    ghost: "text-[var(--foreground)] hover:bg-white/5",
  }[style];
  return (
    <Link href={href} className={cn(base, sizes, styles)}>
      {cta.label}
    </Link>
  );
}

export type { StoreBlueprint };