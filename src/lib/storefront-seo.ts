// storefront-seo.ts — بيانات وصفية (metadata) و JSON-LD لصفحات المتجر.
// كل ما يظهر لمحركات البحث والمتصفح على نطاق المتجر يخص المتجر وحده، لا المنصة.
import "server-only";
import type { Metadata, Viewport } from "next";
import type { StoreBlueprint } from "@/blueprint/schema";
import type { TenantStore } from "@/lib/tenant";
import { storeUrl } from "@/lib/utils";

const STORE_ICON = "/api/storefront/icon";

/** المتاجر قيد التجربة أو المجمّدة لا تُفهرس؛ المفعّلة فقط تظهر في البحث. */
export function isIndexable(store: TenantStore, bp: StoreBlueprint | null): boolean {
  return store.status === "active" && !store.deletedAt && !bp?.seo.noIndex;
}

const clip = (s: string | undefined | null, max: number) =>
  s ? (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s) : undefined;

export function storeMetadata(store: TenantStore, bp: StoreBlueprint | null): Metadata {
  const name = bp?.brand.name ?? store.name;
  const title = bp?.seo.title || (bp?.brand.tagline ? `${name} | ${bp.brand.tagline}` : name);
  const description = clip(bp?.seo.description || bp?.brand.description || bp?.brand.tagline, 160);
  const ogImage = bp?.seo.ogImage ?? bp?.brand.logo?.url;
  const indexable = isIndexable(store, bp);

  return {
    metadataBase: new URL(storeUrl(store.subdomain)),
    title: { default: title, template: `%s | ${name}` },
    description,
    applicationName: name,
    authors: [{ name }],
    creator: name,
    publisher: name,
    icons: { icon: STORE_ICON, shortcut: STORE_ICON, apple: STORE_ICON },
    manifest: "/manifest.webmanifest",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: name,
      title,
      description,
      locale: "ar_EG",
      url: "/",
      images: ogImage ? [{ url: ogImage, alt: name }] : undefined,
    },
    twitter: { card: ogImage ? "summary_large_image" : "summary", title, description },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    formatDetection: { telephone: false },
  };
}

export function storeViewport(bp: StoreBlueprint | null): Viewport {
  const palette = (bp?.theme.palette ?? {}) as { background?: string };
  return {
    themeColor: palette.background ?? "#ffffff",
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

type ProductLike = {
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  pricePiasters: number;
  compareAtPiasters: number | null;
  sku: string | null;
  stock: number | null;
  trackStock: boolean;
  images: { url: string; alt?: string }[];
  ratingSum: number;
  ratingCount: number;
};

export function productMetadata(product: ProductLike): Metadata {
  const title = product.seoTitle || product.name;
  const description = clip(
    product.seoDescription || product.shortDescription || product.description,
    160
  );
  const path = `/p/${encodeURIComponent(product.slug)}`;
  const images = product.images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt || product.name }));
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", title, description, url: path, images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description },
  };
}

/** JSON-LD من نوع Product لنتائج بحث غنية (السعر، التوفر، التقييم). */
export function productJsonLd(store: TenantStore, storeName: string, product: ProductLike) {
  const inStock = !product.trackStock || product.stock === null || product.stock > 0;
  const url = storeUrl(store.subdomain, `/p/${encodeURIComponent(product.slug)}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: clip(product.shortDescription || product.description, 500),
    sku: product.sku ?? undefined,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: storeName },
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EGP",
      price: (product.pricePiasters / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: storeName },
    },
    aggregateRating:
      product.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: (product.ratingSum / product.ratingCount).toFixed(1),
            reviewCount: product.ratingCount,
          }
        : undefined,
  };
}

export function breadcrumbJsonLd(store: TenantStore, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: storeUrl(store.subdomain, it.path),
    })),
  };
}
