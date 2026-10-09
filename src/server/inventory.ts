// inventory.ts — حركة المخزون الموحّدة للطلبات: الخصم عند الطلب، والإرجاع عند الإلغاء أو الارتجاع، والخصم من جديد
// عند إعادة فتح طلب ملغي. القاعدة الثابتة: مخزون المنتج ذي التركيبات (مقاس/لون) = مجموع مخزون تركيباته،
// فكل تغيير في تركيبة يعيد حساب مجموع المنتج داخل نفس المعاملة (لا يبقى رقم المنتج قديماً فيخفي نفاد المخزون).
// التركيبة التي أخفاها التاجر («غير متاحة») لا تدخل المجموع لأن العميل لا يستطيع شراءها (نفس قاعدة حفظ المنتج).
import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { getTenantDb } from "@/db/tenant";
import { products, productVariants } from "@/db/schema";

type DB = Awaited<ReturnType<typeof getTenantDb>>;
type Line = { productId: string | null; variantId: string | null; quantity: number };

/** يعيد مخزون المنتجات ذات التركيبات إلى مجموع مخزون تركيباتها (يُضاف آخر الـ batch بعد تعديل التركيبات). */
export function syncVariantTotals(db: DB, storeId: string, productIds: string[]) {
  return db
    .update(products)
    .set({
      stock: sql`(select coalesce(sum(greatest(coalesce(v.stock, 0), 0)), 0) from ${productVariants} v where v.product_id = ${products.id} and v.is_available = true)`,
    })
    .where(
      and(
        eq(products.storeId, storeId),
        inArray(products.id, productIds),
        eq(products.trackStock, true),
        sql`exists (select 1 from ${productVariants} v where v.product_id = ${products.id})`
      )
    );
}

/**
 * استعلامات حركة مخزون أصناف طلب: direction = +1 يعيد الكمية للمخزون (إلغاء/ارتجاع)، و-1 يخصمها (إعادة فتح الطلب).
 * المخزون غير المتتبَّع (null) لا يُلمس، وعدد مرات الطلب على المنتج يتحرك بالاتجاه المعاكس.
 * الخصم قد يصطدم بقيد «المخزون لا يقل عن صفر» فتفشل المعاملة كلها بلا أثر جزئي.
 */
export function stockMovement(db: DB, storeId: string, items: Line[], direction: 1 | -1) {
  const lines = items.filter((i): i is Line & { productId: string } => Boolean(i.productId) && i.quantity > 0);
  const queries = lines.flatMap((i) => {
    const qty = i.quantity * direction;
    const product = db
      .update(products)
      .set({
        orderCount: sql`greatest(${products.orderCount} - ${qty}, 0)`,
        ...(i.variantId ? {} : { stock: sql`case when ${products.stock} is null then null else ${products.stock} + ${qty} end` }),
      })
      .where(and(eq(products.id, i.productId), eq(products.storeId, storeId)));
    if (!i.variantId) return [product];
    const variant = db
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${qty}` })
      .where(and(eq(productVariants.id, i.variantId), eq(productVariants.storeId, storeId), isNotNull(productVariants.stock)));
    return [variant, product];
  });
  const withVariants = [...new Set(lines.filter((l) => l.variantId).map((l) => l.productId))];
  return withVariants.length ? [...queries, syncVariantTotals(db, storeId, withVariants)] : queries;
}
