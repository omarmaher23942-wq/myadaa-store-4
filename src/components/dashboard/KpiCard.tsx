// KpiCard — بطاقة مؤشر: القيمة، والتغير عن الفترة السابقة (أو «لا فترة سابقة» إن لم تكن هناك بيانات للمقارنة،
// لا 0% مخترعة)، وسطر توضيح اختياري، ورسم صغير من سلسلة يومية حقيقية. تعمل في الخادم والعميل (بلا hooks).

import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SW = 1.75;

export type KpiCardProps = {
  title: string;
  value: string | number;
  /** التغير عن الفترة السابقة. null = لا بيانات في الفترة السابقة للمقارنة. undefined = لا يُعرض. */
  delta?: number | null;
  deltaType?: "up" | "down" | "neutral";
  /** وحدة التغير: نسبة مئوية (الافتراضي) أو نقاط مئوية (لمعدل التحويل). */
  deltaUnit?: "%" | "pt";
  /** سطر توضيح تحت العنوان (مثل متوسط قيمة الطلب). */
  hint?: string;
  icon: LucideIcon;
  sparkline?: number[];
  href?: string;
  loading?: boolean;
  className?: string;
};

function Sparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 26;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  // نقطة نهائية للإبراز
  const lastX = w;
  const lastY = h - ((data[data.length - 1]! - min) / range) * (h - 4) - 2;

  const gid = `spark-${data.join("-").slice(0, 40)}-${data.length}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-10 w-full overflow-visible", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="1.8" fill="currentColor" className="animate-pulse" />
    </svg>
  );
}

function DeltaBadge({
  delta,
  type,
  unit,
}: {
  delta: number | null;
  type: "up" | "down" | "neutral";
  unit: "%" | "pt";
}) {
  if (delta === null) {
    return (
      <span className="rounded-full bg-edge/5 px-2 py-0.5 text-[10.5px] font-bold text-ink-3" title="لا توجد بيانات في الفترة السابقة للمقارنة">
        لا فترة سابقة
      </span>
    );
  }
  const Icon = type === "up" ? TrendingUp : type === "down" ? TrendingDown : Minus;
  const tone = type === "up" ? "bg-ok/10 text-ok" : type === "down" ? "bg-bad/10 text-bad" : "bg-edge/5 text-ink-3";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black tabular-nums",
        tone
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} aria-hidden="true" />
      <span dir="ltr">
        {delta > 0 ? "+" : ""}
        {delta}
        {unit === "%" ? "%" : ""}
      </span>
      {unit === "pt" ? <span>نقطة</span> : null}
      <span className="sr-only">{type === "up" ? "ارتفاع" : type === "down" ? "انخفاض" : "بلا تغير"} عن الفترة السابقة</span>
    </span>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 w-8 rounded-lg bg-edge/5" />
      <div className="h-6 w-24 rounded-md bg-edge/5" />
      <div className="h-3 w-16 rounded-md bg-edge/5" />
      <div className="h-3 w-20 rounded-md bg-edge/5" />
    </div>
  );
}

export function KpiCard({
  title,
  value,
  delta,
  deltaType = "neutral",
  deltaUnit = "%",
  hint,
  icon: Icon,
  sparkline,
  href,
  loading = false,
  className,
}: KpiCardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-nova/25 to-aurora/15 ring-1 ring-nova/25">
          <span aria-hidden="true" className="absolute inset-0 rounded-xl bg-nova/20 blur-md transition-opacity duration-300 group-hover:opacity-100 opacity-50" />
          <Icon className="relative size-[18px] text-nova-2" strokeWidth={SW} />
        </div>
        {delta !== undefined && !loading ? <DeltaBadge delta={delta} type={deltaType} unit={deltaUnit} /> : null}
      </div>

      {loading ? (
        <div className="mt-4">
          <Skeleton />
        </div>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-[22px] font-black leading-none tracking-tight text-ink tabular-nums sm:text-[26px]">
              {value}
            </p>
            <p className="mt-1.5 text-[12px] font-bold text-ink-2">{title}</p>
            {hint ? <p className="mt-0.5 text-[11px] text-ink-3">{hint}</p> : null}
          </div>

          {sparkline && sparkline.length >= 2 ? (
            <div className="-mx-1 mt-3 text-nova-2">
              <Sparkline data={sparkline} />
            </div>
          ) : null}
        </>
      )}
    </>
  );

  const baseClasses = cn(
    "dash-card group relative block overflow-hidden p-5 transition-all duration-300",
    "before:pointer-events-none before:absolute before:-top-16 before:-end-16 before:size-40 before:rounded-full before:bg-nova/10 before:blur-3xl before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova focus-visible:ring-offset-2 focus-visible:ring-offset-space",
    href && "hover:-translate-y-0.5 hover:border-nova/25",
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {inner}
      </Link>
    );
  }

  return <div className={baseClasses}>{inner}</div>;
}