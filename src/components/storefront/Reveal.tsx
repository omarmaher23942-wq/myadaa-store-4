"use client";

// Reveal — 6 kinds (fade, slide_up, zoom, stagger, kinetic, none).
// - يحترم prefers-reduced-motion تلقائياً (يصبح none).
// - whileInView لتشغيل الحركة عند الوصول.
// - RevealItem للأطفال داخل stagger container.
import { motion, useReducedMotion, type Variants } from "motion/react";
import type { Section } from "@/blueprint/schema";

const EASE = [0.22, 1, 0.36, 1] as const;

const V: Record<NonNullable<Section["reveal"]>, Variants> = {
  none: {},
  fade: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.55, ease: EASE } },
  },
  slide_up: {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  },
  zoom: {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: EASE } },
  },
  stagger: {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
  },
  kinetic: {
    hidden: { opacity: 0, y: 20, filter: "blur(8px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.7, ease: EASE },
    },
  },
};

export function Reveal({
  kind = "fade",
  children,
  className,
  as: Tag = "div",
  "data-tone": tone,
}: {
  kind?: Section["reveal"];
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "ul";
  "data-tone"?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce || kind === "none") {
    const Comp = Tag as unknown as React.ElementType;
    return (
      <Comp className={className} data-tone={tone}>
        {children}
      </Comp>
    );
  }

  const M = motion[Tag] as unknown as typeof motion.div;
  const variants = V[kind ?? "fade"];

  return (
    <M
      className={className}
      data-tone={tone}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
    >
      {children}
    </M>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}