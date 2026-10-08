import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { categories } from "@/db/schema";
import { CategoriesManager } from "@/components/dashboard/CategoriesManager";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";
export const metadata = { title: "الأقسام" };

export default async function CategoriesPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/categories");
  if (!session.storeId) redirect(NO_STORE_HREF);
  const db = await getTenantDb(session.storeId!);

  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.storeId, session.storeId))
    .orderBy(categories.sortOrder);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-edge/10 pb-4">
        <h1 className="text-2xl font-black text-ink">الأقسام</h1>
        <p className="mt-1 text-xs text-ink-3">
          نظّم منتجاتك في أقسام واضحة تسهّل التسوق
        </p>
      </header>

      <CategoriesManager
        rows={rows.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? "",
          imageUrl: c.imageUrl ?? "",
          isVisible: c.isVisible,
        }))}
      />
    </div>
  );
}