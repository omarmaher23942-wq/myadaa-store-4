// /review — «قيّم مشترياتك»: تقييم منتجات طلب مُسلَّم. يُفتح بالرابط الموقّع في بريد «وصل طلبك» (?o=رقم&t=رمز) أو من نفس
// الجهاز الذي طلب منه (من «طلباتي»). رقم الطلب وحده لا يكفي: الأرقام قصيرة وتُخمَّن، والصفحة تعرض منتجات الطلب.
import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { Lock, PackageCheck, Star } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders, products, reviews } from "@/db/schema";
import { hasOrderAccess, validReviewToken } from "@/lib/order-access";
import { OrderReviewForm, type ReviewableItem } from "@/components/storefront/OrderReviewForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "قيّم مشترياتك", robots: { index: false, follow: false } };

const SW = 1.75;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** الاسم الظاهر مع التقييم: الاسم الأول وأول حرف من الثاني («سارة أ.»)، ويعدّله العميل. */
function publicName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]!.charAt(0)}.` : (parts[0] ?? "");
}

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { store: sub } = await params;
  const sp = await searchParams;
  const store = await requireStore(sub);
  const code = one(sp.o).trim().toUpperCase().slice(0, 20);
  const token = one(sp.t).slice(0, 64);

  const db = await getTenantDb(store.id);
  const [order] = code
    ? await db
        .select({ id: orders.id, code: orders.code, status: orders.status, visitorId: orders.visitorId, customerName: orders.customerName })
        .from(orders)
        .where(and(eq(orders.storeId, store.id), eq(orders.code, code)))
        .limit(1)
    : [];
  const allowed = Boolean(order && (validReviewToken(store.id, order.id, token) || (await hasOrderAccess(store.id, order.code, order.visitorId))));

  if (!order || !allowed) {
    return (
      <Shell>
        <Lock strokeWidth={SW} className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-2xl">افتح التقييم من رابط طلبك</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">لحماية بيانات طلبك، يُفتح التقييم من رسالة «وصل طلبك» على بريدك، أو من «طلباتي» على نفس الجهاز الذي طلبت منه.</p>
        <Link href="/track" className="btn-brand mt-6">
          طلباتي
        </Link>
      </Shell>
    );
  }

  if (order.status !== "delivered") {
    return (
      <Shell>
        <PackageCheck strokeWidth={SW} className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-2xl">قيّم بعد ما يوصلك طلبك</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">التقييم متاح بعد استلام الطلب {order.code}، لتقيّم المنتج بعد ما تجربه.</p>
        <Link href={`/track?code=${encodeURIComponent(order.code)}`} className="btn-brand mt-6">
          تابع طلبك
        </Link>
      </Shell>
    );
  }

  const lines = await db
    .select({ productId: orderItems.productId, name: orderItems.name, variantLabel: orderItems.variantLabel, imageUrl: orderItems.imageUrl })
    .from(orderItems)
    .where(and(eq(orderItems.storeId, store.id), eq(orderItems.orderId, order.id)));
  const productIds = [...new Set(lines.map((l) => l.productId).filter((x): x is string => Boolean(x)))];
  const [live, done] = productIds.length
    ? await Promise.all([
        db.select({ id: products.id, slug: products.slug, images: products.images }).from(products).where(and(eq(products.storeId, store.id), inArray(products.id, productIds))),
        db.select({ productId: reviews.productId, rating: reviews.rating }).from(reviews).where(and(eq(reviews.storeId, store.id), eq(reviews.orderId, order.id))),
      ])
    : [[], []];
  const liveById = new Map(live.map((p) => [p.id, p]));
  const doneById = new Map(done.map((r) => [r.productId, r.rating]));
  const items: ReviewableItem[] = productIds
    .filter((id) => liveById.has(id))
    .map((id) => {
      const line = lines.find((l) => l.productId === id)!;
      const p = liveById.get(id)!;
      return { productId: id, name: line.name, variantLabel: line.variantLabel, image: line.imageUrl ?? p.images[0]?.url ?? null, slug: p.slug, reviewed: doneById.get(id) ?? null };
    });

  return (
    <div className="container-x max-w-2xl py-10">
      <h1 className="text-3xl">قيّم مشترياتك</h1>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        <Star strokeWidth={SW} className="me-1 inline size-4 align-[-3px]" aria-hidden="true" />
        طلب{" "}
        <b dir="ltr" className="inline-block">
          {order.code}
        </b>{" "}
        · رأيك يساعد غيرك ويظهر بعد مراجعة المتجر.
      </p>
      {items.length ? (
        <OrderReviewForm subdomain={store.subdomain} code={order.code} token={token || null} defaultName={publicName(order.customerName)} items={items} />
      ) : (
        <p className="surface mt-6 p-6 text-sm text-muted-foreground">منتجات هذا الطلب لم تعد معروضة في المتجر.</p>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="container-x max-w-md py-16 text-center">{children}</div>;
}
