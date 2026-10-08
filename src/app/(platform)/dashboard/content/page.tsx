// dashboard/content/page.tsx — محرر محتوى المتجر (بديل StudioEditor).
//
// المزايا:
//  - Server Component يجلب البيانات أولاً، ثم يمرّرها للـ Client.
//  - لا iframe، لا templates. تعديل مباشر على Blueprint.
//  - يفتح المعاينة في تبويب منفصل (لا split view ضيق).
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getMerchantSession } from "@/server/auth";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { categories, products, storeBlueprints } from "@/db/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { ContentEditor } from "@/components/dashboard/ContentEditor";
import { NO_STORE_HREF } from "@/lib/edition";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "محرر المحتوى",
  description: "عدّل كل نص وصورة وقسم في متجرك",
};

export default async function ContentEditorPage() {
  const session = await getMerchantSession();
  if (!session) redirect("/login?redirect=/dashboard/content");
  if (!session.store) redirect(NO_STORE_HREF);

  const store = session.store;

  const tdb = await getTenantDb(store.id);
  const [bpRow, cats, prods] = await Promise.all([
    db
      .select()
      .from(storeBlueprints)
      .where(eq(storeBlueprints.storeId, store.id))
      .limit(1)
      .then((r) => r[0] ?? null),
    tdb
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .where(eq(categories.storeId, store.id)),
    tdb
      .select({ slug: products.slug, name: products.name })
      .from(products)
      .where(eq(products.storeId, store.id))
      .limit(500),
  ]);

  const blueprint =
    bpRow?.data ??
    defaultBlueprint({
      name: store.name || "متجري",
      tagline: "متجرك الإلكتروني الاحترافي",
    });

  return (
    <div className="mx-auto max-w-7xl">
      <ContentEditor
        initial={blueprint}
        storeId={store.id}
        subdomain={store.subdomain}
        categories={cats}
        products={prods}
      />
    </div>
  );
}