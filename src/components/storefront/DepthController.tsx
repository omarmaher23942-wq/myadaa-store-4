"use client";

// DepthController — مستمع واحد للمتجر كله يمنح أي عنصر [data-tilt] ميلاً ثلاثي الأبعاد ولمعة تتبع المؤشر.
// لا مكوّن لكل بطاقة ولا إعادة رسم في React: يكتب متغيرات CSS فقط (--rx --ry --gx --gy --go) والشكل في design.ts.
// يعمل فقط على أجهزة بمؤشر دقيق، ويتوقف لمن طلب تقليل الحركة.
import { useEffect } from "react";

const MAX_DEG = 7;

export function DepthController() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let active: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;

    const reset = (el: HTMLElement) => {
      el.classList.remove("is-tilting");
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--go", "0");
    };

    const paint = () => {
      frame = 0;
      if (!active || !last) return;
      const r = active.getBoundingClientRect();
      const x = (last.clientX - r.left) / r.width;
      const y = (last.clientY - r.top) / r.height;
      active.style.setProperty("--ry", `${((x - 0.5) * MAX_DEG * 2).toFixed(2)}deg`);
      active.style.setProperty("--rx", `${((0.5 - y) * MAX_DEG * 2).toFixed(2)}deg`);
      active.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      active.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      active.style.setProperty("--go", "1");
    };

    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-tilt]") as HTMLElement | null;
      if (el !== active) {
        if (active) reset(active);
        active = el;
        active?.classList.add("is-tilting");
      }
      if (!active) return;
      last = e;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      if (active) reset(active);
      active = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
