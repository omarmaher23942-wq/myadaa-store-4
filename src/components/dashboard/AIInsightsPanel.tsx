"use client";

// components/dashboard/AIInsightsPanel.tsx — لوحة تحليل ذكية (عرض فقط).
//
// القاعدة الحاسمة:
// نتلقّى Insight[] كـ props JSON-serializable من Server Component.
// كل Insight فيه iconName (string)، وليس React component — لأن Server
// Components لا يمكنها تمرير functions للـ Client.
//
// هذا الملف يحوّل iconName إلى مكوّن Lucide عبر ICON_MAP.
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  ShoppingCart,
  Eye,
  Users,
  Package,
  Flame,
  X,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { Insight, InsightIconName, InsightTone } from "@/lib/insights";

const SW = 1.75;

// ─── خريطة الأيقونات: iconName → مكوّن Lucide ──────────────────────────────
// أي اسم جديد في `InsightIconName` يجب أن يُضاف هنا.
const ICON_MAP: Record<InsightIconName, LucideIcon> = {
  "trending-up": TrendingUp,
  "alert-triangle": AlertTriangle,
  lightbulb: Lightbulb,
  sparkles: Sparkles,
  "shopping-cart": ShoppingCart,
  eye: Eye,
  users: Users,
  package: Package,
  flame: Flame,
};

// الافتراضي لكل tone إذا لم يُحدَّد iconName.
const DEFAULT_ICON_BY_TONE: Record<InsightTone, LucideIcon> = {
  growth: TrendingUp,
  warning: AlertTriangle,
  opportunity: Lightbulb,
  info: Sparkles,
};

const TONE_STYLES: Record<
  InsightTone,
  { wrap: string; iconWrap: string; iconColor: string; metricColor: string }
> = {
  growth: {
    wrap: "border-emerald-400/25 bg-emerald-500/[0.05]",
    iconWrap: "bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    metricColor: "text-emerald-600 dark:text-emerald-300",
  },
  warning: {
    wrap: "border-amber-400/25 bg-amber-500/[0.05]",
    iconWrap: "bg-amber-500/15",
    iconColor: "text-amber-700 dark:text-amber-300",
    metricColor: "text-amber-700 dark:text-amber-300",
  },
  opportunity: {
    wrap: "border-violet-400/25 bg-violet-500/[0.05]",
    iconWrap: "bg-violet-500/15",
    iconColor: "text-violet-600 dark:text-violet-300",
    metricColor: "text-violet-600 dark:text-violet-300",
  },
  info: {
    wrap: "border-edge/10 bg-edge/[0.02]",
    iconWrap: "bg-nova/15",
    iconColor: "text-nova-2",
    metricColor: "text-nova-2",
  },
};

const HIDDEN_KEY = "clp_ai_insights_hidden";

function resolveIcon(insight: Insight): LucideIcon {
  if (insight.iconName && ICON_MAP[insight.iconName]) {
    return ICON_MAP[insight.iconName];
  }
  return DEFAULT_ICON_BY_TONE[insight.tone];
}

export function AIInsightsPanel({
  insights,
  title = "تحليلات ذكية",
}: {
  insights: Insight[];
  title?: string;
}) {
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);

  // Persist hidden insights across sessions.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setHidden(new Set(arr));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const hideInsight = (id: string) => {
    const next = new Set(hidden);
    next.add(id);
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  // دفاع: تأكد أن insights مصفوفة فعلاً (يمنع .filter على undefined).
  const visible = useMemo(() => {
    const safe = Array.isArray(insights) ? insights : [];
    return safe.filter((i) => !hidden.has(i.id)).slice(0, 5);
  }, [insights, hidden]);

  if (dismissed || visible.length === 0) return null;

  return (
    <section
      aria-label="لوحة التحليلات الذكية"
      className="relative overflow-hidden rounded-2xl border border-edge/10 bg-gradient-to-b from-edge/[0.02] to-transparent p-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 start-1/3 size-64 rounded-full bg-nova/10 blur-3xl"
      />

      <header className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-nova to-aurora text-white shadow-md">
            <Sparkles className="size-4" strokeWidth={SW} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-black text-ink">{title}</h2>
            <p className="mt-0.5 text-[10.5px] text-ink-3">
              {visible.length} ملاحظة مبنية على بياناتك
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="إخفاء اللوحة"
          className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
        >
          <X className="size-3.5" strokeWidth={SW} aria-hidden="true" />
        </button>
      </header>

      <ul className="relative space-y-2.5">
        <AnimatePresence initial={false}>
          {visible.map((insight) => {
            const tone = TONE_STYLES[insight.tone];
            const Icon = resolveIcon(insight);
            return (
              <motion.li
                key={insight.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: 24 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl border p-3.5",
                  tone.wrap
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl",
                    tone.iconWrap,
                    tone.iconColor
                  )}
                >
                  <Icon className="size-4" strokeWidth={SW} aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-[12.5px] font-black text-ink">
                      {insight.title}
                    </p>
                    {insight.metric ? (
                      <span
                        className={cn(
                          "font-mono text-sm font-black tabular-nums",
                          tone.metricColor
                        )}
                      >
                        {insight.metric.value}
                        {insight.metric.delta !== undefined ? (
                          <span className="ms-1 text-[11px] font-bold">
                            {insight.metric.delta > 0 ? "+" : ""}
                            {insight.metric.delta}%
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-2/85">
                    {insight.message}
                  </p>

                  {insight.action ? (
                    <Link
                      href={insight.action.href}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg border border-edge/10 bg-edge/[0.04] px-2.5 py-1 text-[10.5px] font-bold text-ink transition-colors hover:bg-edge/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
                    >
                      {insight.action.label}
                      <ArrowLeft
                        className="size-3"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </Link>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => hideInsight(insight.id)}
                  aria-label="تجاهل هذه الملاحظة"
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 opacity-0 transition-opacity hover:bg-edge/10 hover:text-ink group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
                >
                  <X className="size-3" strokeWidth={SW} aria-hidden="true" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}

// نعيد التصدير من lib/insights للتسهيل على المستهلكين القدامى.
export type { Insight, InsightIconName, InsightTone } from "@/lib/insights";
export { generateInsights } from "@/lib/insights";