// 404 — تصميم كوني فاخر بالهوية.
import Link from "next/link";
import { Home, ArrowLeft, Search, Compass } from "lucide-react";

export const dynamic = "force-static";

export default function NotFound() {
  return (
    <div
      dir="rtl"
      className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#07091a] px-6 py-16 text-[#eaf0ff]"
    >
      {/* Cosmic backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(111,134,255,0.18) 0%, transparent 60%), radial-gradient(40% 30% at 100% 30%, rgba(143,168,255,0.10) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-[#6f86ff]/20 to-transparent shadow-2xl">
          <Compass
            className="size-9 text-[#8fa8ff]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>

        <p className="font-mono text-[11px] font-black uppercase tracking-[0.3em] text-[#8d97c4]">
          404 · Page Not Found
        </p>

        <h1 className="mt-4 font-black text-3xl leading-tight tracking-tight sm:text-4xl">
          الصفحة غير موجودة
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-[#c3cdf0]/80">
          يبدو أن الرابط الذي فتحته غير صحيح أو تم نقله. لا تقلق — يمكنك
          العودة إلى الصفحة الرئيسية أو البحث في متجرك المفضل.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-l from-[#6f86ff] to-[#8fa8ff] px-6 text-sm font-black text-[#07091a] shadow-lg transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60 active:scale-[0.98]"
          >
            <Home className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
            الصفحة الرئيسية
          </Link>
          <Link
            href="/?search=1"
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 text-sm font-bold text-[#eaf0ff] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60"
          >
            <Search className="size-4.5" strokeWidth={2.25} aria-hidden="true" />
            ابحث في المتجر
          </Link>
        </div>

        <Link
          href="javascript:history.back()"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#8d97c4] transition-colors hover:text-[#8fa8ff]"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          رجوع للصفحة السابقة
        </Link>
      </div>
    </div>
  );
}