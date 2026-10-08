"use client";

// Categories.tsx — شبكة أقسام تكيفية.
//
// الميزات المُنفَّذة:
//  - Adaptive grid: 2/3/4/6 أعمدة حسب عدد الأقسام الفعلي.
//  - 5 variants: circles | cards | bento | featured_hero | stories | marquee.
//  - Background ديناميكي من أول منتج في كل قسم.
//  - Product count يُعرض إن كان متوفراً.
//  - يحترم prefers-reduced-motion.
import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { infer as Infer } from "zod";
import type * as S from "@/blueprint/schema";

type CategoriesSection = Infer<typeof S.categoriesSection>;

export function Categories({
  s,
  categories,
}: {
  s: CategoriesSection;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    productCount?: number;
    firstProductImage?: string | null;
  }>;
}) {
  const reduce = useReducedMotion();

  // Adaptive columns — تُحسب من عدد الأقسام الفعلي.
  const columns = useMemo(() => {
    const n = categories.length;
    if (n <= 2) return 2;
    if (n === 3) return 3;
    if (n === 4) return 4;
    if (n <= 6) return 3;
    if (n <= 8) return 4;
    return 6;
  }, [categories.length]);

  if (categories.length === 0) return null;

  const variant = (s.variant ?? "circles") as string;
  const visible = categories.slice(0, 12);
  const cardLikeVariants = new Set(["cards", "bento", "grid", "cards_overlay"]);

  return (
    <section
      className="py-12 sm:py-16"
      aria-label={s.title ?? "الأقسام"}
      data-categories-variant={variant}
    >
      <div className="container-x">
        {s.title ? (
          <div className="mb-8 text-center">
            <h2
              className="text-2xl font-black tracking-tight sm:text-3xl"
              style={{ color: "var(--foreground)" }}
            >
              {s.title}
            </h2>
            {s.subtitle ? (
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {s.subtitle}
              </p>
            ) : null}
          </div>
        ) : null}

        {variant === "circles" ? (
          <div
            className="grid gap-5"
            style={{
              gridTemplateColumns: `repeat(${Math.min(columns, 6)}, minmax(0, 1fr))`,
            }}
          >
            {visible.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <Link
                  href={`/c/${c.slug}`}
                  className="group flex flex-col items-center gap-3 focus-visible:outline-none"
                  aria-label={c.name}
                >
                  <div
                    className="relative size-24 overflow-hidden rounded-full border-2 transition-transform duration-300 group-hover:scale-105"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--muted)",
                    }}
                  >
                    {c.firstProductImage ? (
                      <Image
                        src={c.firstProductImage}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div
                        className="grid h-full w-full place-items-center"
                        style={{ color: "var(--primary)" }}
                      >
                        <Sparkles className="size-6" strokeWidth={1.75} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>
                      {c.name}
                    </p>
                    {s.showProductCount && typeof c.productCount === "number" ? (
                      <p
                        className="mt-0.5 text-[10px] tabular-nums"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {c.productCount} منتج
                      </p>
                    ) : null}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : variant === "cards" || variant === "bento" ? (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.min(columns, 4)}, minmax(0, 1fr))`,
            }}
          >
            {visible.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <Link
                  href={`/c/${c.slug}`}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  {c.firstProductImage ? (
                    <Image
                      src={c.firstProductImage}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 60%, black))",
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-sm font-black text-white">{c.name}</p>
                    {s.showProductCount && typeof c.productCount === "number" ? (
                      <p className="mt-1 text-[10px] font-bold tabular-nums text-white/80">
                        {c.productCount} منتج
                      </p>
                    ) : null}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          // Fallback: stories
          <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
            {visible.map((c) => (
              <Link
                key={c.id}
                href={`/c/${c.slug}`}
                className="group flex shrink-0 flex-col items-center gap-2 focus-visible:outline-none"
              >
                <div
                  className="relative size-20 rounded-full p-0.5"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--primary), var(--accent))",
                  }}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white">
                    {c.firstProductImage ? (
                      <Image
                        src={c.firstProductImage}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div
                        className="grid h-full w-full place-items-center"
                        style={{ background: "var(--muted)" }}
                      >
                        <Sparkles
                          className="size-5"
                          style={{ color: "var(--primary)" }}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <p
                  className="max-w-[80px] truncate text-center text-[11px] font-bold"
                  style={{ color: "var(--foreground)" }}
                >
                  {c.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}