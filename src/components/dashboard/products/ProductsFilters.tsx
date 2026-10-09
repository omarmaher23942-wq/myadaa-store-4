"use client";

// ProductsFilters — شريط البحث والقسم والترتيب في صفحة المنتجات. نموذج GET عادي (يعمل بلا JavaScript)، و`next/form`
// يجعل الانتقال داخل التطبيق؛ تغيير القسم أو الترتيب يطبّق فوراً، والبحث بزر الإدخال. أي تغيير يعيد للصفحة الأولى.
import Form from "next/form";
import { ArrowDownUp, FolderOpen, Search } from "lucide-react";
import type { ProductsQuery } from "@/server/repos/products-list";

const SORT_LABEL: Record<ProductsQuery["sort"], string> = {
  new: "الأحدث",
  best: "الأكثر مبيعاً",
  price_asc: "الأقل سعراً",
  price_desc: "الأعلى سعراً",
  stock: "الأقل كمية",
};

const selectCls =
  "min-h-11 w-full appearance-none rounded-xl border border-edge/10 bg-space-2 ps-9 pe-3 text-[12.5px] font-bold text-ink outline-none focus:border-nova/50 focus:ring-2 focus:ring-nova/20";

export function ProductsFilters({ query, categories }: { query: ProductsQuery; categories: { id: string; name: string }[] }) {
  const submit = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();
  return (
    <Form action="/dashboard/products" role="search" className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
      {query.status !== "all" ? <input type="hidden" name="status" value={query.status} /> : null}
      {query.stock !== "all" ? <input type="hidden" name="stock" value={query.stock} /> : null}
      {query.need ? <input type="hidden" name="need" value={query.need} /> : null}

      <div className="relative col-span-2 sm:flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder="اسم المنتج أو كوده (عربي أو فرانكو)"
          aria-label="بحث في المنتجات"
          enterKeyHint="search"
          className="min-h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] ps-9 pe-3 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-nova/50 focus:ring-2 focus:ring-nova/20"
        />
      </div>

      {categories.length ? (
        <label className="relative sm:w-48">
          <span className="sr-only">القسم</span>
          <FolderOpen className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <select name="category" defaultValue={query.category ?? ""} onChange={submit} className={selectCls}>
            <option value="">كل الأقسام</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className={categories.length ? "relative sm:w-44" : "relative col-span-2 sm:w-44"}>
        <span className="sr-only">الترتيب</span>
        <ArrowDownUp className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <select name="sort" defaultValue={query.sort} onChange={submit} className={selectCls}>
          {(Object.keys(SORT_LABEL) as ProductsQuery["sort"][]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
    </Form>
  );
}
