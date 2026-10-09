// dashboard/products/page.tsx — المنتجات: تبويبات الحالة بأعدادها، وفلاتر المخزون وما ينقص كل منتج (صورة، تكلفة، وصف)،
// وبحث بالعربي والفرانكو والكود، وقسم وترتيب، وصفحات حقيقية، واستيراد من ملف، وكتابة الأوصاف الناقصة بالذكاء الاصطناعي.
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ImageOff, Layers, PackageMinus, PackageOpen, PackageX, Plus, ReceiptText, SearchX, TextCursorInput, X } from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { listProducts, parseProductsQuery, type ProductsQuery } from "@/server/repos/products-list";
import { ProductsList } from "@/components/dashboard/products/ProductsList";
import { ProductsFilters } from "@/components/dashboard/products/ProductsFilters";
import { ImportProducts } from "@/components/dashboard/products/ImportProducts";
import { AiFillDescriptions } from "@/components/dashboard/products/AiFillDescriptions";
import { PendingImages } from "@/components/dashboard/products/ImageMover";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { NO_STORE_HREF } from "@/lib/edition";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
// نقل صور ملف الاستيراد يجلب صوراً من مواقع خارجية؛ يكفيه هذا لأبطأ منتج (10 صور).
export const maxDuration = 60;
export const metadata = { title: "المنتجات" };

type SP = Record<string, string | undefined>;

const STATUS_TABS: { key: ProductsQuery["status"]; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "منشور" },
  { key: "draft", label: "مسودة" },
  { key: "hidden", label: "مخفي" },
];

function href(q: ProductsQuery, patch: Partial<ProductsQuery>): string {
  const n = { ...q, ...patch };
  const p = new URLSearchParams();
  if (n.status !== "all") p.set("status", n.status);
  if (n.stock !== "all") p.set("stock", n.stock);
  if (n.need) p.set("need", n.need);
  if (n.category) p.set("category", n.category);
  if (n.q) p.set("q", n.q);
  if (n.sort !== "new") p.set("sort", n.sort);
  if (n.page > 1) p.set("page", String(n.page));
  const s = p.toString();
  return s ? `/dashboard/products?${s}` : "/dashboard/products";
}

export default async function DashboardProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/products");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  const store = session.store;
  const query = parseProductsQuery(await searchParams);
  const data = await listProducts(store.id, query);
  const { counts } = data;

  const narrowed = Boolean(query.q || query.category); // يغيّر الأعداد نفسها
  const filtered = narrowed || query.status !== "all" || query.stock !== "all" || query.need !== null;
  const empty = counts.all === 0 && !narrowed;

  // فلاتر المخزون وما ينقص: تظهر فقط حين يوجد ما تعرضه، أو حين تكون مختارة.
  const chips = [
    { key: "out", group: "stock", n: counts.out, label: "نفد", icon: PackageX, tone: "bad" },
    { key: "low", group: "stock", n: counts.low, label: "كمية منخفضة", icon: PackageMinus, tone: "warn" },
    { key: "variants_out", group: "stock", n: counts.variantsOut, label: "نفد مقاس أو لون", icon: Layers, tone: "warn" },
    { key: "image", group: "need", n: counts.noImage, label: "بلا صورة", icon: ImageOff, tone: "muted" },
    { key: "cost", group: "need", n: counts.noCost, label: "بلا سعر تكلفة", icon: ReceiptText, tone: "muted" },
    { key: "description", group: "need", n: counts.noDescription, label: "بلا وصف", icon: TextCursorInput, tone: "muted" },
  ] as const;
  const visibleChips = chips.filter((c) => c.n > 0 || (c.group === "stock" ? query.stock === c.key : query.need === c.key));

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="space-y-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">المنتجات</h1>
            <p className="mt-1 text-[12.5px] text-ink-3">
              {empty
                ? "لا منتجات بعد"
                : filtered
                  ? `${arCount(data.total, NOUN.product)} ${data.total === 1 ? "يطابق" : "تطابق"} الاختيار`
                  : `${arCount(counts.all, NOUN.product)}، ${counts.active === counts.all ? "كلها في المتجر" : counts.active ? `منها ${fmtNum(counts.active)} في المتجر` : "لم يُنشر أي منها بعد"}`}
            </p>
          </div>
          <NewProductLink className="sm:hidden" />
        </div>
        <div className="flex flex-wrap items-center gap-2 *:flex-1 *:justify-center sm:*:flex-none">
          <AiFillDescriptions missing={counts.noDescription} />
          <ImportProducts />
          <NewProductLink className="hidden sm:inline-flex" />
        </div>
      </header>

      {empty ? (
        <FirstProduct />
      ) : (
        <>
          {!narrowed ? <PendingImages count={counts.externalImages} /> : null}
          <nav aria-label="حالة المنتج" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {STATUS_TABS.map((t) => {
              const active = query.status === t.key;
              const n = t.key === "all" ? counts.all : counts[t.key];
              return (
                <Link
                  key={t.key}
                  href={href(query, { status: t.key, page: 1 })}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-bold transition-colors",
                    active ? "border-nova bg-nova text-white" : "border-edge/10 text-ink-2 hover:bg-edge/[0.05]"
                  )}
                >
                  {t.label}
                  <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-black/15" : "bg-edge/[0.06]")}>{fmtNum(n)}</span>
                </Link>
              );
            })}
          </nav>

          <ProductsFilters key={`${query.q}|${query.category}|${query.sort}`} query={query} categories={data.categories} />

          {visibleChips.length ? (
            <nav aria-label="تصفية بالمخزون وما ينقص المنتج" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
              {visibleChips.map((c) => {
                const active = c.group === "stock" ? query.stock === c.key : query.need === c.key;
                const patch: Partial<ProductsQuery> =
                  c.group === "stock" ? { stock: active ? "all" : (c.key as ProductsQuery["stock"]) } : { need: active ? null : (c.key as ProductsQuery["need"]) };
                const Icon = c.icon;
                return (
                  <Link
                    key={c.key}
                    href={href(query, { ...patch, page: 1 })}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-colors",
                      active
                        ? c.tone === "bad"
                          ? "border-bad/40 bg-bad/12 text-bad"
                          : c.tone === "warn"
                            ? "border-warn/40 bg-warn/12 text-warn"
                            : "border-nova/40 bg-nova/12 text-nova-2"
                        : cn("border-edge/10 hover:bg-edge/[0.05]", c.tone === "bad" ? "text-bad" : c.tone === "warn" ? "text-warn" : "text-ink-3 hover:text-ink")
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {c.label}
                    <span className="tabular-nums">{fmtNum(c.n)}</span>
                    {active ? <X className="size-3.5" aria-label="إلغاء الفلتر" /> : null}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          {data.rows.length ? (
            <>
              <ProductsList rows={data.rows} categories={data.categories} subdomain={store.subdomain} />
              {data.pages > 1 ? (
                <nav aria-label="صفحات المنتجات" className="flex items-center justify-between gap-3 pt-1">
                  <PageLink disabled={query.page <= 1} href={href(query, { page: query.page - 1 })} label="السابقة" dir="prev" />
                  <span className="text-[12px] font-bold tabular-nums text-ink-3">
                    صفحة {fmtNum(query.page)} من {fmtNum(data.pages)}
                  </span>
                  <PageLink disabled={query.page >= data.pages} href={href(query, { page: query.page + 1 })} label="التالية" dir="next" />
                </nav>
              ) : null}
            </>
          ) : (
            <div className="dash-card flex flex-col items-center gap-2 px-6 py-14 text-center">
              <SearchX className="size-8 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
              <p className="text-[14px] font-black text-ink">{query.page > data.pages ? "هذه الصفحة غير موجودة" : "لا منتجات تطابق هذا الاختيار"}</p>
              <p className="max-w-sm text-[12.5px] leading-6 text-ink-3">جرّب جزءاً من اسم المنتج أو كوده، أو اعرض كل المنتجات.</p>
              <Link href="/dashboard/products" className="mt-1 inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
                عرض كل المنتجات
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewProductLink({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard/products/new"
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md transition-shadow hover:shadow-lg",
        className
      )}
    >
      <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
      منتج جديد
    </Link>
  );
}

function FirstProduct() {
  return (
    <div className="dash-card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-nova/12 text-nova-2">
        <PackageOpen className="size-7" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-[15px] font-black text-ink">أضف أول منتج في متجرك</p>
      <p className="max-w-md text-[12.5px] leading-6 text-ink-3">
        اكتب الاسم والسعر وارفع الصور، ويكتب لك مساعد المتجر الوصف وكلمات البحث. وإن كانت منتجاتك في ملف Excel فاستوردها كلها مرة واحدة من «استيراد من ملف».
      </p>
      <Link
        href="/dashboard/products/new"
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md"
      >
        <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
        منتج جديد
      </Link>
    </div>
  );
}

function PageLink({ href, label, dir, disabled }: { href: string; label: string; dir: "prev" | "next"; disabled: boolean }) {
  const Icon = dir === "prev" ? ChevronRight : ChevronLeft;
  const cls = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold";
  const body = (
    <>
      {dir === "prev" ? <Icon className="size-4" aria-hidden="true" /> : null}
      {label}
      {dir === "next" ? <Icon className="size-4" aria-hidden="true" /> : null}
    </>
  );
  if (disabled)
    return (
      <span className={cn(cls, "text-ink-3/50")} aria-disabled="true">
        {body}
      </span>
    );
  return (
    <Link href={href} className={cn(cls, "text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink")}>
      {body}
    </Link>
  );
}
