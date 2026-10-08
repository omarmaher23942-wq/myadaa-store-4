"use client";
import { useEffect, useState } from "react";
export function Countdown({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(endsAt).getTime() - Date.now()));
  useEffect(() => { const iv = setInterval(() => setLeft(Math.max(0, new Date(endsAt).getTime() - Date.now())), 1000); return () => clearInterval(iv); }, [endsAt]);
  const d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
  const cells = [[d, "يوم"], [h, "ساعة"], [m, "دقيقة"], [s, "ثانية"]] as const;
  return <div className="flex gap-2 [direction:ltr]">{cells.map(([v, l]) => <div key={l} className="grid min-w-16 place-items-center rounded-xl bg-foreground px-2 py-3 text-background"><span className="text-2xl font-black tabular-nums">{String(v).padStart(2, "0")}</span><span className="text-[10px] opacity-70">{l}</span></div>)}</div>;
}
