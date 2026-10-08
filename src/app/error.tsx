"use client";

// Client error boundary — يلتقط الأخطاء أثناء الرندر/التفاعل بعد hydration.
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, LifeBuoy } from "lucide-react";
import { EDITION } from "@/lib/edition";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // نُسجّل الخطأ في console فقط — لا نُرسله للعميل.
  useEffect(() => {
    console.error("[app/error]", error.message, error.digest);
  }, [error]);

  return (
    <div
      dir="rtl"
      className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#07091a] px-6 py-16 text-[#eaf0ff]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(239,68,68,0.10) 0%, transparent 60%), radial-gradient(40% 30% at 100% 30%, rgba(111,134,255,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/15 to-transparent shadow-2xl">
          <AlertTriangle
            className="size-9 text-amber-300"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>

        <p className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-[#8d97c4]">
          Something went wrong
        </p>

        <h1 className="mt-4 font-black text-2xl leading-tight tracking-tight sm:text-3xl">
          حدث خطأ غير متوقع
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-[#c3cdf0]/80">
          نعتذر عن الإزعاج. تم تسجيل الخطأ وسيقوم فريقنا بمراجعته. يمكنك
          إعادة المحاولة الآن أو العودة إلى الصفحة الرئيسية.
        </p>

        {error.digest ? (
          <p
            className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 font-mono text-[10.5px] text-[#8d97c4]"
            dir="ltr"
          >
            REF: {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-6 text-sm font-black text-[#07091a] shadow-lg transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60 active:scale-[0.98]"
          >
            <RotateCcw className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
            إعادة المحاولة
          </button>
          <Link
            href="/"
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 text-sm font-bold text-[#eaf0ff] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60"
          >
            <Home className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
            الرئيسية
          </Link>
        </div>

        {EDITION === "platform" ? (
        <Link
          href="mailto:support@colapia.com"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#8d97c4] transition-colors hover:text-[#8fa8ff]"
        >
          <LifeBuoy className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          تواصل مع الدعم
        </Link>
        ) : null}
      </div>
    </div>
  );
}