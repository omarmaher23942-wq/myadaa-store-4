"use client";

// components/dashboard/StoreSwitcher.tsx — تبديل بين متاجر التاجر.
//
// السبب الجذري:
// التاجر قريباً قد يملك أكثر من متجر (أزياء + إلكترونيات). بدون switcher،
// يحتاج يعمل logout/login. الآن: dropdown يبدّل بين المتاجر فوراً.
//
// المبادئ:
//  - يعرض قائمة متاجر التاجر (من props، لا fetch).
//  - المتجر الحالي مع علامة ✓.
//  - زر "إضافة متجر جديد" يوجّه لـ onboarding.
//  - Keyboard navigation كامل.
//  - مخفي إذا كان التاجر عنده متجر واحد فقط.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Store as StoreIcon,
  ChevronDown,
  Check,
  Plus,
  ShieldCheck,
  Clock,
  AlertCircle,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn, storeHost } from "@/lib/utils";
import { EDITION, NO_STORE_HREF } from "@/lib/edition";

const SW = 1.75;

export type SwitcherStore = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
};

function statusMeta(status: string): {
  label: string;
  color: string;
} {
  switch (status) {
    case "active":
      return { label: "مفعّل", color: "text-emerald-600 dark:text-emerald-300" };
    case "trial":
    case "review":
    case "building":
    case "pending_review":
    case "intake":
      return { label: "قيد التجهيز", color: "text-amber-700 dark:text-amber-300" };
    case "frozen":
      return { label: "مجمّد", color: "text-rose-600 dark:text-rose-300" };
    case "suspended":
      return { label: "معلّق", color: "text-rose-600 dark:text-rose-300" };
    default:
      return { label: status, color: "text-ink-3" };
  }
}

export function StoreSwitcher({
  currentStore,
  stores,
}: {
  currentStore: SwitcherStore | null;
  stores: SwitcherStore[];
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // إغلاق عند النقر خارج القائمة.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // إذا كان هناك متجر واحد فقط، لا نعرض switcher.
  if (stores.length < 2 && !currentStore) return null;
  if (stores.length < 2) return null;

  const current = currentStore ?? stores[0]!;
  const meta = statusMeta(current.status);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="تبديل المتجر"
        className="flex h-10 items-center gap-2.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-start transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-nova to-aurora text-[11px] font-black text-white">
          {current.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-bold text-ink">
            {current.name}
          </p>
          <p className={cn("truncate text-[9.5px] font-bold", meta.color)}>
            {meta.label}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-ink-3 transition-transform",
            open && "rotate-180"
          )}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label="قائمة المتاجر"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            className="absolute end-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-edge/10 bg-space-2 shadow-2xl shadow-black/60"
          >
            <div className="border-b border-edge/10 px-3 py-2.5">
              <p className="text-[10.5px] font-black uppercase tracking-wider text-ink-3">
                متاجرك
              </p>
            </div>

            <ul className="max-h-72 overflow-y-auto p-1.5">
              {stores.map((s) => {
                const isCurrent = s.id === current.id;
                const sm = statusMeta(s.status);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/dashboard/store/${s.id}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition-colors",
                        isCurrent
                          ? "bg-nova/12"
                          : "hover:bg-edge/[0.04]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg text-[11px] font-black",
                          isCurrent
                            ? "bg-gradient-to-br from-nova to-aurora text-white"
                            : "bg-edge/[0.06] text-ink-2"
                        )}
                      >
                        {s.name.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold text-ink">
                          {s.name}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-ink-3" dir="ltr">
                          {storeHost(s.subdomain)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "text-[9.5px] font-black",
                            sm.color
                          )}
                        >
                          {sm.label}
                        </span>
                        {isCurrent ? (
                          <Check
                            className="size-3.5 text-nova-2"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {EDITION === "platform" ? (
            <div className="border-t border-edge/10 p-1.5">
              <Link
                href={NO_STORE_HREF}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[12px] font-bold text-nova-2 transition-colors hover:bg-nova/10"
              >
                <span className="grid size-7 place-items-center rounded-lg bg-nova/15">
                  <Plus className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                </span>
                إضافة متجر جديد
              </Link>
            </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}