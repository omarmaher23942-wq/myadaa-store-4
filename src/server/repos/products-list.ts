// products-list.ts — قائمة منتجات لوحة التاجر: فلترة بالحالة والمخزون والقسم، وبحث بنفس تطبيع بحث المتجر (عربي
// وفرانكو وكود المنتج)، وترتيب (الأحدث، الأكثر مبيعاً، السعر، الكمية)، وصفحات حقيقية، ولكل منتج ما يلزم التاجر:
// عدد تركيباته وما نفد منها، ومبيعاته، وهل له وصف.
import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { categories, products } from "@/db/schema";
import { normalizeQuery } from "@/lib/arabic";
import { LOW_STOCK_MAX } from "@/server/repos/attention";

export const PRODUCTS_PAGE_SIZE = 40;
const STATUSES = ["active", "draft", "hidden"] as const;
const STOCKS = ["low", "out", "variants_out"] as const;
const SORTS = ["new", "best", "price_asc", "price_desc", "stock"] as const;
const NEEDS = ["image", "cost", "description"] as const;

export type ProductsQuery = {
  status: (typeof STATUSES)[number] | "all";
  stock: (typeof STOCKS)[number] | "all";
  category: string | null;
  /** ما ينقص المنتج: صورة أو سعر تكلفة أو وصف (روابط بنود الجاهزية). */
  need: (typeof NEEDS)[number] | null;
  q: string;
  sort: (typeof SORTS)[number];
  page: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseProductsQuery(sp: Record<string, string | undefined>): ProductsQuery {
  // روابط قديمة: status=low_stock
  const legacyLow = sp.status === "low_stock";
  return {
    status: STATUSES.includes(sp.status as never) ? (sp.status as ProductsQuery["status"]) : "all",
    stock: legacyLow ? "low" : STOCKS.includes(sp.stock as never) ? (sp.stock as ProductsQuery["stock"]) : "all",
    category: sp.category && UUID.test(sp.category) ? sp.category : sp.categoryId && UUID.test(sp.categoryId) ? sp.categoryId : null,
    need: NEEDS.includes(sp.need as never) ? (sp.need as ProductsQuery["need"]) : null,
    q: (sp.q ?? "").trim().slice(0, 60),
    sort: SORTS.includes(sp.sort as never) ? (sp.sort as ProductsQuery["sort"]) : "new",
    page: Math.max(1, Math.min(10_000, Number.parseInt(sp.page ?? "1", 10) || 1)),
  };
}

const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const variantsOutSql = sql`exists (select 1 from product_variants v where v.product_id = ${products.id} and v.is_available = true and coalesce(v.stock, 0) <= 0)`;

function stockCond(stock: ProductsQuery["stock"]): SQL | undefined {
  if (stock === "out") return and(eq(products.trackStock, true), sql`coalesce(${products.stock}, 0) <= 0`);
  if (stock === "low") return and(eq(products.trackStock, true), sql`${products.stock} between 1 and ${LOW_STOCK_MAX}`);
  if (stock === "variants_out") return and(eq(products.trackStock, true), sql`coalesce(${products.stock}, 0) > 0`, variantsOutSql);
  return undefined;
}

const noImageSql = sql`coalesce(jsonb_array_length(${products.images}), 0) = 0`;
/** منتج له صورة على مضيف خارجي (لا تظهر في المتجر حتى تُنقل لمساحة الرفع). نفس قاعدة isHostedImage. */
export const externalImagesSql = sql`exists (select 1 from jsonb_array_elements(${products.images}) e
  where not ((e->>'url') ~* '^(https://(utfs\\.io|[a-z0-9-]+\\.ufs\\.sh)/|data:|blob:|/)'))`;
export const noDescriptionSql = sql`coalesce(length(trim(${products.description})), 0) = 0`;

function needCond(need: ProductsQuery["need"]): SQL | undefined {
  if (need === "image") return noImageSql;
  if (need === "cost") return isNull(products.costPiasters);
  if (need === "description") return noDescriptionSql;
  return undefined;
}

function searchCond(q: string): SQL | undefined {
  if (!q) return undefined;
  const nq = normalizeQuery(q);
  return or(
    nq ? sql`${products.searchText} ILIKE ${`%${likeSafe(nq)}%`}` : undefined,
    ilike(products.name, `%${likeSafe(q)}%`),
    ilike(products.sku, `%${likeSafe(q)}%`)
  );
}

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  pricePiasters: number;
  compareAtPiasters: number | null;
  costPiasters: number | null;
  stock: number | null;
  trackStock: boolean;
  status: string;
  category: string | null;
  variants: number;
  variantsOut: number;
  orderCount: number;
  hasDescription: boolean;
};

export async function listProducts(storeId: string, query: ProductsQuery) {
  const db = await getTenantDb(storeId);
  const alive = and(eq(products.storeId, storeId), isNull(products.deletedAt));
  const scoped = and(alive, query.category ? eq(products.categoryId, query.category) : undefined, searchCond(query.q));
  const where = and(scoped, query.status === "all" ? undefined : eq(products.status, query.status), stockCond(query.stock), needCond(query.need));

  const order =
    query.sort === "best"
      ? [desc(products.orderCount), desc(products.createdAt)]
      : query.sort === "price_asc"
        ? [asc(products.pricePiasters)]
        : query.sort === "price_desc"
          ? [desc(products.pricePiasters)]
          : query.sort === "stock"
            ? [sql`${products.trackStock} desc`, sql`coalesce(${products.stock}, 0) asc`]
            : [desc(products.createdAt), desc(products.id)];

  const [rows, [counts], cats, [matched]] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        images: products.images,
        pricePiasters: products.pricePiasters,
        compareAtPiasters: products.compareAtPiasters,
        costPiasters: products.costPiasters,
        stock: products.stock,
        trackStock: products.trackStock,
        status: products.status,
        category: categories.name,
        orderCount: products.orderCount,
        hasDescription: sql<boolean>`not (${noDescriptionSql})`,
        // products.id صراحة: لا نعتمد على أن الـ join يجعل Drizzle يكتب اسم الجدول.
        variants: sql<number>`(select count(*) from product_variants v where v.product_id = products.id)`.mapWith(Number),
        variantsOut: sql<number>`(select count(*) from product_variants v where v.product_id = products.id and v.is_available = true and coalesce(v.stock, 0) <= 0)`.mapWith(Number),
      })
      .from(products)
      .leftJoin(categories, and(eq(categories.id, products.categoryId), eq(categories.storeId, storeId)))
      .where(where)
      .orderBy(...order)
      .limit(PRODUCTS_PAGE_SIZE)
      .offset((query.page - 1) * PRODUCTS_PAGE_SIZE),
    db
      .select({
        all: sql<number>`count(*)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${products.status} = 'active')`.mapWith(Number),
        draft: sql<number>`count(*) filter (where ${products.status} = 'draft')`.mapWith(Number),
        hidden: sql<number>`count(*) filter (where ${products.status} = 'hidden')`.mapWith(Number),
        out: sql<number>`count(*) filter (where ${products.trackStock} and coalesce(${products.stock}, 0) <= 0)`.mapWith(Number),
        low: sql<number>`count(*) filter (where ${products.trackStock} and ${products.stock} between 1 and ${LOW_STOCK_MAX})`.mapWith(Number),
        variantsOut: sql<number>`count(*) filter (where ${products.trackStock} and coalesce(${products.stock}, 0) > 0 and ${variantsOutSql})`.mapWith(Number),
        noDescription: sql<number>`count(*) filter (where ${noDescriptionSql})`.mapWith(Number),
        noImage: sql<number>`count(*) filter (where ${noImageSql})`.mapWith(Number),
        noCost: sql<number>`count(*) filter (where ${products.costPiasters} is null)`.mapWith(Number),
        externalImages: sql<number>`count(*) filter (where ${externalImagesSql})`.mapWith(Number),
      })
      .from(products)
      .where(scoped),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.storeId, storeId)).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(products).where(where),
  ]);

  const c = counts ?? { all: 0, active: 0, draft: 0, hidden: 0, out: 0, low: 0, variantsOut: 0, noDescription: 0, noImage: 0, noCost: 0, externalImages: 0 };
  const total = matched?.n ?? 0;

  return {
    rows: rows.map(
      (r): ProductRow => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        image: r.images?.[0]?.url ?? null,
        pricePiasters: r.pricePiasters,
        compareAtPiasters: r.compareAtPiasters,
        costPiasters: r.costPiasters,
        stock: r.stock,
        trackStock: r.trackStock,
        status: r.status,
        category: r.category,
        variants: r.variants,
        variantsOut: r.variantsOut,
        orderCount: r.orderCount,
        hasDescription: r.hasDescription,
      })
    ),
    counts: c,
    categories: cats,
    total,
    pages: Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE)),
  };
}
