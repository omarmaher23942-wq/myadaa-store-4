// Announcement.tsx — الشريط الإعلاني بمحرك CSS لا نهائي حقيقي.
//
// السبب الجذري لإصلاح توقف الحركة:
// النسخة السابقة كانت translateX(-50%) على قائمة مكررة 4 مرات، مع أنيميشن
// 28s. عند نهاية الدورة، كانت القائمة تعيد البدء من نقطة غير متسقة بصرياً،
// فيظهر توقف/فراغ. الحل: بنية "نسختان متطابقتان متتاليتان" داخل حاوية واحدة،
// مع translateX من 0 إلى -50% بتكرار لا نهائي. النقطة -50% تُطابق تماماً
// النقطة 0 بصرياً (لأن النص الأول من النسخة الثانية يظهر حيث كان النص الأول
// من النسخة الأولى)، فلا انقطاع.
//
// يتحول لـ قائمة ثابتة (static list) عند prefers-reduced-motion.
import { Sparkles } from "lucide-react";
import type { infer as Infer } from "zod";
import type * as S from "@/blueprint/schema";

const SW = 2.25;

export function Announcement({ s }: { s: Infer<typeof S.announcementSection> }) {
  const items = s.messages ?? [];
  if (items.length === 0) return null;

  return (
    <div
      role="marquee"
      aria-label="إعلانات المتجر"
      className="s-announce overflow-hidden border-b py-2.5 text-xs font-black tracking-wide"
      style={{
        background: "var(--primary)",
        color: "var(--primary-foreground)",
        borderColor: "color-mix(in srgb, var(--primary) 80%, black)",
      }}
    >
      {/* الطبقة المتحركة — مخفية عند prefers-reduced-motion */}
      <div
        className="announcement-marquee flex w-max [direction:ltr] will-change-transform motion-reduce:hidden"
        style={{
          animation: `clp-marquee ${Math.max(30, items.length * 12)}s linear infinite`,
        }}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex shrink-0 [direction:rtl]"
            aria-hidden={copy > 0}
          >
            {items.map((m, i) => (
              <span
                key={`${copy}-${i}`}
                className="mx-5 inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span>{m.text}</span>
                <Sparkles
                  className="size-3 opacity-50"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* الطبقة الثابتة — تظهر فقط عند prefers-reduced-motion */}
      <div
        className="container-x hidden flex-wrap items-center justify-center gap-x-5 gap-y-1 motion-reduce:flex"
        dir="rtl"
      >
        {items.map((m, i) => (
          <span
            key={`static-${i}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>{m.text}</span>
            {i < items.length - 1 ? (
              <Sparkles
                className="size-3 opacity-40"
                strokeWidth={SW}
                aria-hidden="true"
              />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}