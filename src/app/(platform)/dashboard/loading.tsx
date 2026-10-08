// Dashboard loading — skeleton مطابق بأبعاد اللوحة الحقيقية (بدون CLS).
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" dir="rtl" aria-busy="true" aria-live="polite">
      {/* Header skeleton */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-edge/[0.05]" />
          <div className="h-3 w-64 animate-pulse rounded-lg bg-edge/[0.03]" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-edge/[0.03]" />
          <div className="h-10 w-32 animate-pulse rounded-xl bg-edge/[0.03]" />
        </div>
      </div>

      {/* Trial card skeleton (optional) */}
      <div className="h-24 animate-pulse rounded-2xl border border-edge/[0.06] bg-edge/[0.02]" />

      {/* Net profit skeleton */}
      <div className="h-32 animate-pulse rounded-2xl border border-edge/[0.06] bg-edge/[0.02]" />

      {/* 4 KPIs skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-edge/[0.06] bg-edge/[0.02]"
          />
        ))}
      </div>

      {/* Main grid: recent orders + health */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl border border-edge/[0.06] bg-edge/[0.02] lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl border border-edge/[0.06] bg-edge/[0.02]" />
      </div>
    </div>
  );
}