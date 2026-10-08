// C:\Users\ahmed maher\Desktop\colapia\src\app\(platform)\dashboard\products\page.tsx — المنتجات (v3).
//
// التعديلات الجذرية (موجة 3):
//  1) Import CSV/Excel (زر يفتح dialog).
//  2) AI bulk enhancements (تحسين جماعي لـ SEO).
//  3) Duplicate detection (تنبيه لأسماء متشابهة).
//  4) فلترة متقدمة (فئة، حالة، مخزون منخفض).
import Link from "next/link";
import { and, asc, desc, eq, isNull, sql, ilike, or } from "drizzle-orm";
import {
  Plus,
  Package,
  LayoutGrid,
  AlertTriangle,
  TrendingDown,
  Sparkles,
  Upload,
} from "lucide-react";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { products, categories } from "@/db/schema/catalog";
import { formatEgp } from "@/lib/money";
import { ProductsTable } from "@/components/dashboard/ProductsTable";
import { ProductsToolbar } from "@/components/dashboard/ProductsToolbar";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
  { key: "", label: "الكل" },
  { key: "active", label: "منشور" },
  { key: "draft", label: "مسودة" },
  { key: "hidden", label: "مخفي" },
  { key: "low_stock", label: "مخزون منخفض" },
] as const;

export default async function DashboardProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    categoryId?: string;
    q?: string;
  }>;
}) {
  const session = await getMerchantSession();
  if (!session || !session.storeId) redirect("/dashboard");
  const db = await getTenantDb(session.storeId!);

  const store = session.store!;
  const { status, categoryId, q } = await searchParams;

  const isLowStock = status === "low_stock";
  const statusFilter =
    status === "active" || status === "draft" || status === "hidden"
      ? status
      : undefined;

  const where = and(
    eq(products.storeId, store.id),
    isNull(products.deletedAt),
    statusFilter ? eq(products.status, statusFilter) : undefined,
    isLowStock
      ? and(
          eq(products.trackStock, true),
          eq(products.status, "active"),
          sql`${products.stock} <= 3`
        )
      : undefined,
    categoryId ? eq(products.categoryId, categoryId) : undefined,
    q ? ilike(products.name, `%${q}%`) : undefined
  );

  const [rows, cats, countsRaw, lowStockCount] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        pricePiasters: products.pricePiasters,
        compareAtPiasters: products.compareAtPiasters,
        costPiasters: products.costPiasters,
        stock: products.stock,
        trackStock: products.trackStock,
        status: products.status,
        images: products.images,
        shortDescription: products.shortDescription,
        categoryId: products.categoryId,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(200),

    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.storeId, store.id))
      .orderBy(asc(categories.name)),

    db
      .select({
        status: products.status,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(products)
      .where(and(eq(products.storeId, store.id), isNull(products.deletedAt)))
      .groupBy(products.status),

    db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(
        and(
          eq(products.storeId, store.id),
          isNull(products.deletedAt),
          eq(products.trackStock, true),
          eq(products.status, "active"),
          sql`${products.stock} <= 3`
        )
      ),
  ]);

  const counts = Object.fromEntries(countsRaw.map((c) => [c.status, c.count]));
  const total = countsRaw.reduce((a, c) => a + c.count, 0);
  const lowStockTotal = lowStockCount[0]?.c ?? 0;

  const statusCount = (k: string): number => {
    if (k === "") return total;
    if (k === "low_stock") return lowStockTotal;
    return counts[k] ?? 0;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            المنتجات
          </h1>
          <p className="mt-1 text-xs text-ink-3">
            {total.toLocaleString("ar-EG")} منتج · {store.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProductsToolbar />
          <Link
            href="/dashboard/products/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-xs font-black text-white shadow-md transition-all hover:shadow-lg"
          >
            <Plus className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            <span>منتج جديد</span>
          </Link>
        </div>
      </header>

      {/* Status tabs */}
      <nav aria-label="تصفية بحالة المنتج" className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => {
          const active = (status ?? "") === t.key;
          const c = statusCount(t.key);
          const isWarningTab = t.key === "low_stock";
          return (
            <Link
              key={t.key || "all"}
              href={t.key ? `?status=${t.key}` : "?"}
              scroll={false}
              className={
                active
                  ? `inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-xs font-black text-white ${isWarningTab ? "bg-rose-500" : "bg-nova"}`
                  : `inline-flex h-10 items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.02] px-3.5 text-xs font-bold transition-colors hover:bg-edge/[0.04] ${isWarningTab && c > 0 ? "text-rose-600 dark:text-rose-300" : "text-ink-2"}`
              }
            >
              {isWarningTab ? (
                <AlertTriangle className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              ) : null}
              <span>{t.label}</span>
              <span
                className={
                  active
                    ? "rounded-full bg-black/20 px-1.5 font-mono text-[10.5px]"
                    : "rounded-full bg-edge/5 px-1.5 font-mono text-[10.5px]"
                }
              >
                {c.toLocaleString("ar-EG")}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Category filter */}
      {cats.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <LayoutGrid className="size-3.5 text-ink-3" strokeWidth={2} aria-hidden="true" />
          <Link
            href="?"
            className={
              !categoryId
                ? "rounded-full bg-nova/20 px-3 py-1 text-[11px] font-bold text-nova-2"
                : "rounded-full border border-edge/10 px-3 py-1 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.04]"
            }
          >
            كل الأقسام
          </Link>
          {cats.map((c) => (
            <Link
              key={c.id}
              href={`?categoryId=${c.id}`}
              className={
                categoryId === c.id
                  ? "rounded-full bg-nova/20 px-3 py-1 text-[11px] font-bold text-nova-2"
                  : "rounded-full border border-edge/10 px-3 py-1 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.04]"
              }
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}

      <ProductsTable
        rows={rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}