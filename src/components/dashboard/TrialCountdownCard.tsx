"use client";

// TrialCountdownCard — الوقت المتبقي من التجربة المجانية وحلقة تقدم على مدتها الحقيقية (من بدايتها لنهايتها).
// أول رسم يستخدم وقت الخادم نفسه فلا يختلف HTML الخادم عن المتصفح (لا hydration mismatch)، ثم يتحدث كل ثانية
// في الساعة الأخيرة وكل 30 ثانية قبلها.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { arCount, fmtNum, type ArNoun } from "@/lib/format";

const HOUR: ArNoun = { one: "ساعة", two: "ساعتان", few: "ساعات", many: "ساعة", other: "ساعة" };
const MINUTE: ArNoun = { one: "دقيقة", two: "دقيقتان", few: "دقائق", many: "دقيقة", other: "دقيقة" };
const SECOND: ArNoun = { one: "ثانية", two: "ثانيتان", few: "ثوانٍ", many: "ثانية", other: "ثانية" };

type Tone = "ok" | "warn" | "bad" | "expired";

const TONES: Record<Tone, { box: string; text: string }> = {
  ok: { box: "border-ok/25 bg-ok/[0.05]", text: "text-ok" },
  warn: { box: "border-warn/30 bg-warn/[0.06]", text: "text-warn" },
  bad: { box: "border-bad/30 bg-bad/[0.06]", text: "text-bad" },
  expired: { box: "border-edge/10 bg-edge/[0.02]", text: "text-ink-3" },
};

function toneOf(ms: number): Tone {
  if (ms <= 0) return "expired";
  if (ms < 3600e3) return "bad";
  if (ms < 4 * 3600e3) return "warn";
  return "ok";
}

/** «19 ساعة و51 دقيقة»، «ساعتان و5 دقائق»، «12 دقيقة و30 ثانية». */
function remaining(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m > 0 ? `${arCount(h, HOUR)} و${arCount(m, MINUTE)}` : arCount(h, HOUR);
  if (m > 0) return `${arCount(m, MINUTE)} و${arCount(sec, SECOND)}`;
  return arCount(sec, SECOND);
}

export function TrialCountdownCard({
  expiresAt,
  startedAt,
  serverNow,
  planPrice,
}: {
  expiresAt: string;
  startedAt: string | null;
  serverNow: number;
  planPrice: number;
}) {
  const end = new Date(expiresAt).getTime();
  const start = startedAt ? new Date(startedAt).getTime() : end - 24 * 3600e3;
  const [now, setNow] = useState(serverNow);

  const left = Math.max(0, end - now);
  const lastHour = left > 0 && left < 3600e3;

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), lastHour ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [lastHour]);

  const tone = toneOf(left);
  const t = TONES[tone];
  const progress = end > start ? Math.min(1, left / (end - start)) : 0;
  const circ = 2 * Math.PI * 26;

  return (
    <section aria-label="التجربة المجانية" className={cn("relative overflow-hidden rounded-2xl border p-4 sm:p-5", t.box)}>
      <div className="flex flex-wrap items-center gap-4">
        <div className={cn("relative size-14 shrink-0", t.text)}>
          <svg viewBox="0 0 64 64" className="size-14 -rotate-90" aria-hidden="true">
            <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="5" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress)}
              className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
            />
          </svg>
          <Clock className="absolute inset-0 m-auto size-5" strokeWidth={1.75} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-ink-2">{tone === "expired" ? "انتهت التجربة المجانية" : "متبقٍ من تجربتك المجانية"}</p>
          <p role="timer" className={cn("mt-1 text-[18px] font-black tabular-nums sm:text-[20px]", t.text)}>
            {tone === "expired" ? "متجرك مجمّد الآن" : remaining(left)}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">
            {tone === "expired"
              ? "ادفع مرة واحدة ليعود متجرك ويصبح ملكك، بمنتجاته وطلباته كما هي."
              : "بعدها يُجمَّد المتجر حتى الدفع. ادفع مرة واحدة ويصبح متجرك ملكك بلا اشتراك."}
          </p>
        </div>

        <Link
          href="/dashboard/billing"
          className="group inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-lg shadow-nova/25 transition hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2 focus-visible:ring-offset-2 focus-visible:ring-offset-space sm:w-auto"
        >
          <Sparkles className="size-4" strokeWidth={2.25} aria-hidden="true" />
          ادفع {fmtNum(planPrice)} ج مرة واحدة
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
