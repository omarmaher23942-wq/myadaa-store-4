"use client";

// ProductCard.tsx — بطاقة المنتج. لا تحمل أي شكل ثابت: الشكل كله من تصميم المتجر
// (blueprint/design.ts) عبر الخطافات .s-card و.s-media و.s-price و.s-badge، والنصوص بصوت المتجر.
// - صورة ثانية تظهر عند المرور إن اختار التصميم "swap".
// - إضافة سريعة للسلة، ونافذة اختيار سريعة للمنتجات ذات المقاسات والألوان.
// - تنبيه الكمية القليلة وشارات الخصم والأكثر طلباً.
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, ShoppingBag, Check, X, Minus } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { useCart } from "@/store/cart";
import { useCopy, useStore } from "./StoreProvider";
import { Price } from "./Price";
import { savingsPercent } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Product } from "@/server/repos/catalog";

export type ProductCardProduct = Product & {
  images: Array<{ id?: string; url: string; alt?: string | null }>;
  videoUrl?: string | null;
  isSpotlight?: boolean | null;
  categoryName?: string | null;
  variants?: Array<{ id: string; isAvailable: boolean; stock: number | null }>;
};

export function ProductCard({ product: p, size = "md", priority = false }: { product: ProductCardProduct; size?: "md" | "lg"; priority?: boolean }) {
  const { conversion, design, cardStyle } = useStore();
  const t = useCopy();
  const add = useCart((s) => s.add);
  const [quickOpen, setQuickOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const href = `/p/${encodeURIComponent(p.slug)}`;
  const primary = p.images[0];
  const second = design.card.hover === "swap" ? p.images[1] : undefined;
  const stock = p.variants && p.variants.length > 0 ? p.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0) : p.stock;
  const out = p.trackStock && typeof stock === "number" && stock <= 0;
  const lowStock = conversion.lowStockAlert.enabled && p.trackStock && typeof stock === "number" && stock > 0 && stock <= conversion.lowStockAlert.threshold;
  const pct = savingsPercent(p.pricePiasters, p.compareAtPiasters);
  const overlay = cardStyle === "overlay";
  const hasOptions = (p.optionNames?.length ?? 0) > 0;

  const onAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (out) return;
    if (hasOptions) {
      setQuickOpen(true);
      return;
    }
    add({ productId: p.id, slug: p.slug, name: p.name, imageUrl: primary?.url, unitPiasters: p.pricePiasters, maxQty: p.trackStock ? p.stock : null });
    setAdded(true);
    toast.success(`${p.name} في السلة`);
    window.setTimeout(() => setAdded(false), 1600);
  };

  const quick = design.card.quickAdd;
  const sizes = size === "lg" ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

  return (
    <>
      <article data-tilt className={cn("s-card group relative flex h-full flex-col overflow-hidden", overlay && "s-card-overlay")} data-out={out ? "1" : undefined}>
        <Link href={href} className="s-media block" aria-label={p.name}>
          {primary ? (
            <>
              <Image src={primary.url} alt={primary.alt ?? p.name} fill sizes={sizes} priority={priority} className="!static" />
              {second ? <Image src={second.url} alt="" fill sizes={sizes} className="!absolute" aria-hidden="true" /> : null}
            </>
          ) : (
            <span className="grid h-full w-full place-items-center opacity-40" aria-hidden="true">
              <ShoppingBag className="size-10" strokeWidth={1.25} />
            </span>
          )}

          <span className="pointer-events-none absolute start-2.5 top-2.5 flex flex-col items-start gap-1.5">
            {out ? <span className="s-badge" data-tone="muted">{t("soldOut")}</span> : pct > 0 ? <span className="s-badge" data-tone="sale">{t("saleBadge")} {pct}%</span> : null}
            {!out && p.isFeatured ? <span className="s-badge">{t("bestSellerBadge")}</span> : null}
          </span>
        </Link>

        <div className={cn("s-card-info flex flex-1 flex-col gap-1.5 p-3 sm:p-3.5", overlay && "s-card-info-overlay")}>
          {design.card.showCategory && p.categoryName ? <span className="text-[11px] font-bold opacity-60">{p.categoryName}</span> : null}
          <Link href={href} className="focus-visible:outline-none">
            <h3 className={cn("line-clamp-2 font-bold leading-snug", size === "lg" ? "text-base sm:text-lg" : "text-[13px] sm:text-sm")}>{p.name}</h3>
          </Link>
          {lowStock ? <span className="text-[11px] font-bold text-[var(--danger)]">{t("lowStock", { n: stock as number })}</span> : null}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <Price price={p.pricePiasters} compareAt={p.compareAtPiasters} size={size === "lg" ? "md" : "sm"} showSavings={false} />
            {quick === "icon" && !out ? (
              <button type="button" onClick={onAdd} aria-label={t("addToCart")} className="s-btn !min-h-0 !size-9 !rounded-full !p-0">
                {added ? <Check className="size-4" strokeWidth={2.5} /> : <Plus className="size-4" strokeWidth={2.5} />}
              </button>
            ) : null}
          </div>
          {quick === "button" && !out ? (
            <button type="button" onClick={onAdd} className="s-btn mt-2 w-full !min-h-10 text-[13px]">
              {added ? <Check className="size-4" strokeWidth={2.5} /> : null}
              {hasOptions ? t("buyNow") : t("addToCart")}
            </button>
          ) : null}
        </div>
      </article>

      <AnimatePresence>{quickOpen ? <QuickView product={p} onClose={() => setQuickOpen(false)} /> : null}</AnimatePresence>
    </>
  );
}

/** نافذة سريعة لاختيار المقاس واللون قبل الإضافة للسلة، دون مغادرة الصفحة. */
function QuickView({ product: p, onClose }: { product: ProductCardProduct; onClose: () => void }) {
  const reduce = useReducedMotion();
  const t = useCopy();
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [variants, setVariants] = useState<Array<{ id: string; optionValues: string[]; pricePiasters: number | null; stock: number | null; isAvailable: boolean; imageUrl: string | null }> | null>(null);
  const [sel, setSel] = useState<string[]>((p.optionNames ?? []).map(() => ""));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    fetch(`/api/storefront/variants?product=${encodeURIComponent(p.id)}`)
      .then((r) => (r.ok ? r.json() : { variants: [] }))
      .then((j: { variants?: typeof variants }) => setVariants(j.variants ?? []))
      .catch(() => setVariants([]));
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, p.id]);

  const names = p.optionNames ?? [];
  const chosen = variants?.find((v) => v.optionValues.every((val, i) => val === sel[i]));
  const valuesFor = (i: number) => Array.from(new Set((variants ?? []).map((v) => v.optionValues[i]).filter(Boolean))) as string[];
  const ok = (i: number, val: string) =>
    (variants ?? []).some((v) => v.optionValues[i] === val && v.isAvailable && (!p.trackStock || v.stock === null || v.stock > 0) && v.optionValues.every((ov, k) => k === i || !sel[k] || ov === sel[k]));
  const price = chosen?.pricePiasters ?? p.pricePiasters;
  const needs = names.length > 0 && !chosen;

  const onAdd = () => {
    if (needs) {
      toast.error(`اختر ${names.join(" و")}`);
      return;
    }
    add(
      {
        productId: p.id,
        variantId: chosen?.id,
        slug: p.slug,
        name: p.name,
        imageUrl: chosen?.imageUrl ?? p.images[0]?.url,
        unitPiasters: price,
        variantLabel: chosen?.optionValues.join(" / "),
        maxQty: p.trackStock ? (chosen ? chosen.stock : p.stock) : null,
      },
      qty
    );
    toast.success(`${p.name} في السلة`);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.18 }} onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center" role="presentation">
      <motion.div
        initial={{ y: reduce ? 0 : 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: reduce ? 0 : 28, opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="s-card grid max-h-[92dvh] w-full max-w-3xl gap-5 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label={p.name}
        dir="rtl"
      >
        <div className="s-media relative">
          {p.images[0] ? <Image src={chosen?.imageUrl ?? p.images[0].url} alt={p.name} fill sizes="(max-width: 640px) 90vw, 40vw" className="!static" /> : null}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-black leading-snug">{p.name}</h2>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-9 shrink-0 place-items-center rounded-full opacity-70 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>
          <Price price={price} compareAt={p.compareAtPiasters} size="lg" />
          {variants === null && names.length ? <p className="text-xs opacity-60">...</p> : null}
          {names.map((name, i) => (
            <div key={name}>
              <p className="mb-2 text-xs font-bold">
                {name}: <span className="font-normal opacity-70">{sel[i] || "اختر"}</span>
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
                {valuesFor(i).map((val) => {
                  const able = ok(i, val);
                  const active = sel[i] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!able}
                      onClick={() => setSel((s) => s.map((x, k) => (k === i ? val : x)))}
                      className={cn("s-chip min-h-10 min-w-11 border-2 px-3.5 text-xs font-bold transition", active ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)]", !able && "cursor-not-allowed line-through opacity-30")}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-auto flex items-center gap-3">
            <div className="s-input flex items-center border" style={{ borderColor: "var(--border)" }}>
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-11 place-items-center" aria-label="تقليل الكمية">
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center text-sm font-black tabular-nums">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(20, q + 1))} className="grid size-11 place-items-center" aria-label="زيادة الكمية">
                <Plus className="size-4" />
              </button>
            </div>
            <button type="button" onClick={onAdd} className="s-btn flex-1">
              {t("addToCart")}
            </button>
          </div>
          <Link href={`/p/${encodeURIComponent(p.slug)}`} className="text-center text-xs font-bold underline-offset-4 hover:underline">
            كل التفاصيل
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
