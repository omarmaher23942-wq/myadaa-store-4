"use client";

// Motion primitives المستخدمة في كل أنحاء المتجر.
// - كل حركة تحترم prefers-reduced-motion.
// - flyToCart مُعاد بناؤه ليعمل مع أي عنصر يحمل data-fly-source
//   وحاوية السلة تحمل data-cart-icon.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useReducedMotion,
  animate,
  type DOMKeyframesDefinition,
} from "motion/react";
import { cn } from "@/lib/utils";
import { EASE, SPRING } from "@/lib/motion";

const DEFAULT_CART_ICON_SELECTOR = "[data-cart-icon]";
const DEFAULT_FLY_SOURCE_SELECTOR = "[data-fly-source]";

/* ─── Magnetic ───────────────────────────────────────────────────────────── */
export function Magnetic({
  children,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn(
        "inline-block transition-transform duration-200",
        reduce ? "" : "hover:scale-[1.03] active:scale-[0.98]",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ─── TiltCard ───────────────────────────────────────────────────────────── */
export function TiltCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      className={cn(
        "group relative transition-all duration-300",
        reduce ? "" : "hover:-translate-y-1",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ─── Parallax (no-op visual wrapper) ────────────────────────────────────── */
export function Parallax({
  children,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  return <div className={cn("overflow-hidden", className)}>{children}</div>;
}

/* ─── TextReveal ─────────────────────────────────────────────────────────── */
export function TextReveal({
  text,
  className,
  as: Tag = "h1",
  delay = 0,
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const M = motion[Tag];

  if (reduce) {
    const Component = Tag as keyof React.JSX.IntrinsicElements;
    const Comp = Component as unknown as React.ElementType;
    return <Comp className={className}>{text}</Comp>;
  }

  return (
    <M
      className={cn("flex flex-wrap gap-x-[0.3em]", className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.05, delayChildren: delay } },
      }}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className="inline-block overflow-hidden pb-[0.08em]"
          aria-hidden="true"
        >
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: 14, opacity: 0 },
              show: { y: 0, opacity: 1, transition: SPRING.smooth },
            }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </M>
  );
}

/* ─── Counter ────────────────────────────────────────────────────────────── */
export function Counter({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const num = parseFloat(value.replace(/[^\d.]/g, ""));
    if (isNaN(num) || reduce) {
      setDisplay(value);
      return;
    }

    const prefix = value.match(/^[^\d]/)?.[0] ?? "";
    const suffix = value.match(/[^\d.]*$/)?.[0] ?? "";

    const controls = animate(0, num, {
      duration: 1.4,
      ease: EASE.brand,
      onUpdate: (latest) => {
        const formatted = Number.isInteger(num)
          ? Math.round(latest).toLocaleString("en")
          : latest.toFixed(1);
        setDisplay(`${prefix}${formatted}${suffix}`);
      },
    });

    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {display}
    </span>
  );
}

/* ─── ImageReveal ────────────────────────────────────────────────────────── */
export function ImageReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      initial={
        reduce
          ? false
          : { clipPath: "inset(0 0 100% 0 round 1rem)", scale: 1.05 }
      }
      whileInView={{ clipPath: "inset(0 0 0% 0 round 1rem)", scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.8, ease: EASE.brand }}
    >
      {children}
    </motion.div>
  );
}

/* ─── ScrollProgress ─────────────────────────────────────────────────────── */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const w = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX: w, transformOrigin: "100% 0" }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-gradient-to-l from-[var(--primary)] to-[var(--accent)]"
    />
  );
}

/* ─── flyToCart (rebuilt) ────────────────────────────────────────────────── */

/**
 * flyToCart — يُحرّك صورة مصغّرة من المصدر إلى أيقونة السلة.
 *
 * مصادر الصورة (بالأولوية):
 *  1. fromEl.dataset.flySource (خاصية data-fly-source على العنصر)
 *  2. imgUrl المُمرَّر
 *  3. أول <img> داخل fromEl
 *
 * هدف السلة: أول عنصر بـ [data-cart-icon] (يجب أن يضيفه Header).
 *
 * آمن تماماً: يعمل مع reduced-motion (يتخطى)، بدون target (يتخطى)،
 * ونظيف الذاكرة (يحذف العنصر المتحرك بعد الانتهاء).
 */
export function flyToCart(fromEl: HTMLElement | null, imgUrl?: string) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!fromEl) return;

  const target = document.querySelector<HTMLElement>(
    DEFAULT_CART_ICON_SELECTOR
  );
  if (!target) return;

  const sourceUrl =
    imgUrl ||
    fromEl.dataset.flySource ||
    fromEl.querySelector<HTMLImageElement>("img")?.currentSrc ||
    fromEl.querySelector<HTMLImageElement>("img")?.src;
  if (!sourceUrl) return;

  // احترام اتجاه الصفحة: نقطة الانطلاق والوصول تُحسبان لاحقاً.
  const a = fromEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();

  // حجم الانطلاق ≈ الحجم المرئي للصورة المصدرية.
  const startSize = Math.max(48, Math.min(a.width, a.height));
  const endSize = 32;

  const img = document.createElement("img");
  img.src = sourceUrl;
  img.alt = "";
  img.decoding = "async";
  img.loading = "eager";
  Object.assign(img.style, {
    position: "fixed",
    left: `${a.left + (a.width - startSize) / 2}px`,
    top: `${a.top + (a.height - startSize) / 2}px`,
    width: `${startSize}px`,
    height: `${startSize}px`,
    objectFit: "cover",
    borderRadius: "16px",
    zIndex: "9999",
    pointerEvents: "none",
    willChange: "transform, opacity, left, top, width, height",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
  });
  document.body.appendChild(img);

  const targetX = b.left + b.width / 2 - endSize / 2;
  const targetY = b.top + b.height / 2 - endSize / 2;

  const keyframes: DOMKeyframesDefinition = {
    left: [`${a.left + (a.width - startSize) / 2}px`, `${targetX}px`],
    top: [`${a.top + (a.height - startSize) / 2}px`, `${targetY}px`],
    width: [`${startSize}px`, `${endSize}px`],
    height: [`${startSize}px`, `${endSize}px`],
    borderRadius: ["16px", "999px"],
    opacity: [1, 1, 0.85, 0],
    rotate: [0, 8],
  };

  animate(img, keyframes, { duration: 0.75, ease: EASE.brand }).then(() => {
    img.remove();
    // نبضة على أيقونة السلة للإشارة إلى نجاح الإضافة.
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.35)" },
        { transform: "scale(1)" },
      ],
      { duration: 350, easing: "cubic-bezier(.22,1,.36,1)" }
    );
  });
}

/**
 * flyToCartFromButton — واجهة مبسّطة للأزرار:
 * يبحث عن أقرب عنصر بـ [data-fly-source] تصاعدياً من الزر.
 */
export function flyToCartFromButton(button: HTMLElement | null) {
  if (!button) return;
  const fromEl =
    button.closest<HTMLElement>(DEFAULT_FLY_SOURCE_SELECTOR) ??
    button.parentElement;
  flyToCart(fromEl);
}