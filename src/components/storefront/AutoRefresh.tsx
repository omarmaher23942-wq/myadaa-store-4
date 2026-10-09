"use client";

// تحديث هادئ لصفحات العميل (حالة الطلب) كل فترة، فقط والصفحة ظاهرة ولا يكتب العميل في حقل.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && !document.activeElement?.matches("input,textarea,select")) router.refresh();
    };
    const iv = window.setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);
  return null;
}
