"use client";

// ProductGrid — عرض المنتجات بشكل يتبع عددها الحقيقي، لا قالباً ثابتاً:
//  - منتج واحد: عرض بطولي كبير (صورة + اسم + وصف + سعر + زر شراء) بدل بطاقة وحيدة في شبكة فارغة.
//  - spotlight مع أكثر من منتج: الأول بطولي والباقي شبكة صغيرة.
//  - grid: عدد الأعمدة يُختار حتى لا يبقى صف أخير ناقص قدر الإمكان، وعلى الموبايل آخر عنصر فردي يأخذ العرض كاملاً.
//  - featured_first: الأول بحجم مضاعف والباقي حوله، بعدد يملأ الشبكة تماماً.
//  - carousel: شريط أفقي بانسياب، بأسهم على الكمبيوتر.
import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import { ProductCard, type ProductCardProduct } from "@/components/storefront/ProductCard";
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import { useCopy } from "@/components/storefront/StoreProvider";
import { Price } from "@/components/storefront/Price";
import { useCart } from "@/store/cart";
import type { ProductGridSection } from "@/blueprint/schema";

type GridProduct = ProductCardProduct & { shortDescription?: string | null };

/** أعمدة الكمبيوتر: أكبر عدد ≤ المطلوب يملأ الصفوف (أو يترك خانة واحدة على الأكثر). */
export function balancedColumns(n: number, desired: number): number {
  const max = Math.max(2, Math.min(desired, 5));
  if (n <= max) return Math.max(2, n);
  for (let c = max; c >= 3; c--) if (n % c === 0) return c;
  for (let c = max; c >= 3; c--) if (n % c === c - 1) return c;
  return max;
}

const COLS: Record<number, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-3 lg:grid-cols-4", 5: "md:grid-cols-3 lg:grid-cols-5" };

export function ProductGrid({ s, products }: { s: ProductGridSection; products: GridProduct[] }) {
  const t = useCopy();
  const items = products.slice(0, s.limit ?? 8);
  const n = items.length;
  if (!n) return null;

  const variant = s.variant === "masonry" || s.variant === "bento" ? "featured_first" : s.variant === "two_rows_scroll" || s.variant === "carousel_3d" ? "carousel" : s.variant;
  const viewAll =
    s.showViewAll && products.length > n ? (
      <Link href={hrefFor({ type: "all_products" })} className="s-btn-ghost !min-h-10 shrink-0 text-[13px]">
        {t("viewAll")} <ArrowLeft className="size-4" />
      </Link>
    ) : null;

  const head = <SectionHeading title={s.title} subtitle={s.subtitle} action={viewAll} sectionId={s.id} />;

  if (n === 1 || variant === "spotlight") {
    const [first, ...rest] = items;
    return (
      <SectionShell s={s}>
        {head}
        <Spotlight product={first!} />
        {rest.length ? <Grid items={rest} desired={s.columnsDesktop ?? 4} className="mt-6 sm:mt-8" /> : null}
      </SectionShell>
    );
  }

  if (variant === "carousel" && n > 3) {
    return (
      <SectionShell s={s}>
        {head}
        <Carousel items={items} />
      </SectionShell>
    );
  }

  if (variant === "featured_first" && n >= 5) {
    // كبير + 4 (أو + 8) صغيرة تملأ شبكة 4 أعمدة بالضبط.
    const take = n >= 9 ? 9 : 5;
    const list = items.slice(0, take);
    return (
      <SectionShell s={s}>
        {head}
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {list.map((p, i) => (
            <li key={p.id} className={i === 0 ? "col-span-2 lg:row-span-2" : undefined}>
              <ProductCard product={p} size={i === 0 ? "lg" : "md"} priority={i === 0} />
            </li>
          ))}
        </ul>
      </SectionShell>
    );
  }

  return (
    <SectionShell s={s}>
      {head}
      <Grid items={items} desired={s.columnsDesktop ?? 4} />
    </SectionShell>
  );
}

function Grid({ items, desired, className }: { items: GridProduct[]; desired: number; className?: string }) {
  const n = items.length;
  const cols = balancedColumns(n, desired);
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4", COLS[cols], className)}>
      {items.map((p, i) => (
        // على الموبايل (عمودان): آخر عنصر فردي يأخذ الصف كاملاً بدل خانة فارغة بجانبه.
        <li key={p.id} className={cn(n % 2 === 1 && i === n - 1 && "col-span-2 md:col-span-1")}>
          <ProductCard product={p} size={n <= 3 ? "lg" : "md"} />
        </li>
      ))}
    </ul>
  );
}

function Carousel({ items }: { items: GridProduct[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8 * -1, behavior: "smooth" });
  return (
    <div className="relative">
      <ul ref={ref} className="-mx-[clamp(1rem,3vw,2rem)] flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-[clamp(1rem,3vw,2rem)] px-[clamp(1rem,3vw,2rem)] pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
        {items.map((p) => (
          <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%]">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
      <div className="pointer-events-none absolute inset-y-0 -inset-x-4 hidden items-center justify-between lg:flex">
        <button type="button" onClick={() => scroll(-1)} aria-label="السابق" className="s-btn pointer-events-auto !size-11 !min-h-0 !rounded-full !p-0 shadow-lg">
          <ChevronRight className="size-5" />
        </button>
        <button type="button" onClick={() => scroll(1)} aria-label="التالي" className="s-btn pointer-events-auto !size-11 !min-h-0 !rounded-full !p-0 shadow-lg">
          <ChevronLeft className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** عرض بطولي لمنتج واحد: يملأ المساحة بثقة بدل بطاقة صغيرة وحيدة. */
function Spotlight({ product: p }: { product: GridProduct }) {
  const t = useCopy();
  const add = useCart((s) => s.add);
  const href = `/p/${encodeURIComponent(p.slug)}`;
  const imgs = p.images.slice(0, 4);
  const hasOptions = (p.optionNames?.length ?? 0) > 0;
  const out = p.trackStock && typeof p.stock === "number" && p.stock <= 0 && !hasOptions;
  return (
    <div className="s-card grid gap-6 overflow-hidden p-3 sm:p-4 md:grid-cols-2 md:gap-10 md:p-6">
      <div className="grid gap-2">
        <Link href={href} className="s-media relative block !aspect-[4/5]" aria-label={p.name}>
          {imgs[0] ? <Image src={imgs[0].url} alt={imgs[0].alt ?? p.name} fill sizes="(max-width: 768px) 100vw, 50vw" priority className="!static" /> : <ShoppingBag className="m-auto size-12 opacity-30" />}
        </Link>
        {imgs.length > 1 ? (
          <div className="grid grid-cols-3 gap-2">
            {imgs.slice(1, 4).map((im, i) => (
              <Link key={i} href={href} className="s-media relative block !aspect-square" aria-hidden="true" tabIndex={-1}>
                <Image src={im.url} alt="" fill sizes="20vw" className="!static" />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col justify-center gap-4 pb-2 md:pb-0">
        {p.categoryName ? <span className="s-eyebrow">{p.categoryName}</span> : null}
        <Link href={href}>
          <h3 className="s-title font-heading">{p.name}</h3>
        </Link>
        {p.shortDescription ? <p className="s-sub">{p.shortDescription}</p> : null}
        <Price price={p.pricePiasters} compareAt={p.compareAtPiasters} size="lg" />
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href={href} className="s-btn flex-1 sm:flex-none">
            {out ? t("soldOut") : t("buyNow")} <ArrowLeft className="size-4" />
          </Link>
          {!hasOptions && !out ? (
            <button
              type="button"
              className="s-btn-ghost flex-1 sm:flex-none"
              onClick={() => {
                add({ productId: p.id, slug: p.slug, name: p.name, imageUrl: imgs[0]?.url, unitPiasters: p.pricePiasters, maxQty: p.trackStock ? p.stock : null });
                toast.success(`${p.name} في السلة`);
              }}
            >
              {t("addToCart")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
