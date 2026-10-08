import type { Metadata } from "next";
import { Fragment, Suspense, cache } from "react";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { requireStore, getBlueprint, getStoreBySubdomain } from "@/lib/tenant";
import { getProductBySlug, frequentlyBoughtTogether, productReviews } from "@/server/repos/catalog";
import { ProductPurchase } from "@/components/storefront/ProductPurchase";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductStickyBar } from "@/components/storefront/ProductStickyBar";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Markdown } from "@/components/storefront/Markdown";
import { RecentlyViewed } from "@/components/storefront/RecentlyViewed";
import { ProductReviews } from "@/components/storefront/product/ProductReviews";
import { ShareButton } from "@/components/storefront/product/ShareButton";
import { Product3DViewer } from "@/components/storefront/Product3DViewer";
import { ARPreviewButton } from "@/components/storefront/ARPreviewButton";
import { Product360SpinViewer } from "@/components/storefront/Product360SpinViewer";
import { cn } from "@/lib/utils";
import { productMetadata, productJsonLd, breadcrumbJsonLd } from "@/lib/storefront-seo";
import { jsonLdString } from "@/lib/json-ld";

type P = { params: Promise<{ store: string; slug: string }> };

const SW = 1.75;

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

const loadProduct = cache((storeId: string, slug: string) => getProductBySlug(storeId, safeDecode(slug)));

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { store: sub, slug } = await params;
  const store = await getStoreBySubdomain(sub);
  if (!store) return {};
  const p = await loadProduct(store.id, slug);
  return p ? productMetadata(p) : { title: "المنتج غير موجود", robots: { index: false } };
}

export default async function ProductPage({ params }: P) {
  const { store: sub, slug } = await params;
  const store = await requireStore(sub);
  const [bp, p] = await Promise.all([getBlueprint(store.id), loadProduct(store.id, slug)]);
  if (!p) notFound();

  const [fbt, rv] = await Promise.all([
    bp.conversion.recommendations.frequentlyBoughtTogether ? frequentlyBoughtTogether(store.id, p as any, 4) : [],
    bp.productPage.showReviews ? productReviews(store.id, p.id) : [],
  ]);
  const avg = p.ratingCount ? p.ratingSum / p.ratingCount : 0;
  // استخراج صور الـ 360 إذا كانت موجودة (مثال: صور تنتهي بـ _360)
  const spinImages = p.images.filter(img => img.url.includes("_360")).map(img => img.url);
  const normalImages = p.images.filter(img => !img.url.includes("_360"));

  const jsonLd = [
    productJsonLd(store, bp.brand.name, p),
    breadcrumbJsonLd(store, [
      { name: bp.brand.name, path: "/" },
      { name: p.name, path: `/p/${encodeURIComponent(p.slug)}` },
    ]),
  ];

  return (
    <div className="container-x py-6 md:py-10" dir="rtl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <div className={cn("grid gap-8 md:gap-10", bp.productPage.layout !== "gallery_stacked" && "lg:grid-cols-2")}>
        
        {/* Gallery Area */}
        <div className="space-y-4">
          {/* View Transition Name للصورة الرئيسية */}
          <div style={{ viewTransitionName: `product-image-${p.id}` }}>
            {spinImages.length > 0 ? (
              <Product360SpinViewer images={spinImages} />
            ) : p.model3dUrl ? (
              <div className="aspect-square rounded-3xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                <Product3DViewer src={p.model3dUrl} iosSrc={p.modelUsdzUrl || undefined} alt={p.name} />
              </div>
            ) : (
              <ProductGallery images={normalImages} name={p.name} immersive={bp.productPage.layout === "immersive"} />
            )}
          </div>

          {p.isArEnabled && p.model3dUrl && (
            <div className="flex justify-center">
              <ARPreviewButton src={p.model3dUrl} iosSrc={p.modelUsdzUrl || undefined} alt={p.name} />
            </div>
          )}
        </div>

        {/* Product Details Area */}
        <div className="lg:sticky lg:top-24 lg:self-start" data-purchase-block>
          {p.badges.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {p.badges.map((b) => (
                <span key={b} className="rounded-md border px-2 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)", color: "var(--primary)" }}>
                  {b}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-2xl font-black leading-tight tracking-tight sm:text-3xl" style={{ viewTransitionName: `product-title-${p.id}` }}>
              {p.name}
            </h1>
            {bp.productPage.showShareButtons ? <ShareButton title={p.name} /> : null}
          </div>

          {p.ratingCount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <div className="flex text-[var(--primary)]">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} strokeWidth={SW} className={cn("size-4", k < Math.round(avg) ? "fill-current" : "opacity-25")} />
                ))}
              </div>
              <span className="font-bold opacity-80">{avg.toFixed(1)} ({p.ratingCount} تقييم)</span>
            </div>
          )}

          {p.shortDescription && (
            <p className="mt-3 text-sm leading-relaxed opacity-80">{p.shortDescription}</p>
          )}

          <ProductPurchase product={p as any} />

          {p.description && (
            <div className="mt-8 border-t pt-6" style={{ borderColor: "var(--border)" }}>
              <h2 className="mb-3 font-heading text-lg font-black">الوصف</h2>
              <Markdown text={p.description} className="prose-ar text-sm opacity-85" />
            </div>
          )}

          {bp.productPage.showAttributesTable && Array.isArray(p.attributes) && p.attributes.length ? (
            <dl className="mt-6 overflow-hidden rounded-2xl border text-sm" style={{ borderColor: "var(--border)" }}>
              {(p.attributes as { label: string; value: string }[]).map((a, i) => (
                <div key={i} className="grid grid-cols-[minmax(7rem,35%)_1fr] gap-3 px-4 py-2.5 odd:bg-[color-mix(in_srgb,var(--muted)_70%,transparent)]">
                  <dt className="font-bold opacity-70">{a.label}</dt>
                  <dd className="font-medium">{a.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>

      {fbt.length ? (
        <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--border)" }} aria-labelledby="fbt-title">
          <h2 id="fbt-title" className="font-heading text-xl font-black">
            يُشترى معه عادةً
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {fbt.map((x) => (
              <ProductCard key={x.id} product={x as any} />
            ))}
          </div>
        </section>
      ) : null}

      {bp.productPage.showReviews ? <ProductReviews reviews={rv} avg={avg} count={p.ratingCount} /> : null}

      <RecentlyViewed
        current={{ id: p.id, slug: p.slug, name: p.name, imageUrl: p.images[0]?.url, price: p.pricePiasters }}
      />

      <ProductStickyBar product={p as any} />
    </div>
  );
}