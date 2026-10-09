// dashboard/categories/page.tsx — أقسام المتجر بترتيبها وعدد منتجات كل قسم.
import { redirect } from "next/navigation";
import { getMerchantSession } from "@/server/auth";
import { listCategories } from "@/server/repos/categories-list";
import { CategoriesManager } from "@/components/dashboard/categories/CategoriesManager";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";
export const metadata = { title: "الأقسام" };

export default async function CategoriesPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/categories");
  if (!session.storeId || !session.store) redirect(NO_STORE_HREF);
  const rows = await listCategories(session.storeId);
  return (
    <div className="mx-auto max-w-4xl">
      <CategoriesManager rows={rows} subdomain={session.store.subdomain} />
    </div>
  );
}
