import type { Metadata } from "next";
import { Search } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { searchProducts } from "@/server/repos/catalog";
import { ProductCard } from "@/components/storefront/ProductCard";

// نتائج البحث صفحات رقيقة المحتوى: تُتاح للمستخدم ولا تُفهرس.
export const metadata: Metadata = { title: "كل المنتجات", robots: { index: false, follow: true } };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { store: sub } = await params;
  const { q = "" } = await searchParams;

  const store = await requireStore(sub);
  const rows = await searchProducts(store.id, q, 48);

  return (
    <div className="container-x py-8">
      <form className="mx-auto mb-8 flex max-w-xl items-center rounded-full border bg-card px-4 py-3 shadow-card focus-within:ring-2 ring-primary/30">
        <Search className="size-5 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="ابحث بالاسم أو الوصف..."
          className="flex-1 bg-transparent px-3 outline-none"
        />
      </form>

      <h1 className="mb-6 text-xl">
        {q ? `نتائج البحث عن "${q}" (${rows.length})` : "كل المنتجات"}
      </h1>

      {rows.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {rows.map((p) => (
            <ProductCard key={p.id} product={p as never} />
          ))}
        </div>
      ) : (
        <p className="py-20 text-center text-muted-foreground">
          مش لاقيين نتائج. جرّب كلمة مختلفة أو تصفح الأقسام.
        </p>
      )}
    </div>
  );
}