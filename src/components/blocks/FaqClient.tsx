"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const SW = 1.75;
export type FaqItem = { key: string; q: ReactNode; a: ReactNode };

export function FaqAccordion({ items, defaultOpen = 0 }: { items: FaqItem[]; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<string | null>(
    defaultOpen === null ? null : (items[defaultOpen]?.key ?? null)
  );

  const toggle = (key: string) => setOpen((cur) => (cur === key ? null : key));

  return (
    <div className="space-y-3" dir="rtl">
      {items.map((it) => {
        const isOpen = open === it.key;
        return (
          <div
            key={it.key}
            className="rounded-2xl border transition-all overflow-hidden"
            style={{
              background: "var(--card)",
              borderColor: isOpen ? "var(--primary)" : "var(--border)",
              color: "var(--card-foreground)",
            }}
          >
            <button
              type="button"
              onClick={() => toggle(it.key)}
              className="flex w-full items-center justify-between p-4 sm:p-5 text-start font-bold text-xs sm:text-sm"
              style={{ color: "var(--card-foreground)" }}
            >
              <span>{it.q}</span>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-lg transition-transform",
                  isOpen ? "rotate-45" : ""
                )}
                style={{
                  background: isOpen ? "var(--primary)" : "var(--background)",
                  color: isOpen ? "var(--primary-foreground)" : "var(--foreground)",
                }}
              >
                <Plus className="size-4" strokeWidth={SW} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="p-4 sm:p-5 text-xs leading-relaxed opacity-80" style={{ color: "var(--card-foreground)" }}>
                    {it.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function FaqBubbles({ items }: { items: FaqItem[] }) {
  return <FaqAccordion items={items} />;
}