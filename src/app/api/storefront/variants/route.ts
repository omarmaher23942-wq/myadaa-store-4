// /api/storefront/variants?product=<id> — مقاسات وألوان منتج لنافذة الإضافة السريعة، لمتجر النطاق الحالي فقط.
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products, productVariants } from "@/db/schema";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const productId = new URL(req.url).searchParams.get("product") ?? "";
  const store = sub ? await getStoreBySubdomain(sub) : null;
  if (!store || !isStorePubliclyVisible(store) || !UUID.test(productId)) return NextResponse.json({ variants: [] });

  const db = await getTenantDb(store.id);
  // شرط المتجر على المنتج نفسه: لا يمكن قراءة متغيرات منتج متجر آخر بمعرّفه.
  const rows = await db
    .select({
      id: productVariants.id,
      optionValues: productVariants.optionValues,
      pricePiasters: productVariants.pricePiasters,
      stock: productVariants.stock,
      isAvailable: productVariants.isAvailable,
      imageUrl: productVariants.imageUrl,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.productId, productId), eq(products.storeId, store.id), isNull(products.deletedAt)))
    .limit(200);
  return NextResponse.json({ variants: rows }, { headers: { "Cache-Control": "public, max-age=30" } });
}
