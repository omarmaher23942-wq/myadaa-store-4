import { desc, eq, isNull, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { reviews, products } from "@/db/schema";
import { ReviewsManager } from "@/components/dashboard/ReviewsManager";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";
export const metadata = { title: "المراجعات" };

export default async function ReviewsPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/reviews");
  if (!session.storeId) redirect(NO_STORE_HREF);
  const db = await getTenantDb(session.storeId!);

  const rows = await db
    .select({
      id: reviews.id,
      productName: products.name,
      customerName: reviews.customerName,
      rating: reviews.rating,
      body: reviews.body,
      imageUrls: reviews.imageUrls,
      isApproved: reviews.isApproved,
      isVerified: reviews.isVerified,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(products, eq(products.id, reviews.productId))
    .where(eq(reviews.storeId, session.storeId))
    .orderBy(desc(reviews.createdAt))
    .limit(200);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">المراجعات</h1>
        <p className="mt-1 text-xs text-ink-3">
          اعتمد التقييمات لتظهر على منتجاتك في المتجر
        </p>
      </header>

      <ReviewsManager
        rows={rows.map((r) => ({
          id: r.id,
          productName: r.productName ?? "منتج محذوف",
          customerName: r.customerName,
          rating: r.rating,
          body: r.body,
          imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls : [],
          isApproved: r.isApproved,
          isVerified: r.isVerified,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}