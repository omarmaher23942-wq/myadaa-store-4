"use client";

// تبديل ثيم الداشبورد (كوني داكن / فاتح). يُحفظ في كوكي يقرؤه الخادم، فلا وميض عند التحميل،
// ومستقل عن ثيم المتجر نفسه.
import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { DASH_THEME_COOKIE } from "@/lib/dash-theme";

export function DashThemeToggle({ initial }: { initial: "dark" | "light" }) {
  const [theme, setTheme] = useState(initial);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.querySelector(".dash")?.classList.toggle("dark", next === "dark");
    document.cookie = `${DASH_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الكوني الداكن"}
      title={theme === "dark" ? "الوضع الفاتح" : "الوضع الكوني"}
      className="grid size-10 place-items-center rounded-xl border border-edge/10 bg-edge/[0.03] text-ink-3 transition-colors hover:bg-edge/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
    >
      <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
