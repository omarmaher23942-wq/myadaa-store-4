import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { productStatusEnum } from "./enums";
import { stores } from "./stores";
import type { IntakeOptionDef } from "./ai";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_store_slug_uq").on(t.storeId, t.slug), index("categories_store_idx").on(t.storeId)]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    pricePiasters: integer("price_piasters").notNull(),
    compareAtPiasters: integer("compare_at_piasters"),
    costPiasters: integer("cost_piasters"),
    sku: text("sku"),
    stock: integer("stock"),
    trackStock: boolean("track_stock").notNull().default(true),
    images: jsonb("images").$type<{ url: string; alt?: string; key?: string }[]>().notNull().default([]),
    
    // 3D & AR Fields
    model3dUrl: text("model3d_url"),
    modelUsdzUrl: text("model_usdz_url"),
    isArEnabled: boolean("is_ar_enabled").notNull().default(false),
    
    attributes: jsonb("attributes").$type<{ label: string; value: string }[]>().notNull().default([]),
    optionNames: jsonb("option_names").$type<string[]>().notNull().default([]),
    optionMeta: jsonb("option_meta").$type<IntakeOptionDef[]>().notNull().default([]),
    aiDraft: boolean("ai_draft").notNull().default(false),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    badges: jsonb("badges").$type<string[]>().notNull().default([]),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    status: productStatusEnum("status").notNull().default("active"),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    searchText: text("search_text"),
    viewCount: integer("view_count").notNull().default(0),
    orderCount: integer("order_count").notNull().default(0),
    ratingSum: integer("rating_sum").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_store_slug_uq").on(t.storeId, t.slug),
    index("products_store_status_idx").on(t.storeId, t.status),
    index("products_store_category_idx").on(t.storeId, t.categoryId),
    // يتطلب امتداد pg_trgm (يُنشأ في أول خط الأساس).
    index("products_search_trgm_idx").using("gin", sql`${t.searchText} gin_trgm_ops`),
    check("products_stock_nonnegative", sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
  ]
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    optionValues: jsonb("option_values").$type<string[]>().notNull(),
    pricePiasters: integer("price_piasters"),
    compareAtPiasters: integer("compare_at_piasters"),
    stock: integer("stock"),
    sku: text("sku"),
    imageUrl: text("image_url"),
    imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    index("variants_store_idx").on(t.storeId),
    check("variants_stock_nonnegative", sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
  ]
);