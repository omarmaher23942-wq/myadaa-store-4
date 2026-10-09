import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStore, getStoreBySubdomain } from "@/lib/tenant";
import {
  getCategoryBySlug,
  listProductsByCategory,
} from "@/server/repos/catalog";
import { ProductCard } from "@/components/storefront/ProductCard";

const SORTS = [
  ["popular", "الأكثر طلبًا"],
  ["newest", "الأحدث"],
  ["price_asc", "السعر: من الأقل"],
  ["price_desc", "السعر: من الأعلى"],
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string; slug: string }>;
}): Promise<Metadata> {
  const { store: sub, slug } = await params;
  const store = await getStoreBySubdomain(sub);
  const cat = store ? await getCategoryBySlug(store.id, decodeURIComponent(slug)) : null;
  if (!cat || !cat.isVisible) return { robots: { index: false } };
  const path = `/c/${encodeURIComponent(cat.slug)}`;
  return {
    title: cat.name,
    description: cat.description ?? undefined,
    alternates: { canonical: path },
    openGraph: { title: cat.name, url: path, images: cat.imageUrl ? [cat.imageUrl] : undefined },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { store: sub, slug } = await params;
  const { sort = "popular", page = "1" } = await searchParams;

  const store = await requireStore(sub);
  const cat = await getCategoryBySlug(store.id, decodeURIComponent(slug));
  // القسم الذي أخفاه التاجر لا تُفتح صفحته (منتجاته تبقى ظاهرة في المتجر).
  if (!cat || !cat.isVisible) notFound();

  const rows = await listProductsByCategory(
    store.id,
    cat.id,
    sort,
    Number(page)
  );

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">{cat.name}</h1>
          {cat.description && (
            <p className="mt-1 text-muted-foreground">{cat.description}</p>
          )}
        </div>

        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {SORTS.map(([k, l]) => (
            <Link
              key={k}
              href={`?sort=${k}`}
              className={`rounded-md px-3 py-1.5 ${
                sort === k ? "bg-background font-bold shadow" : ""
              }`}
            >
              {l}
            </Link>
          ))}
        </div>
      </div>

      {rows.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {rows.map((p) => (
            <ProductCard key={p.id} product={p as never} />
          ))}
        </div>
      ) : (
        <p className="py-20 text-center text-muted-foreground">
          لا توجد منتجات في هذا القسم حاليًا
        </p>
      )}

      {rows.length === 24 && (
        <div className="mt-8 text-center">
          <Link
            href={`?sort=${sort}&page=${Number(page) + 1}`}
            className="btn-brand"
          >
            عرض المزيد
          </Link>
        </div>
      )}
    </div>
  );
}