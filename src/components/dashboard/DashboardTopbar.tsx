"use client";

// DashboardTopbar — الشريط العلوي للوحة: تحية باسم التاجر وحالة متجره الحقيقية، ولوحة الأوامر،
// والثيم، ونغمة الطلبات، وجرس «ما يحتاج انتباهك»، وقائمة الحساب.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Command as CommandIcon, LogOut, Moon, Search, Settings, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { merchantLogoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import { EDITION } from "@/lib/edition";
import { DashThemeToggle } from "./DashThemeToggle";
import { AttentionCenter } from "./AttentionCenter";
import { useDashboardPulse } from "./DashboardPulse";
import { openCommandPalette } from "./CommandPalette";

const SW = 1.75;

type Props = {
  merchantName: string;
  merchantEmail: string | null;
  merchantAvatarUrl: string | null;
  storeStatus: string | null;
  acceptingOrders: boolean;
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
  return "سهرة سعيدة";
}

type Tone = "ok" | "warn" | "bad" | "neutral";

/** حالة المتجر كما هي فعلاً: في مشروع التاجر يهمه هل يستقبل الطلبات، وعلى المنصة مرحلة متجره. */
function statusMeta(status: string | null, acceptingOrders: boolean): { label: string; tone: Tone } {
  if (status === null) return { label: "لا يوجد متجر بعد", tone: "neutral" };
  if (EDITION === "store" || status === "active") {
    if (!acceptingOrders) return { label: "استقبال الطلبات متوقف مؤقتاً", tone: "warn" };
    return EDITION === "store"
      ? { label: "متجرك يستقبل الطلبات", tone: "ok" }
      : { label: "مدفوع · جاهز للاستلام", tone: "ok" };
  }
  switch (status) {
    case "demo":
    case "trial":
      return { label: "تجربة مجانية نشطة", tone: "warn" };
    case "building":
    case "review":
    case "pending_review":
    case "intake":
      return { label: "قيد التجهيز", tone: "warn" };
    case "frozen":
      return { label: "انتهت التجربة · بانتظار الدفع", tone: "bad" };
    case "suspended":
      return { label: "معلّق", tone: "bad" };
    default:
      return { label: "غير مفعّل", tone: "neutral" };
  }
}

const TONE_TEXT: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", neutral: "text-ink-3" };
const TONE_DOT: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn animate-pulse", bad: "bg-bad", neutral: "bg-ink-3" };

function SoundToggle() {
  const { soundOn, toggleSound } = useDashboardPulse();
  const Icon = soundOn ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={soundOn}
      aria-label={soundOn ? "كتم نغمة الطلب الجديد" : "تشغيل نغمة الطلب الجديد"}
      title={soundOn ? "كتم نغمة الطلب الجديد" : "تشغيل نغمة الطلب الجديد"}
      className={cn(
        "grid size-10 place-items-center rounded-xl text-ink-2/80 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova",
        !soundOn && "text-ink-3"
      )}
    >
      <Icon className="size-4" strokeWidth={SW} aria-hidden="true" />
    </button>
  );
}

export function DashboardTopbar({ merchantName, merchantEmail, merchantAvatarUrl, storeStatus, acceptingOrders, theme }: Props) {
  const [greeting, setGreeting] = useState<string>("مرحباً");
  const [isMac, setIsMac] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const reduce = useReducedMotion();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGreeting(computeGreeting());
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!userOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [userOpen]);

  const status = statusMeta(storeStatus, acceptingOrders);
  const first = firstNameOf(merchantName);
  const initial = merchantName.trim().charAt(0) || "C";

  return (
    <header className="sticky top-0 z-30 border-b border-edge/[0.07] bg-space/60 backdrop-blur-2xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-8">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-ink">{first ? `${greeting}، ${first}` : greeting}</p>
          <p className={cn("mt-0.5 flex items-center gap-1.5 text-[11px] font-bold", TONE_TEXT[status.tone])}>
            <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[status.tone])} />
            <span className="truncate">{status.label}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="ابحث عن طلب أو منتج"
            className="grid size-10 place-items-center rounded-xl text-ink-2/80 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova md:hidden"
          >
            <Search className="size-4" strokeWidth={2.25} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="افتح البحث ولوحة الأوامر"
            aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
            className="me-1 hidden h-10 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11.5px] font-bold text-ink-3 transition-colors hover:bg-edge/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova md:inline-flex"
          >
            <CommandIcon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            <span>ابحث أو انتقل</span>
            <kbd className="rounded-md border border-edge/10 bg-edge/[0.05] px-1.5 py-0.5 font-mono text-[10px]" dir="ltr">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>

          <DashThemeToggle initial={theme} />
          <SoundToggle />
          <AttentionCenter />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              aria-label="حسابي"
              aria-expanded={userOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-xl p-1 pe-1.5 transition-colors hover:bg-edge/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
            >
              <Avatar url={merchantAvatarUrl} initial={initial} className="size-8" />
              <ChevronDown className="hidden size-3.5 text-ink-3 sm:block" strokeWidth={2.25} aria-hidden="true" />
            </button>

            <AnimatePresence>
              {userOpen ? (
                <motion.div
                  role="menu"
                  aria-label="قائمة الحساب"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: reduce ? 0 : 0.14, ease: "easeOut" }}
                  className="absolute end-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-edge/10 bg-space-2 shadow-2xl shadow-black/40"
                >
                  <div className="flex items-center gap-3 border-b border-edge/10 p-4">
                    <Avatar url={merchantAvatarUrl} initial={initial} className="size-9" />
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-black text-ink">{merchantName}</p>
                      {merchantEmail ? (
                        <p dir="ltr" className="truncate text-end text-[11px] text-ink-3">
                          {merchantEmail}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserOpen(false);
                        window.dispatchEvent(new Event("clp:toggle-theme"));
                      }}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova sm:hidden"
                    >
                      <Moon className="size-4" strokeWidth={SW} aria-hidden="true" />
                      <span>بدّل الوضع الفاتح والداكن</span>
                    </button>
                    <Link
                      href="/dashboard/settings"
                      role="menuitem"
                      onClick={() => setUserOpen(false)}
                      className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
                    >
                      <Settings className="size-4" strokeWidth={SW} aria-hidden="true" />
                      <span>إعدادات المتجر</span>
                    </Link>
                  </div>

                  <form action={merchantLogoutAction} className="border-t border-edge/10 p-1.5">
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-[12.5px] font-bold text-bad transition-colors hover:bg-bad/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad"
                    >
                      <LogOut className="size-4" strokeWidth={SW} aria-hidden="true" />
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

function Avatar({ url, initial, className }: { url: string | null; initial: string; className?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={cn("rounded-full object-cover", className)} referrerPolicy="no-referrer" />
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
