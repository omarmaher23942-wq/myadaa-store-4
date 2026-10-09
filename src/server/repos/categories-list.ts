// categories-list.ts — أقسام المتجر للوحة التاجر بترتيبها، ولكل قسم: عدد منتجاته (كلها والمنشور منها) وصورة الغلاف
// كما تظهر في المتجر (صورة القسم إن رفعها التاجر، وإلا صورة أول منتج منشور فيه). استعلام واحد.
import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { categories } from "@/db/schema";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  isVisible: boolean;
  products: number;
  active: number;
  cover: string | null;
};

export async function listCategories(storeId: string): Promise<CategoryRow[]> {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      isVisible: categories.isVisible,
      // مرجع صريح «categories.id»: Drizzle يكتب ${categories.id} في حقول select من جدول واحد بلا اسم جدوله فيُقرأ كـ p.id.
      products: sql<number>`(select count(*) from products p where p.store_id = ${storeId} and p.category_id = categories.id and p.deleted_at is null)`.mapWith(Number),
      active: sql<number>`(select count(*) from products p where p.store_id = ${storeId} and p.category_id = categories.id and p.deleted_at is null and p.status = 'active')`.mapWith(Number),
      firstImage: sql<string | null>`(select p.images->0->>'url' from products p where p.store_id = ${storeId} and p.category_id = categories.id and p.deleted_at is null and p.status = 'active' and jsonb_array_length(p.images) > 0 order by p.sort_order asc, p.created_at desc limit 1)`,
    })
    .from(categories)
    .where(eq(categories.storeId, storeId))
    .orderBy(asc(categories.sortOrder), asc(categories.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? "",
    imageUrl: r.imageUrl,
    isVisible: r.isVisible,
    products: r.products,
    active: r.active,
    cover: r.imageUrl || r.firstImage,
  }));
}
