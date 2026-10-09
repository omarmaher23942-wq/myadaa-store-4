"use client";
// Countdown — العدّ التنازلي لعرض محدود. يُحسب بعد التركيب فقط (الوقت على الخادم يختلف عن المتصفح فيسبب عدم تطابق)،
// والقسم كله لا يُعرض بعد انتهاء الموعد (registry.tsx).
import { useEffect, useState } from "react";

export function Countdown({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  const t = left ?? 0;
  const d = Math.floor(t / 864e5),
    h = Math.floor(t / 36e5) % 24,
    m = Math.floor(t / 6e4) % 60,
    s = Math.floor(t / 1e3) % 60;
  const cells = [
    [d, "يوم"],
    [h, "ساعة"],
    [m, "دقيقة"],
    [s, "ثانية"],
  ] as const;
  return (
    <div className="flex gap-2 [direction:ltr]" role="timer" aria-label="الوقت المتبقي على العرض">
      {cells.map(([v, l]) => (
        <div key={l} className="grid min-w-16 place-items-center rounded-xl bg-foreground px-2 py-3 text-background">
          <span className="text-2xl font-black tabular-nums">{left === null ? "--" : String(v).padStart(2, "0")}</span>
          <span className="text-[10px] opacity-70">{l}</span>
        </div>
      ))}
    </div>
  );
}
