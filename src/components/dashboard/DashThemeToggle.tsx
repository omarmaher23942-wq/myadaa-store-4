"use client";

// تبديل ثيم الداشبورد (كوني داكن / فاتح). يُحفظ في كوكي يقرؤه الخادم، فلا وميض عند التحميل،
// ومستقل عن ثيم المتجر نفسه.
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { DASH_THEME_COOKIE } from "@/lib/dash-theme";

export function DashThemeToggle({ initial }: { initial: "dark" | "light" }) {
  const [theme, setTheme] = useState(initial);

  function apply(next: "dark" | "light") {
    setTheme(next);
    document.querySelector(".dash")?.classList.toggle("dark", next === "dark");
    document.cookie = `${DASH_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  function toggle() {
    apply(document.querySelector(".dash")?.classList.contains("dark") ? "light" : "dark");
  }

  // من لوحة الأوامر أو قائمة الحساب على الموبايل.
  useEffect(() => {
    const onToggle = () => apply(document.querySelector(".dash")?.classList.contains("dark") ? "light" : "dark");
    window.addEventListener("clp:toggle-theme", onToggle);
    return () => window.removeEventListener("clp:toggle-theme", onToggle);
  }, []);

  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الكوني الداكن"}
      title={theme === "dark" ? "الوضع الفاتح" : "الوضع الكوني"}
      className="hidden size-10 place-items-center rounded-xl border border-edge/10 sm:grid bg-edge/[0.03] text-ink-3 transition-colors hover:bg-edge/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
