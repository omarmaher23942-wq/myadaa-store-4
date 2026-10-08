"use client";

// Error Boundary مخصص لداشبورد Colapia.
// - يلتقط أخطاء الرندر في مساحة /dashboard ويعرض تجربة عربية فخمة بدل شاشة Next العامة.
// - يعرض error.digest كـ correlation ID قابل للنسخ لربط شكوى المستخدم بسجلاتنا.
// - أزرار: إعادة المحاولة (reset) — العودة للداشبورد — تواصل مع الدعم.
// - يحترم prefers-reduced-motion في كل animation.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  Copy,
  Check,
  RotateCcw,
  Home,
  LifeBuoy,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

type ErrorWithDigest = Error & { digest?: string };

export default function DashboardError({
  error,
  reset,
}: {
  error: ErrorWithDigest;
  reset: () => void;
}) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // نسجّل الخطأ مع الـ digest ليظهر في Vercel Logs بمعرّف قابل للتتبع.
    // eslint-disable-next-line no-console
    console.error(
      `[dashboard/error-boundary] digest=${error.digest ?? "no-digest"} message=${error.message}`
    );
  }, [error]);

  const copyDigest = useCallback(async () => {
    if (!error.digest) return;
    try {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard access denied — silent.
    }
  }, [error.digest]);

  const fadeUp = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
      className="relative mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center"
      dir="rtl"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 start-1/2 size-[480px] -translate-x-1/2 rounded-full bg-rose-500/10 blur-3xl" />
      </div>

      <motion.div
        variants={fadeUp}
        className="relative mb-7 flex size-20 items-center justify-center rounded-[26px] border border-rose-400/30 bg-gradient-to-br from-rose-500/[0.1] to-edge/[0.02] shadow-2xl shadow-black/40"
      >
        <AlertOctagon
          className="relative size-9 text-[#ff8a94]"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </motion.div>

      <motion.h1
        variants={fadeUp}
        className="text-2xl font-black leading-tight text-ink md:text-[30px]"
      >
        تعذر عرض هذه الصفحة
      </motion.h1>

      <motion.p
        variants={fadeUp}
        className="mt-3 max-w-md text-[13px] leading-relaxed text-ink-2/85"
      >
        حدث خطأ غير متوقع أثناء تحميل الداشبورد. فريقنا سجّل التفاصيل تلقائياً —
        يمكنك المحاولة الآن، أو مشاركة رمز التتبع مع الدعم.
      </motion.p>

      {error.digest ? (
        <motion.div
          variants={fadeUp}
          role="status"
          aria-live="polite"
          className="mt-6 w-full max-w-md rounded-2xl border border-edge/10 bg-edge/[0.03] p-3.5 text-start"
        >
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
            رمز التتبع
          </p>
          <div className="flex items-center gap-2">
            <code
              className="min-w-0 flex-1 truncate font-mono text-[12px] font-bold text-ink-2"
              dir="ltr"
            >
              {error.digest}
            </code>
            <button
              type="button"
              onClick={copyDigest}
              aria-label="نسخ رمز التتبع"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-edge/10 bg-edge/[0.03] text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
              ) : (
                <Copy className="size-3.5" strokeWidth={2.25} />
              )}
            </button>
          </div>
        </motion.div>
      ) : null}

      <motion.div
        variants={fadeUp}
        className="mt-8 flex flex-wrap items-center justify-center gap-3"
      >
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-xs font-black text-white shadow-lg shadow-nova/25 transition-all hover:shadow-xl hover:shadow-nova/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2 focus-visible:ring-offset-2 focus-visible:ring-offset-space active:scale-[0.98]"
        >
          <RotateCcw className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          أعد المحاولة
        </button>

        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] px-5 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
        >
          <Home className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          العودة للداشبورد
        </Link>

        <a
          href="mailto:support@colapia.com"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.02] px-5 text-xs font-bold text-ink-3 transition-colors hover:bg-edge/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
        >
          <LifeBuoy className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          تواصل مع فريق Colapia
        </a>
      </motion.div>
    </motion.section>
  );
}