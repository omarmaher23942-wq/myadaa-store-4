"use client";

// CartDrawer — يفتح من الـ end (يسار في RTL) لتوافق RTL.
// - Free shipping progress bar تفاعلي.
// - Empty state أنيقة.
// - Touch targets ≥ 44px.
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import {
  X,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Truck,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCart, itemKey, lineCap } from "@/store/cart";
import { useCopy, useStore } from "./StoreProvider";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";

const SW = 1.75;

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const { shipping } = useStore();
  const t = useCopy();
  const reduce = useReducedMotion();

  const subtotal = items.reduce((a, i) => a + i.unitPiasters * i.qty, 0);
  const count = items.reduce((a, i) => a + i.qty, 0);
  const threshold =
    typeof shipping.freeOverPiasters === "number"
      ? shipping.freeOverPiasters
      : null;
  const remaining =
    threshold !== null ? Math.max(0, threshold - subtotal) : 0;
  const progress = threshold ? Math.min(100, (subtotal / threshold) * 100) : 100;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            onClick={close}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t("cartTitle")}
            className="fixed inset-y-0 end-0 z-50 flex w-[92vw] max-w-md flex-col border-s shadow-2xl"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            dir="rtl"
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between border-b p-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <ShoppingBag
                  className="size-5"
                  style={{ color: "var(--primary)" }}
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                <h2 className="text-base font-black">{t("cartTitle")}</h2>
                {count > 0 ? (
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold"
                    style={{
                      background:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    {count}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="إغلاق"
                className="grid size-11 place-items-center rounded-xl transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2"
              >
                <X className="size-5" strokeWidth={SW} aria-hidden="true" />
              </button>
            </div>

            {/* Free Shipping Bar */}
            {items.length > 0 && threshold !== null ? (
              <div
                className="shrink-0 border-b px-4 py-3"
                style={{
                  background: "color-mix(in srgb, var(--muted) 50%, transparent)",
                  borderColor: "var(--border)",
                }}
              >
                <p
                  className={cn(
                    "flex items-center gap-2 text-[12.5px] font-bold",
                    remaining === 0 && "text-emerald-600"
                  )}
                >
                  {remaining === 0 ? (
                    <>
                      <Sparkles
                        className="size-4 shrink-0"
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
                      {t("freeShippingReached")}
                    </>
                  ) : (
                    <>
                      <Truck
                        className="size-4 shrink-0"
                        strokeWidth={SW}
                        aria-hidden="true"
                      />
                      <span>{t("freeShippingGap", { amount: formatEgp(remaining) })}</span>
                    </>
                  )}
                </p>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full"
                  style={{ background: "var(--border)" }}
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${progress}%`,
                      background: "var(--primary)",
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <ShoppingBag
                      className="mx-auto mb-4 size-14 opacity-25"
                      strokeWidth={SW}
                      aria-hidden="true"
                    />
                    <p className="font-bold">{t("emptyCart")}</p>
                    <button type="button" onClick={close} className="s-btn mt-5">
                      {t("continueShopping")}
                    </button>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {items.map((i) => {
                    const k = itemKey(i);
                    const atMax = i.qty >= lineCap(i);
                    return (
                      <li
                        key={k}
                        className="flex gap-3 rounded-2xl border p-2.5"
                        style={{
                          background: "var(--card)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <Link
                          href={`/p/${encodeURIComponent(i.slug)}`}
                          onClick={close}
                          className="relative size-20 shrink-0 overflow-hidden rounded-lg"
                          style={{ background: "var(--muted)" }}
                        >
                          {i.imageUrl ? (
                            <Image
                              src={i.imageUrl}
                              alt={i.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : null}
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <Link
                            href={`/p/${encodeURIComponent(i.slug)}`}
                            onClick={close}
                            className="line-clamp-2 text-sm font-black leading-snug transition-opacity hover:opacity-80"
                          >
                            {i.name}
                          </Link>
                          {i.variantLabel ? (
                            <p className="mt-0.5 text-[11px] opacity-70">
                              {i.variantLabel}
                            </p>
                          ) : null}
                          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                            <div
                              className="flex items-center overflow-hidden rounded-lg border"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <button
                                type="button"
                                className="grid size-9 place-items-center transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
                                onClick={() => setQty(k, i.qty - 1)}
                                aria-label="تقليل"
                              >
                                <Minus className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                              </button>
                              <span className="w-8 text-center font-mono text-sm font-bold tabular-nums">
                                {i.qty}
                              </span>
                              <button
                                type="button"
                                className="grid size-9 place-items-center transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
                                onClick={() => setQty(k, i.qty + 1)}
                                disabled={atMax}
                                aria-label="زيادة"
                              >
                                <Plus className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                              </button>
                            </div>
                            <span className="font-mono text-sm font-black tabular-nums">
                              {formatEgp(i.unitPiasters * i.qty)}
                            </span>
                            <button
                              type="button"
                              onClick={() => remove(k)}
                              className="grid size-9 place-items-center rounded-lg text-rose-500 transition-colors hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2"
                              aria-label={`حذف ${i.name}`}
                            >
                              <Trash2 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 ? (
              <div
                className="shrink-0 border-t p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--background)",
                }}
              >
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-sm opacity-70">الإجمالي</span>
                  <span className="font-mono text-xl font-black tabular-nums">
                    {formatEgp(subtotal)}
                  </span>
                </div>
                <p className="mb-3 text-[11px] opacity-60">
                  الشحن يُحسب في الخطوة التالية حسب محافظتك
                </p>
                <Link href="/checkout" onClick={close} className="s-btn h-12 w-full text-sm">
                  {t("checkout")}
                  <ArrowLeft className="size-5" strokeWidth={SW} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={close}
                  className="mt-3 w-full text-center text-sm font-bold opacity-60 transition-opacity hover:opacity-100"
                >
                  {t("continueShopping")}
                </button>
              </div>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}