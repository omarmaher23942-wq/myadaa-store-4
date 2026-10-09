"use client";

// StoreSwitcher — التبديل بين متاجر التاجر (على المنصة فقط؛ مشروع التاجر متجر واحد).
// يبدّل المتجر النشط في الجلسة بعد التحقق من الملكية على الخادم (switchStoreAction)،
// ثم يفتح نظرته العامة. يظهر فقط حين يملك التاجر متجرين أو أكثر.
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Loader2, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { cn, storeHost } from "@/lib/utils";
import { EDITION, NO_STORE_HREF } from "@/lib/edition";
import { switchStoreAction } from "@/server/actions/auth";

export type SwitcherStore = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
};

function statusMeta(status: string): { label: string; color: string } {
  switch (status) {
    case "active":
      return { label: "مدفوع", color: "text-ok" };
    case "trial":
    case "demo":
      return { label: "تجربة", color: "text-warn" };
    case "review":
    case "building":
    case "pending_review":
    case "intake":
      return { label: "قيد التجهيز", color: "text-warn" };
    case "frozen":
      return { label: "انتهت التجربة", color: "text-bad" };
    case "suspended":
      return { label: "معلّق", color: "text-bad" };
    default:
      return { label: "غير مفعّل", color: "text-ink-3" };
  }
}

export function StoreSwitcher({ currentId, stores }: { currentId: string | null; stores: SwitcherStore[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>("[aria-selected='true']")?.focus());
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (stores.length < 2) return null;
  const current = stores.find((s) => s.id === currentId) ?? stores[0]!;
  const meta = statusMeta(current.status);

  function choose(id: string) {
    if (id === current.id) {
      setOpen(false);
      return;
    }
    setTarget(id);
    start(async () => {
      const res = await switchStoreAction(id);
      if (!res.ok) {
        toast.error(res.error ?? "تعذر تبديل المتجر");
        setTarget(null);
        return;
      }
      setOpen(false);
      setTarget(null);
      router.push("/dashboard");
      router.refresh();
    });
  }

  function onListKey(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>("button[role='option']") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
    next?.focus();
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`المتجر الحالي: ${current.name}. تبديل المتجر`}
        className="flex w-full items-center gap-2.5 rounded-xl border border-edge/10 bg-edge/[0.03] p-2 text-start transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-nova to-aurora text-[13px] font-black text-white">
          {current.name.charAt(0)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-black text-ink">{current.name}</span>
          <span className={cn("block truncate text-[11px] font-bold", meta.color)}>{meta.label}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} strokeWidth={2.25} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-edge/10 bg-space-2 shadow-2xl shadow-black/40"
          >
            <p className="border-b border-edge/10 px-3 py-2.5 text-[11px] font-black text-ink-3">متاجرك</p>
            <ul ref={list} role="listbox" aria-label="متاجرك" onKeyDown={onListKey} className="max-h-72 overflow-y-auto p-1.5">
              {stores.map((s) => {
                const isCurrent = s.id === current.id;
                const sm = statusMeta(s.status);
                const busy = pending && target === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isCurrent}
                      disabled={pending}
                      onClick={() => choose(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova disabled:cursor-wait",
                        isCurrent ? "bg-nova/12" : "hover:bg-edge/[0.04]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg text-[12px] font-black",
                          isCurrent ? "bg-gradient-to-br from-nova to-aurora text-white" : "bg-edge/[0.06] text-ink-2"
                        )}
                      >
                        {s.name.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-bold text-ink">{s.name}</span>
                        <span className="mt-0.5 block truncate text-end text-[11px] text-ink-3" dir="ltr">
                          {storeHost(s.subdomain)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className={cn("text-[11px] font-black", sm.color)}>{sm.label}</span>
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin text-nova-2" aria-label="جارٍ التبديل" />
                        ) : isCurrent ? (
                          <Check className="size-3.5 text-nova-2" strokeWidth={3} aria-hidden="true" />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {EDITION === "platform" ? (
              <div className="border-t border-edge/10 p-1.5">
                <Link
                  href={NO_STORE_HREF}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-[12.5px] font-bold text-nova-2 transition-colors hover:bg-nova/10"
                >
                  <span className="grid size-7 place-items-center rounded-lg bg-nova/15">
                    <Plus className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  متجر جديد
                </Link>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
