"use client";

// CartView — صفحة /cart:
// - عمودان على lg: أسطر السلة (يمين) + ملخص Sticky (يسار).
// - FreeShippingBar + زر إتمام.
// - Empty state أنيقة.
import Link from "next/link";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { Minus, Plus, Trash2, ShoppingBag, Truck } from "lucide-react";
import { useCart, itemKey, lineCap } from "@/store/cart";
import { useCopy, useStore } from "./StoreProvider";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";

const SW = 1.75;

const noopSubscribe = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useCartTotals() {
  const items = useCart((s) => s.items);
  const subtotal = items.reduce((a, i) => a + i.unitPiasters * i.qty, 0);
  const count = items.reduce((a, i) => a + i.qty, 0);
  return { items, subtotal, count };
}

export function FreeShippingBar({
  subtotal,
  className,
}: {
  subtotal: number;
  className?: string;
}) {
  const { shipping } = useStore();
  const t = useCopy();
  const threshold =
    typeof shipping.freeOverPiasters === "number"
      ? shipping.freeOverPiasters
      : null;
  if (threshold === null) return null;
  const remaining = Math.max(0, threshold - subtotal);
  const progress =
    threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 100;
  return (
    <div className={cn("text-sm", className)} dir="rtl">
      <p
        className={cn(
          "flex items-center gap-2 font-bold",
          remaining === 0 && "text-emerald-600"
        )}
      >
        <Truck className="size-4 shrink-0" strokeWidth={SW} aria-hidden="true" />
        {remaining === 0 ? t("freeShippingReached") : <span>{t("freeShippingGap", { amount: formatEgp(remaining) })}</span>}
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ background: "var(--border)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%`, background: "var(--primary)" }}
        />
      </div>
    </div>
  );
}

export function CartLines({
  onNavigate,
  large = false,
}: {
  onNavigate?: () => void;
  large?: boolean;
}) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  return (
    <ul className={cn("space-y-4", large && "space-y-0 divide-y")} style={large ? { borderColor: "var(--border)" } : undefined} dir="rtl">
      {items.map((i) => {
        const k = itemKey(i);
        const atMax = i.qty >= lineCap(i);
        return (
          <li
            key={k}
            className={cn("flex gap-3", large && "py-4")}
            style={large ? { borderColor: "var(--border)" } : undefined}
          >
            <div
              className={cn(
                "relative shrink-0 overflow-hidden rounded-xl",
                large ? "size-24" : "size-20"
              )}
              style={{ background: "var(--muted)" }}
            >
              {i.imageUrl ? (
                <Image
                  src={i.imageUrl}
                  alt={i.name}
                  fill
                  sizes={large ? "96px" : "80px"}
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link
                href={`/p/${encodeURIComponent(i.slug)}`}
                onClick={onNavigate}
                className="line-clamp-2 text-sm font-black transition-opacity hover:opacity-80"
              >
                {i.name}
              </Link>
              {i.variantLabel ? (
                <p className="text-[11px] opacity-70">{i.variantLabel}</p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <div
                  className="flex items-center rounded-lg border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    className="grid size-9 place-items-center disabled:opacity-40"
                    onClick={() => setQty(k, i.qty - 1)}
                    aria-label="تقليل الكمية"
                  >
                    <Minus strokeWidth={SW} className="size-3.5" aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center font-mono text-sm font-bold" aria-live="polite">
                    {i.qty}
                  </span>
                  <button
                    type="button"
                    className="grid size-9 place-items-center disabled:opacity-40"
                    onClick={() => setQty(k, i.qty + 1)}
                    disabled={atMax}
                    aria-label="زيادة الكمية"
                  >
                    <Plus strokeWidth={SW} className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
                <span className="font-mono text-sm font-black">
                  {formatEgp(i.unitPiasters * i.qty)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(k)}
                  className="grid size-9 place-items-center rounded-lg text-rose-500 transition-colors hover:bg-rose-500/10"
                  aria-label={`حذف ${i.name}`}
                >
                  <Trash2 strokeWidth={SW} className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EmptyCart({ onAction }: { onAction?: () => void }) {
  const t = useCopy();
  return (
    <div className="grid place-items-center py-12 text-center" dir="rtl">
      <ShoppingBag
        strokeWidth={SW}
        className="mx-auto mb-3 size-14 opacity-25"
        aria-hidden="true"
      />
      <p className="text-base font-black">{t("emptyCart")}</p>
      {onAction ? (
        <button type="button" onClick={onAction} className="s-btn mt-5">
          {t("continueShopping")}
        </button>
      ) : (
        <Link href="/" className="s-btn mt-5">
          {t("continueShopping")}
        </Link>
      )}
    </div>
  );
}

export function CartView() {
  const hydrated = useHydrated();
  const t = useCopy();
  const { items, subtotal, count } = useCartTotals();

  if (!hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]" aria-busy="true">
        <div className="h-64 animate-pulse rounded-3xl bg-[var(--muted)]" />
        <div className="h-48 animate-pulse rounded-3xl bg-[var(--muted)]" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div
        className="rounded-3xl border p-8"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <EmptyCart />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]" dir="rtl">
      <div
        className="rounded-3xl border p-5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <CartLines large />
      </div>
      <aside
        className="h-fit space-y-4 rounded-3xl border p-5 lg:sticky lg:top-24"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h2 className="font-heading text-lg font-black">ملخص السلة</h2>
        <FreeShippingBar subtotal={subtotal} />
        <div
          className="flex justify-between border-t pt-4 text-base font-black"
          style={{ borderColor: "var(--border)" }}
        >
          <span>الإجمالي ({count})</span>
          <span className="font-mono">{formatEgp(subtotal)}</span>
        </div>
        <p className="text-xs opacity-60">
          الشحن يُحسب في الخطوة التالية حسب محافظتك
        </p>
        <Link href="/checkout" className="s-btn h-12 w-full text-sm">
          {t("checkout")}
        </Link>
        <Link href="/" className="block text-center text-sm font-bold opacity-60 transition-opacity hover:opacity-100">
          {t("continueShopping")}
        </Link>
      </aside>
    </div>
  );
}