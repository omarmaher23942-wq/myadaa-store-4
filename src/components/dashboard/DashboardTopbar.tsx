"use client";

// components/dashboard/DashboardTopbar.tsx — الشريط العلوي (v3).
//
// التعديل الجذري:
// حُذف زر تبديل الثيم (light/dark/system) نهائياً. السبب:
//  - الداشبورد مصمّم على dark theme ثابت (كل الصفحات لها خلفية #07091a).
//  - زر التبديل كان يوهم المستخدم بإمكانية تغيير المظهر، لكنه لا يعمل
//    بشكل صحيح لأن الألوان مثبتة في الـ layout.
//  - تجربة مستخدم أوضح: لا زر لا يعمل.
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Settings,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Command as CommandIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { merchantLogoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import { NotificationsCenter } from "./RealtimeProvider";
import { SoundToggleButton } from "./RealtimeSoundManager";
import { DashThemeToggle } from "./DashThemeToggle";

const SW = 1.75;

type Props = {
  merchantName: string;
  merchantEmail: string | null;
  merchantAvatarUrl: string | null;
  storeStatus: string | null;
  notificationCount?: number;
  theme: "dark" | "light";
};

/** الاسم الأول للتحية؛ القيم العامة القديمة ("صاحب المتجر") لا تُعرض كاسم. */
function firstNameOf(name: string): string {
  const n = name.trim();
  if (!n || n === "صاحب المتجر" || n.startsWith("صاحب ")) return "";
  return n.split(/\s+/)[0] ?? "";
}

function computeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "صباح الخير";
  if (h >= 12 && h < 17) return "نهارك سعيد";
  if (h >= 17 && h < 22) return "مساء الخير";
  return "ليلة هادئة";
}

function statusMeta(status: string | null): {
  label: string;
  tone: "emerald" | "amber" | "rose" | "neutral";
} {
  switch (status) {
    case "active":
      return { label: "مفعّل مدى الحياة", tone: "emerald" };
    case "demo":
    case "trial":
      return { label: "تجربة نشطة", tone: "amber" };
    case "building":
    case "review":
    case "pending_review":
    case "intake":
      return { label: "قيد التجهيز", tone: "amber" };
    case "frozen":
      return { label: "مجمّد — بانتظار الدفع", tone: "rose" };
    case "suspended":
      return { label: "معلّق", tone: "rose" };
    default:
      return { label: "غير مفعّل", tone: "neutral" };
  }
}

export function DashboardTopbar({
  merchantName,
  merchantEmail,
  merchantAvatarUrl,
  storeStatus,
  theme,
}: Props) {
  const [greeting, setGreeting] = useState<string>("مرحباً");
  const [userOpen, setUserOpen] = useState(false);
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGreeting(computeGreeting());
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setUserOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const status = statusMeta(storeStatus);
  const initial = merchantName.trim().charAt(0) || "C";

  return (
    <header className="sticky top-0 z-30 border-b border-edge/[0.07] bg-space/60 backdrop-blur-2xl">
      <div
        ref={containerRef}
        className="flex h-16 items-center justify-between gap-3 px-4 md:px-8"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black text-ink">
              {firstNameOf(merchantName) ? `${greeting}، ${firstNameOf(merchantName)}` : greeting}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-[10.5px] font-bold",
                  status.tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
                  status.tone === "amber" && "text-amber-600 dark:text-amber-400",
                  status.tone === "rose" && "text-rose-600 dark:text-rose-400",
                  status.tone === "neutral" && "text-ink-3"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    status.tone === "emerald" && "bg-emerald-400",
                    status.tone === "amber" && "animate-pulse bg-amber-400",
                    status.tone === "rose" && "bg-rose-400",
                    status.tone === "neutral" && "bg-ink-3"
                  )}
                />
                {status.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const e = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              });
              window.dispatchEvent(e);
            }}
            aria-label="افتح لوحة الأوامر"
            title="لوحة الأوامر (⌘K)"
            className="hidden h-10 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-3 transition-colors hover:bg-edge/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova md:inline-flex"
          >
            <CommandIcon
              className="size-3"
              strokeWidth={2.25}
              aria-hidden="true"
            />
            <span>الأوامر</span>
            <kbd
              className="rounded bg-black/40 px-1 font-mono text-[9.5px]"
              dir="ltr"
            >
              ⌘K
            </kbd>
          </button>

          <DashThemeToggle initial={theme} />

          <SoundToggleButton />

          <NotificationsCenter />

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              aria-label="حسابي"
              aria-expanded={userOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-xl p-1 pe-2 transition-colors hover:bg-edge/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
            >
              <Avatar
                url={merchantAvatarUrl}
                initial={initial}
                className="size-8"
              />
              <ChevronDown
                className="size-3.5 text-ink-3"
                strokeWidth={2.25}
                aria-hidden="true"
              />
            </button>

            <AnimatePresence>
              {userOpen ? (
                <motion.div
                  role="menu"
                  aria-label="قائمة الحساب"
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: -6, scale: 0.97 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: -6, scale: 0.97 }
                  }
                  transition={{ duration: reduce ? 0 : 0.14, ease: "easeOut" }}
                  className="absolute end-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-edge/10 bg-space-2 shadow-2xl shadow-black/60"
                >
                  <div className="flex items-center gap-3 border-b border-edge/10 p-4">
                    <Avatar
                      url={merchantAvatarUrl}
                      initial={initial}
                      className="size-9"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-black text-ink">
                        {merchantName}
                      </p>
                      {merchantEmail ? (
                        <p
                          dir="ltr"
                          className="truncate text-[10.5px] text-ink-3"
                        >
                          {merchantEmail}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-1.5">
                    <MenuItem
                      href="/dashboard/settings"
                      icon={UserIcon}
                      label="الملف الشخصي"
                    />
                    <MenuItem
                      href="/dashboard/settings"
                      icon={Settings}
                      label="الإعدادات"
                    />
                  </div>

                  <form
                    action={merchantLogoutAction}
                    className="border-t border-edge/10 p-1.5"
                  >
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-bold text-red-600 dark:text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <LogOut
                        className="size-3.5"
                        strokeWidth={SW}
                        aria-hidden="true"
                      />
                      <span>تسجيل الخروج</span>
                    </button>
                  </form>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

function Avatar({
  url,
  initial,
  className,
}: {
  url: string | null;
  initial: string;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={cn("rounded-full object-cover", className)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br from-nova to-aurora text-[11px] font-black text-white",
        className
      )}
    >
      {initial}
    </div>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof UserIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-bold text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
    >
      <Icon className="size-3.5" strokeWidth={SW} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}