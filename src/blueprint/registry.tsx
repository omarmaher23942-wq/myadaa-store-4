import * as B from "@/components/blocks";
import type { Section, StoreBlueprint } from "./schema";
import { groundedItems, type StoreFact } from "./facts";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products, categories as categoriesTable } from "@/db/schema/catalog";

export * from "./registry-meta";

const Block = B as any;

export type SectionCtx = {
  storeId: string;
  channels: StoreBlueprint["channels"];
  facts: StoreFact[];
  copy: StoreBlueprint["copy"];
};

// ─── Product fetching by source ────────────────────────────────────────────
type ProductSource =
  | { type: "featured" }
  | { type: "newest" }
  | { type: "best_sellers" }
  | { type: "on_sale" }
  | { type: "category"; slug: string }
  | { type: "manual"; slugs: string[] }
  | { type: "tag"; tag: string };

async function fetchProductsForSource(
  storeId: string,
  source: ProductSource | undefined,
  limit: number
): Promise<any[]> {
  const db = await getTenantDb(storeId);
  const base = and(
    eq(products.storeId, storeId),
    eq(products.status, "active"),
    isNull(products.deletedAt)
  );

  let q = db.select().from(products).$dynamic();

  switch (source?.type) {
    case "featured":
      q = q.where(and(base, eq(products.isFeatured, true))).orderBy(asc(products.sortOrder));
      break;
    case "best_sellers":
      q = q.where(base).orderBy(desc(products.orderCount));
      break;
    case "newest":
      q = q.where(base).orderBy(desc(products.createdAt));
      break;
    case "on_sale":
      q = q
        .where(and(base, sql`${products.compareAtPiasters} > ${products.pricePiasters}`))
        .orderBy(asc(products.sortOrder));
      break;
    case "category": {
      const [cat] = await db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(
          and(
            eq(categoriesTable.storeId, storeId),
            eq(categoriesTable.slug, source.slug)
          )
        )
        .limit(1);
      if (!cat) return [];
      q = q.where(and(base, eq(products.categoryId, cat.id)));
      break;
    }
    case "manual": {
      const slugs = Array.isArray(source.slugs) ? source.slugs : [];
      if (slugs.length === 0) return [];
      q = q.where(and(base, inArray(products.slug, slugs)));
      break;
    }
    case "tag": {
      q = q.where(and(base, sql`${products.tags} @> ${JSON.stringify([source.tag])}::jsonb`));
      break;
    }
    default:
      q = q.where(base).orderBy(asc(products.sortOrder));
  }

  return q.limit(Math.max(1, Math.min(limit, 24)));
}

// ─── Categories fetching ───────────────────────────────────────────────────
async function fetchCategoriesForSection(
  storeId: string,
  slugs: string[] | undefined
): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    productCount: number;
    firstProductImage: string | null;
  }>
> {
  const db = await getTenantDb(storeId);
  const base = and(
    eq(categoriesTable.storeId, storeId),
    eq(categoriesTable.isVisible, true)
  );

  const rows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      sortOrder: categoriesTable.sortOrder,
    })
    .from(categoriesTable)
    .where(
      Array.isArray(slugs) && slugs.length > 0
        ? and(base, inArray(categoriesTable.slug, slugs))
        : base
    )
    .orderBy(asc(categoriesTable.sortOrder))
    .limit(12);

  if (rows.length === 0) return [];

  // جلب صورة أول منتج لكل قسم + عدده.
  const enriched = await Promise.all(
    rows.map(async (c) => {
      const [first] = await db
        .select({ images: products.images })
        .from(products)
        .where(
          and(
            eq(products.storeId, storeId),
            eq(products.categoryId, c.id),
            eq(products.status, "active"),
            isNull(products.deletedAt)
          )
        )
        .orderBy(asc(products.sortOrder))
        .limit(1);

      const [countRow] = await db
        .select({ c: sql<number>`count(*)`.mapWith(Number) })
        .from(products)
        .where(
          and(
            eq(products.storeId, storeId),
            eq(products.categoryId, c.id),
            eq(products.status, "active"),
            isNull(products.deletedAt)
          )
        );

      const imgs = Array.isArray(first?.images) ? first!.images : [];
      const firstUrl =
        imgs.length > 0 && imgs[0] && typeof imgs[0] === "object" && "url" in imgs[0]
          ? String((imgs[0] as { url: unknown }).url || "")
          : null;

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: countRow?.c ?? 0,
        firstProductImage: firstUrl,
      };
    })
  );

  return enriched;
}

// ─── Main async dispatcher ─────────────────────────────────────────────────
export async function renderSection(
  s: Section,
  ctx: SectionCtx
): Promise<React.ReactNode> {
  if (!s.enabled) return null;

  switch (s.type) {
    case "hero": {
      let spotlight = null;
      if (s.variant === "product_spotlight" && s.spotlightProductSlug) {
        const [p] = await fetchProductsForSource(ctx.storeId, { type: "manual", slugs: [s.spotlightProductSlug] }, 1);
        if (p) spotlight = { slug: p.slug, name: p.name, pricePiasters: p.pricePiasters, compareAtPiasters: p.compareAtPiasters, image: (p.images as { url: string }[])?.[0]?.url };
      }
      return <Block.Hero key={s.id} s={s} spotlight={spotlight} />;
    }

    case "announcement": {
      // رسائل تدّعي سياسة لم تعد صحيحة تُحذف عند العرض.
      const messages = groundedItems(s.messages.map((m) => ({ ...m, title: m.text, text: undefined })), ctx.facts).map((m) => ({ ...m, text: m.title }));
      if (!messages.length) return null;
      return <Block.Announcement key={s.id} s={{ ...s, messages }} />;
    }

    case "categories": {
      const cats = (await fetchCategoriesForSection(ctx.storeId, (s as { categorySlugs?: string[] }).categorySlugs)).filter((c) => c.productCount > 0);
      // قسم واحد لا يحتاج شاشة اختيار أقسام.
      if (cats.length < 2) return null;
      return <Block.Categories key={s.id} s={s} categories={cats} />;
    }

    case "product_grid": {
      const source = (s as { source?: ProductSource }).source;
      const limit = (s as { limit?: number }).limit ?? 8;
      let prods = await fetchProductsForSource(ctx.storeId, source, limit);
      // مصدر فارغ (لا منتجات مميزة مثلاً): نعرض الأحدث بدل قسم فارغ.
      if (!prods.length && source?.type !== "manual") prods = await fetchProductsForSource(ctx.storeId, { type: "newest" }, limit);
      if (!prods.length) return null;
      return <Block.ProductGrid key={s.id} s={s} products={prods} />;
    }

    case "promo_banner":
      return <Block.PromoBanner key={s.id} s={s} />;

    case "countdown_offer":
      return <Block.CountdownOffer key={s.id} s={s} />;

    case "trust_badges": {
      const items = groundedItems(s.items, ctx.facts).slice(0, 4);
      if (items.length < 2) return null;
      return <Block.TrustBadges key={s.id} s={{ ...s, items }} />;
    }

    case "brand_story":
      return <Block.BrandStory key={s.id} s={s} />;

    case "testimonials":
      return <Block.Testimonials key={s.id} s={s} ctx={ctx} />;

    case "faq": {
      // سؤال يجيب بسياسة لم تعد صحيحة يُحذف عند العرض.
      const items = groundedItems(s.items.map((f) => ({ ...f, title: f.q, text: f.a })), ctx.facts, "drop").map(({ q, a }) => ({ q, a }));
      if (!items.length) return null;
      return <Block.Faq key={s.id} s={{ ...s, items }} />;
    }

    case "about":
      return <Block.About key={s.id} s={s} />;

    case "bundle":
      return <Block.Bundle key={s.id} s={s} ctx={ctx} />;

    case "video":
      return <Block.Video key={s.id} s={s} />;

    case "contact":
      return <Block.Contact key={s.id} s={s} ctx={ctx} />;

    case "custom_blocks":
      return <Block.CustomBlocks key={s.id} s={s} />;

    default:
      return null;
  }
}