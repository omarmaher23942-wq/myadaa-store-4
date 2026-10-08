"use client";

// EmptyStoreState — Hero-sized، تصميم Cosmic/Navy.
// إعادة التصميم الكاملة:
//  - تجربة خطأ فخمة: بطاقة Cosmic مع توهج coral (لا banner برتقالي مبتذل)،
//    تباين عالٍ، CTA مفرد واضح، خيار ثانوي هادئ "إعادة تعيين".
//  - correlation ID قابل للنسخ بضغطة واحدة.
//  - أنيميشن دخول ناعم يحترم prefers-reduced-motion.
//  - Optimistic UI: عند الضغط على CTA، الزر يعرض "جاري التجهيز" فوراً قبل
//    أن يبدأ التنقل — لا تجمّد بصري.
//  - View Transitions API عند الدعم للانتقال من حالة الخطأ إلى حالة النجاح.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Sparkles,
  CreditCard,
  Clock,
  Zap,
  ArrowLeft,
  ShieldCheck,
  AlertOctagon,
  Copy,
  Check,
  RotateCcw,
  LifeBuoy,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { NO_STORE_HREF } from "@/lib/edition";

const SW = 1.75;

type ErrorReason =
  | "conversation_query"
  | "conversation_create"
  | "session_issue"
  | "requires_login"
  | "unknown";

const ERROR_COPY: Record<ErrorReason, { title: string; body: string }> = {
  conversation_query: {
    title: "تعذر تجهيز مساحة العمل",
    body: "لم نتمكن من الوصول إلى بياناتك الآن. هذا مؤقت — أعد المحاولة بعد لحظات.",
  },
  conversation_create: {
    title: "تعذر فتح مساحة عمل جديدة",
    body: "حدث تعارض لحظي في إنشاء المساحة. أعد المحاولة، أو تواصل معنا لو تكرر.",
  },
  session_issue: {
    title: "تعذر إصدار رابط الاستمارة",
    body: "لم نوفق في تجهيز رابط الاستمارة الآن. أعد المحاولة — عادةً ينجح من المحاولة الأولى.",
  },
  requires_login: {
    title: "انتهت صلاحية جلستك",
    body: "سجّل الدخول من جديد وستعود مباشرة إلى حيث كنت.",
  },
  unknown: {
    title: "حدث خطأ غير متوقع",
    body: "لم نتمكن من إكمال العملية. جرّب مرة أخرى، وإن استمرت المشكلة فتواصل معنا مع رمز التتبع بالأسفل.",
  },
};

export type EmptyStoreStateProps = {
  merchantName: string;
  errorReason?: string | null;
  correlationId?: string | null;
};

export function EmptyStoreState({
  merchantName,
  errorReason,
  correlationId,
}: EmptyStoreStateProps) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dots, setDots] = useState(0);
  const [copied, setCopied] = useState(false);

  const firstName = useMemo(
    () => merchantName.trim().split(/\s+/)[0] || merchantName,
    [merchantName]
  );

  const resolvedReason: ErrorReason = useMemo(() => {
    if (!errorReason) return "unknown";
    const keys = Object.keys(ERROR_COPY) as ErrorReason[];
    return keys.includes(errorReason as ErrorReason)
      ? (errorReason as ErrorReason)
      : "unknown";
  }, [errorReason]);

  const isError = Boolean(errorReason);
  const copy = isError ? ERROR_COPY[resolvedReason] : null;

  // نقاط التقدم أثناء الانتقال (احترام reduced-motion).
  useEffect(() => {
    if (!pending || reduce) return;
    const t = window.setInterval(() => setDots((d) => (d + 1) % 4), 380);
    return () => window.clearInterval(t);
  }, [pending, reduce]);

  // الانتقال إلى الاستمارة مع Optimistic UI + View Transitions عند الدعم.
  const go = useCallback(() => {
    if (pending) return;
    startTransition(() => {
      const navigate = () => router.push(NO_STORE_HREF);
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      };
      if (reduce || typeof doc.startViewTransition !== "function") {
        navigate();
        return;
      }
      doc.startViewTransition(navigate);
    });
  }, [pending, reduce, router]);

  // إعادة تعيين حالة الخطأ من عنوان الـ URL دون إعادة تحميل كاملة.
  const clearError = useCallback(() => {
    startTransition(() => {
      router.replace("/dashboard");
    });
  }, [router]);

  const copyReqId = useCallback(async () => {
    if (!correlationId) return;
    try {
      await navigator.clipboard.writeText(correlationId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // تجاهل — بعض المتصفحات تمنع الكتابة بدون HTTPS.
    }
  }, [correlationId]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: reduce ? 0 : 0.07,
        delayChildren: reduce ? 0 : 0.05,
      },
    },
  };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.section
      variants={container}
      initial="hidden"
      animate="show"
      className="relative mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center md:py-20"
    >
      {/* توهج خلفي — يتغير حسب الحالة (نجاح: أزرق، فشل: coral) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className={
            isError
              ? "absolute -top-40 start-1/2 size-[520px] -translate-x-1/2 rounded-full bg-[#ff5c6c]/12 blur-3xl"
              : "absolute -top-40 start-1/2 size-[520px] -translate-x-1/2 rounded-full bg-nova/10 blur-3xl"
          }
        />
        <div
          className={
            isError
              ? "absolute -bottom-32 end-1/3 size-[360px] rounded-full bg-[#ff8a7a]/10 blur-3xl"
              : "absolute -bottom-32 end-1/3 size-[360px] rounded-full bg-aurora/10 blur-3xl"
          }
        />
      </div>

      {/* أيقونة الحالة — Store أو AlertOctagon */}
      <motion.div
        variants={item}
        className={[
          "relative mb-7 flex size-24 items-center justify-center rounded-[28px] border shadow-2xl shadow-black/40",
          isError
            ? "border-rose-400/30 bg-gradient-to-br from-rose-500/[0.08] to-edge/[0.02]"
            : "border-edge/10 bg-gradient-to-br from-edge/[0.08] to-edge/[0.02]",
        ].join(" ")}
      >
        <div
          aria-hidden
          className={[
            "absolute inset-0 rounded-[28px] opacity-60",
            isError
              ? "bg-gradient-to-br from-[#ff5c6c]/25 to-transparent"
              : "bg-gradient-to-br from-nova/25 to-transparent",
          ].join(" ")}
        />
        {isError ? (
          <AlertOctagon
            className="relative size-10 text-[#ff8a94]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        ) : (
          <Store
            className="relative size-10 text-nova-2"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        )}
        <span
          aria-hidden
          className={[
            "absolute -end-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full text-ink shadow-lg",
            isError
              ? "bg-rose-500 shadow-rose-500/40"
              : "bg-nova shadow-nova/40",
          ].join(" ")}
        >
          <Sparkles className="size-2.5" strokeWidth={2.75} />
        </span>
      </motion.div>

      {/* التحية أو عنوان الخطأ */}
      <motion.p variants={item} className="text-[12.5px] font-bold text-ink-3">
        {isError ? "حدث خطأ مؤقت" : `أهلاً، ${firstName}`}
      </motion.p>

      <AnimatePresence mode="wait" initial={false}>
        <motion.h1
          key={isError ? "err-title" : "ok-title"}
          variants={item}
          className="mt-2 text-2xl font-black leading-tight text-ink md:text-[34px]"
        >
          {isError ? copy?.title : "متجرك على بعد 3 خطوات"}
        </motion.h1>
      </AnimatePresence>

      <motion.p
        variants={item}
        className="mt-4 max-w-md text-[13.5px] leading-relaxed text-ink-2/85"
      >
        {isError
          ? copy?.body
          : "أجب على استمارة قصيرة وسيبني لك الذكاء الاصطناعي متجراً احترافياً بمنتجاتك الحقيقية، جاهزاً لاستقبال أول طلب من عملائك."}
      </motion.p>

      {/* بطاقة correlation ID عند الفشل */}
      {isError && correlationId ? (
        <motion.div
          variants={item}
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
              {correlationId}
            </code>
            <button
              type="button"
              onClick={copyReqId}
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
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-3">
            اذكر هذا الرمز لفريق الدعم لتسريع المعالجة.
          </p>
        </motion.div>
      ) : null}

      {/* CTA أساسي واحد — Optimistic UI */}
      <motion.div variants={item} className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={go}
          disabled={pending}
          aria-busy={pending}
          className="group relative inline-flex h-12 min-w-[220px] items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-b from-nova to-nova-deep px-7 text-sm font-black text-white shadow-xl shadow-nova/25 transition-all hover:shadow-2xl hover:shadow-nova/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2 focus-visible:ring-offset-2 focus-visible:ring-offset-space active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
        >
          <span className="relative z-10">
            {pending
              ? "جاري تجهيز الاستمارة..."
              : isError
                ? "أعد المحاولة الآن"
                : "ابدأ إنشاء متجري الآن"}
          </span>
          {pending ? (
            <span className="relative z-10 inline-flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className="size-1 rounded-full bg-white transition-opacity"
                  style={{ opacity: i < dots ? 1 : 0.35 }}
                />
              ))}
            </span>
          ) : (
            <ArrowLeft
              className="relative z-10 size-4 transition-transform group-hover:-translate-x-0.5"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          )}
        </button>

        {/* خياران ثانويان هادئان عند الفشل: إعادة تعيين + تواصل مع فريق */}
        {isError ? (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={clearError}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
            >
              <RotateCcw className="size-3" strokeWidth={2.25} aria-hidden="true" />
              إعادة تعيين الرسالة
            </button>
            <span aria-hidden className="size-1 rounded-full bg-edge/15" />
            <a
              href="mailto:support@colapia.com"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
            >
              <LifeBuoy className="size-3" strokeWidth={2.25} aria-hidden="true" />
              تواصل مع فريق Colapia
            </a>
          </div>
        ) : null}
      </motion.div>

      {/* نقاط القيمة — تظهر فقط في الحالة الطبيعية */}
      {!isError ? (
        <motion.ul
          variants={item}
          className="mt-9 grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2"
        >
          {[
            { icon: ShieldCheck, text: "تسجيل فوري بحساب Google" },
            { icon: CreditCard, text: "بدون الحاجة لبطاقة ائتمان" },
            { icon: Clock, text: "180 دقيقة تجربة حرة ونشطة لكافة المزايا" },
            {
              icon: Zap,
              text: "899 ج فقط للتملك الدائم مدى الحياة وبدون أي عمولات",
            },
          ].map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex min-h-[52px] items-center gap-3 rounded-xl border border-edge/10 bg-edge/[0.02] px-3.5 py-2.5 text-start"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-nova/15">
                <Icon
                  className="size-3.5 text-nova-2"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
              </span>
              <span className="text-[11.5px] font-bold leading-relaxed text-ink-2">
                {text}
              </span>
            </li>
          ))}
        </motion.ul>
      ) : null}

      {/* زر ثانوي صغير لإعادة تحميل حالة الـ page عند الفشل دون تغيير الـ URL */}
      {isError ? (
        <motion.button
          variants={item}
          type="button"
          onClick={() => router.refresh()}
          className="mt-8 inline-flex items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.02] px-3 py-1.5 text-[11px] font-bold text-ink-3 transition-colors hover:bg-edge/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
        >
          <RefreshCw className="size-3" strokeWidth={2.25} aria-hidden="true" />
          إعادة تحميل البيانات
        </motion.button>
      ) : null}
    </motion.section>
  );
}