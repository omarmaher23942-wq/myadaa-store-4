"use client";

// Client Component: عداد حي بالثواني + ألوان تحذيرية متدرجة.
// - setInterval مع cleanup صحيح.
// - aria-live="polite" للإعلان عن التحديثات.
// - احترام prefers-reduced-motion (يقفز مباشرة بدون transition).
// - Progress ring دائري SVG (أوضح بصرياً من الخطي لحالة واحدة).
// - يحسب النسبة على أساس 8 ساعات كحد أقصى افتراضي.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, ArrowLeft, Sparkles } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const SW = 1.75;
const MAX_REFERENCE_MS = 8 * 60 * 60 * 1000; // 8 ساعات كمرجع بصري.

type Tone = "emerald" | "amber" | "rose" | "expired";

const TONE_STYLES: Record<
  Tone,
  { ring: string; text: string; chip: string; stroke: string }
> = {
  emerald: {
    ring: "border-emerald-500/25 bg-emerald-500/[0.04]",
    text: "text-emerald-600 dark:text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    stroke: "#34d399",
  },
  amber: {
    ring: "border-amber-500/25 bg-amber-500/[0.04]",
    text: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    stroke: "#fbbf24",
  },
  rose: {
    ring: "border-rose-500/30 bg-rose-500/[0.05]",
    text: "text-rose-600 dark:text-rose-300",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    stroke: "#fb7185",
  },
  expired: {
    ring: "border-edge/10 bg-edge/[0.02]",
    text: "text-ink-3",
    chip: "bg-edge/5 text-ink-3",
    stroke: "#64748b",
  },
};

function pickTone(msLeft: number): Tone {
  if (msLeft <= 0) return "expired";
  const hours = msLeft / 3_600_000;
  if (hours < 1) return "rose";
  if (hours < 4) return "amber";
  return "emerald";
}

function formatRemaining(msLeft: number): string {
  if (msLeft <= 0) return "انتهت التجربة";
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) return `${days} يوم و ${hours} ساعة`;
  if (hours > 0) return `${hours} ساعة و ${minutes} دقيقة`;
  return `${minutes} دقيقة و ${seconds} ثانية`;
}

export function TrialCountdownCard({
  expiresAt,
  storeName,
  planPrice,
}: {
  expiresAt: string;
  storeName: string;
  planPrice: number;
}) {
  const targetMs = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [now, setNow] = useState<number>(() => Date.now());
  const reduce = useReducedMotion();
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    // حدّث كل ثانية — تكلفة ضئيلة، دقة مطلوبة.
    const id = setInterval(() => {
      if (mountedRef.current) setNow(Date.now());
    }, 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  const msLeft = Math.max(0, targetMs - now);
  const tone = pickTone(msLeft);
  const styles = TONE_STYLES[tone];

  const progress = Math.min(1, msLeft / MAX_REFERENCE_MS);
  const total = 2 * Math.PI * 26;
  const dashOffset = total * (1 - progress);

  return (
    <section
      aria-label="حالة التجربة"
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 transition-colors",
        styles.ring
      )}
    >
      <div className="flex items-center gap-5">
        {/* Progress ring */}
        <div className="relative size-16 shrink-0">
          <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="5"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke={styles.stroke}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={total}
              strokeDashoffset={dashOffset}
              style={{
                transition: reduce ? "none" : "stroke-dashoffset 0.9s linear",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Clock
              className={cn("size-5", styles.text)}
              strokeWidth={SW}
            />
          </div>
        </div>

        {/* Text + CTA */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-black",
                styles.chip
              )}
            >
              {tone === "expired" ? "انتهت" : "تجربة نشطة"}
            </span>
            <p className="truncate text-[12.5px] font-bold text-ink-2">
              {storeName}
            </p>
          </div>

          {/* aria-live: يُعلن التغيير للقارئ الشاشي كل ثانية */}
          <p
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "mt-1.5 text-lg font-black tabular-nums",
              styles.text
            )}
          >
            {tone === "expired" ? "انتهت التجربة" : formatRemaining(msLeft)}
          </p>

          <p className="mt-0.5 text-[11px] text-ink-3">
            {tone === "expired"
              ? "فعّل المتجر للاحتفاظ بمنتجاتك وطلباتك."
              : "متبقٍ قبل تجميد المتجر تلقائياً."}
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard/billing"
          className={cn(
            "group hidden shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-space md:inline-flex",
            tone === "expired"
              ? "bg-white text-space hover:bg-ink focus-visible:ring-edge"
              : "bg-gradient-to-b from-nova to-nova-deep text-white shadow-lg shadow-nova/25 hover:shadow-xl focus-visible:ring-nova-2"
          )}
        >
          <Sparkles className="size-3.5" strokeWidth={2.25} />
          <span>
            {tone === "expired"
              ? "فعّل الآن"
              : `فعّل بـ ${planPrice} ج`}
          </span>
          <ArrowLeft
            className="size-3.5 transition-transform group-hover:-translate-x-0.5"
            strokeWidth={2.5}
          />
        </Link>
      </div>

      {/* Mobile CTA — full width تحت */}
      <Link
        href="/dashboard/billing"
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-black md:hidden",
          tone === "expired"
            ? "bg-white text-space"
            : "bg-gradient-to-b from-nova to-nova-deep text-white shadow-lg shadow-nova/25"
        )}
      >
        <Sparkles className="size-3.5" strokeWidth={2.25} />
        <span>
          {tone === "expired"
            ? "فعّل الآن"
            : `فعّل بـ ${planPrice} ج`}
        </span>
      </Link>
    </section>
  );
}