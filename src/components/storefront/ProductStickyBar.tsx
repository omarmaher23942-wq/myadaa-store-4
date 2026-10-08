"use client";

// ProductStickyBar — للموبايل فقط:
// - يظهر عند اختفاء [data-purchase-block] من الـ viewport.
// - يقرأ السعر/الحالة من data attributes محدثة من ProductPurchase.
// - «اشترِ الآن» يضع المنتج في السلة وينقل لصفحة إتمام الطلب (مسار الشراء الوحيد).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import { useCopy } from "./StoreProvider";
import { toast } from "sonner";
import { formatEgp } from "@/lib/money";
import { flyToCart } from "./motion";
import { useCart } from "@/store/cart";
import { cn } from "@/lib/utils";
import type { Product } from "@/server/repos/catalog";

const SW = 1.75;

type Snap = {
  price: number;
  out: boolean;
  variantId: string;
  variantLabel: string;
  stock: number | null;
  productId: string;
  productName: string;
  productImage: string;
  productSlug: string;
};

function readSnapshot(el: HTMLElement | null): Snap | null {
  if (!el) return null;
  const d = el.dataset;
  const price = Number(d.pricePiasters ?? NaN);
  if (!Number.isFinite(price)) return null;
  return {
    price,
    out: d.out === "1",
    variantId: d.variantId ?? "",
    variantLabel: d.variantLabel ?? "",
    stock: d.stock === "inf" ? null : Number(d.stock ?? 0),
    productId: d.productId ?? "",
    productName: d.productName ?? "",
    productImage: d.productImage ?? "",
    productSlug: d.productSlug ?? "",
  };
}

export function ProductStickyBar({ product }: { product: Product }) {
  const [visible, setVisible] = useState(false);
  const [snap, setSnap] = useState<Snap | null>(null);
  const add = useCart((s) => s.add);
  const items = useCart((s) => s.items);
  const router = useRouter();
  const t = useCopy();

  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-purchase-block]");
    if (!target) return;

    const initial = readSnapshot(target);
    if (initial) setSnap(initial);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        // يظهر فقط إذا خرج block بالكامل من الأسفل→الأعلى.
        const rect = entry.boundingClientRect;
        const isAbove = rect.bottom < 0;
        setVisible(isAbove);
        setSnap(readSnapshot(target));
      },
      { threshold: 0, rootMargin: "0px" }
    );
    observer.observe(target);

    // MutationObserver لتحديث السعر/الخيارات عند تغييرها داخل block.
    const mo = new MutationObserver(() => setSnap(readSnapshot(target)));
    mo.observe(target, {
      attributes: true,
      attributeFilter: [
        "data-price-piasters",
        "data-variant-id",
        "data-out",
        "data-stock",
      ],
    });

    return () => {
      observer.disconnect();
      mo.disconnect();
    };
  }, []);

  const onAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!snap || snap.out) return;
    if (!snap.variantId && product.optionNames.length > 0) {
      toast.error(`اختر ${product.optionNames.join(" و")} من الصفحة`);
      return;
    }
    add(
      {
        productId: snap.productId,
        variantId: snap.variantId || undefined,
        slug: snap.productSlug,
        name: snap.productName,
        imageUrl: snap.productImage,
        unitPiasters: snap.price,
        variantLabel: snap.variantLabel || undefined,
        maxQty: snap.stock,
      },
      1
    );
    flyToCart(e.currentTarget, snap.productImage);
    toast.success("تمت الإضافة للسلة");
  };

  const onBuyNow = () => {
    if (!snap || snap.out) return;
    if (!snap.variantId && product.optionNames.length > 0) {
      toast.error(`اختر ${product.optionNames.join(" و")} من الصفحة`);
      document.querySelector("[data-variant-picker]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const inCart = items.some((x) => x.productId === snap.productId && (x.variantId ?? "") === snap.variantId);
    if (!inCart)
      add({ productId: snap.productId, variantId: snap.variantId || undefined, slug: snap.productSlug, name: snap.productName, imageUrl: snap.productImage, unitPiasters: snap.price, variantLabel: snap.variantLabel || undefined, maxQty: snap.stock }, 1);
    router.push("/checkout");
  };

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-3 z-40 md:hidden",
        "transition-all duration-300",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-6 opacity-0"
      )}
      aria-hidden={!visible}
    >
      <div
        className="flex items-center gap-2 rounded-2xl border p-2 shadow-2xl backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--background) 92%, transparent)",
          borderColor: "var(--border)",
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold opacity-70">
            {snap?.variantLabel || product.name}
          </p>
          <p
            className="font-mono text-sm font-black"
            style={{ color: "var(--primary)" }}
          >
            {snap ? formatEgp(snap.price) : "—"}
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={!snap || snap.out}
          className="grid size-11 shrink-0 place-items-center rounded-xl border-2 transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
          aria-label={t("addToCart")}
        >
          <Plus className="size-4" strokeWidth={SW} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onBuyNow}
          disabled={!snap || snap.out}
          className="s-btn !min-h-11 shrink-0 text-xs"
        >
          <span>{snap?.out ? t("soldOut") : t("buyNow")}</span>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}