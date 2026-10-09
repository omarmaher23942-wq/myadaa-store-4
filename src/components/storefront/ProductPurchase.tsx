"use client";

// ProductPurchase.tsx — بلوك الشراء في صفحة المنتج.
// مسار شراء واحد فقط: «اشترِ الآن» يضع المنتج في السلة وينقل العميل لصفحة إتمام الطلب، حيث يختار
// بوضوح متى وكيف يدفع (عند الاستلام أو مقدماً بالتحويل). لا نوافذ طلب سريع تخفي الاختيار أو تفرضه.
// صف الثقة أسفل الأزرار يُشتق من حقائق المتجر الفعلية، فلا يَعِد بما لا يطبقه التاجر.
import { colorFromName } from "@/lib/color-names";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Share2, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Price } from "./Price";
import { Icon } from "./Icon";
import { useCopy, useStore } from "./StoreProvider";
import { useCart } from "@/store/cart";
import { flyToCart } from "./motion";
import { groundedItems } from "@/blueprint/facts";
import { cn } from "@/lib/utils";
import type { Product, Variant } from "@/server/repos/catalog";

type PurchaseProduct = Product & { variants: Variant[] };

/** ترتيب الحقائق حسب أهميتها لقرار الشراء في صفحة المنتج. */
const TRUST_ORDER = ["cod", "inspection", "returns", "free_shipping_over", "free_shipping", "fast_delivery", "nationwide", "defect", "wallets"];

export function ProductPurchase({ product: p }: { product: PurchaseProduct; payments?: unknown }) {
  const router = useRouter();
  const { conversion, facts } = useStore();
  const t = useCopy();
  const add = useCart((s) => s.add);
  const items = useCart((s) => s.items);

  const [sel, setSel] = useState<string[]>(p.optionNames.map(() => ""));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [missing, setMissing] = useState(false);

  const variant = useMemo(() => p.variants.find((v) => v.optionValues.every((val, i) => val === sel[i])), [p.variants, sel]);
  const needsVariant = p.optionNames.length > 0 && !variant;
  const price = variant?.pricePiasters ?? p.pricePiasters;
  const compareAt = variant?.compareAtPiasters ?? p.compareAtPiasters;
  const stock = variant ? variant.stock : p.stock;
  const out = (p.trackStock && stock !== null && stock <= 0) || (variant && !variant.isAvailable);

  const optionValues = (i: number) => Array.from(new Set(p.variants.map((v) => v.optionValues[i]!)));
  const available = (i: number, val: string) =>
    p.variants.some(
      (v) =>
        v.optionValues[i] === val &&
        v.isAvailable &&
        (!p.trackStock || v.stock === null || v.stock > 0) &&
        v.optionValues.every((ov, k) => k === i || !sel[k] || ov === sel[k])
    );

  const item = () => ({
    productId: p.id,
    variantId: variant?.id,
    slug: p.slug,
    name: p.name,
    imageUrl: variant?.imageUrl ?? p.images[0]?.url,
    unitPiasters: price,
    variantLabel: variant?.optionValues.join(" / "),
    maxQty: p.trackStock ? stock : null,
  });

  /** خيار ناقص: رسالة واضحة + تمييز مكان الاختيار، لا صمت. */
  const guard = () => {
    if (!needsVariant) return true;
    setMissing(true);
    toast.error(`اختر ${p.optionNames.filter((_, i) => !sel[i]).join(" و")} أولاً`);
    document.querySelector("[data-variant-picker]")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  };

  const onAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!guard()) return;
    add(item(), qty);
    flyToCart(e.currentTarget.closest<HTMLElement>("[data-purchase-block]") ?? e.currentTarget, variant?.imageUrl ?? p.images[0]?.url);
    setAdded(true);
    toast.success(`${p.name} في السلة`);
    setTimeout(() => setAdded(false), 1600);
  };

  const onBuyNow = () => {
    if (!guard()) return;
    // لا نكرر المنتج لو كان في السلة بنفس الاختيار: نذهب مباشرة لإتمام الطلب.
    const inCart = items.some((x) => x.productId === p.id && (x.variantId ?? null) === (variant?.id ?? null));
    if (!inCart) add(item(), qty);
    router.push("/checkout");
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: p.name, url });
      } catch {
        /* ألغى المشاركة */
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط المنتج");
    }
  };

  useEffect(() => {
    if (!needsVariant) setMissing(false);
    const root = document.querySelector<HTMLElement>("[data-purchase-block]");
    if (!root) return;
    root.dataset.variantId = variant?.id ?? "";
    root.dataset.variantLabel = variant?.optionValues.join(" / ") ?? "";
    root.dataset.pricePiasters = String(price);
    root.dataset.stock = stock === null ? "inf" : String(stock);
    root.dataset.out = out ? "1" : "0";
    root.dataset.productId = p.id;
    root.dataset.productName = p.name;
    root.dataset.productImage = variant?.imageUrl ?? p.images[0]?.url ?? "";
    root.dataset.productSlug = p.slug;
  }, [variant, price, stock, out, p.id, p.name, p.images, p.slug, needsVariant]);

  // صف الثقة: صياغة التاجر إن كتبها (مفلترة بالحقائق)، وإلا أهم حقائق المتجر الفعلية.
  const trust = useMemo(() => {
    const custom = groundedItems(conversion.productTrustRow.map((r) => ({ ...r, title: r.text })), facts);
    if (custom.length) return custom.slice(0, 4).map((r) => ({ icon: r.icon, text: r.text }));
    return facts
      .filter((f) => TRUST_ORDER.includes(f.key))
      .sort((a, b) => TRUST_ORDER.indexOf(a.key) - TRUST_ORDER.indexOf(b.key))
      .slice(0, 4)
      .map((f) => ({ icon: f.icon, text: f.title }));
  }, [conversion.productTrustRow, facts]);

  return (
    <div className="mt-5 space-y-5" dir="rtl">
      <Price price={price} compareAt={compareAt} size="lg" showSavings={conversion.showSavings} />

      {p.optionNames.length ? (
        <div data-variant-picker className={cn("space-y-4 rounded-2xl transition", missing && "p-3 ring-2 ring-[var(--danger)]/60")}>
          {p.optionNames.map((name, i) => {
            const values = optionValues(i);
            const isColor = /لون|color/i.test(name);
            return (
              <div key={name}>
                <p className="mb-2 text-xs font-bold">
                  {name}: <span className={cn("font-normal", sel[i] ? "opacity-70" : missing ? "text-[var(--danger)]" : "opacity-70")}>{sel[i] || "اختر"}</span>
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
                  {values.map((val) => {
                    const ok = available(i, val);
                    const on = sel[i] === val;
                    return (
                      <button
                        type="button"
                        key={val}
                        role="radio"
                        aria-checked={on}
                        disabled={!ok}
                        onClick={() => setSel((s) => s.map((x, k) => (k === i ? val : x)))}
                        className={cn(
                          "s-chip relative inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 border-2 px-3.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2",
                          on ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]" : "border-[var(--border)] hover:border-[var(--foreground)]/40",
                          !ok && "cursor-not-allowed line-through opacity-30"
                        )}
                      >
                        {isColor ? <span className="size-4 rounded-full border" style={{ background: colorFromLabel(val), borderColor: "var(--border)" }} aria-hidden="true" /> : null}
                        <span>{val}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <span className="text-xs font-bold">الكمية</span>
        <div className="s-input flex items-center overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          <button type="button" className="grid size-11 place-items-center transition-colors hover:bg-[var(--muted)] disabled:opacity-40" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="تقليل الكمية" disabled={qty <= 1}>
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
          <span className="w-12 text-center text-sm font-black tabular-nums" aria-live="polite">
            {qty}
          </span>
          <button type="button" className="grid size-11 place-items-center transition-colors hover:bg-[var(--muted)] disabled:opacity-40" onClick={() => setQty(Math.min(qty + 1, stock ?? 99))} aria-label="زيادة الكمية" disabled={stock !== null && qty >= (stock ?? 0)}>
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
        <button type="button" onClick={onBuyNow} disabled={!!out} className="s-btn h-12 flex-[2] text-[15px]">
          {out ? t("soldOut") : t("buyNow")}
          {!out ? <ArrowLeft className="size-4" aria-hidden="true" /> : null}
        </button>
        <button type="button" onClick={onAdd} disabled={!!out} className="s-btn-ghost h-12 flex-1">
          {added ? <Check className="size-4" aria-hidden="true" /> : <ShoppingBag className="size-4" aria-hidden="true" />}
          <span>{added ? "في السلة" : t("addToCart")}</span>
        </button>
      </div>

      {trust.length ? (
        <ul className={cn("grid gap-2 rounded-2xl border p-3.5 text-[12px] font-bold", trust.length === 1 ? "grid-cols-1" : "grid-cols-2")} style={{ background: "color-mix(in srgb, var(--muted) 60%, transparent)", borderColor: "var(--border)" }}>
          {trust.map((r, i) => (
            <li key={i} className={cn("flex items-center gap-2", trust.length === 3 && i === 2 && "col-span-2")}>
              <Icon name={r.icon} className="size-4 shrink-0 text-[var(--primary)]" />
              {r.text}
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" onClick={share} className="inline-flex items-center gap-1.5 text-xs font-bold opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2">
        <Share2 className="size-3.5" aria-hidden="true" />
        <span>مشاركة المنتج</span>
      </button>
    </div>
  );
}

function colorFromLabel(label: string): string {
  return colorFromName(label) ?? "var(--muted)";
}
