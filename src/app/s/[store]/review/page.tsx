import { notFound } from "next/navigation";
import { requireStore } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { orders, products } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { CustomerReviewForm } from "./CustomerReviewForm";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomerReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const { store: sub } = await params;
  const { o: orderCode } = await searchParams;

  const store = await requireStore(sub);

  let orderData = null;
  let firstProductId = null;

  if (orderCode) {
    const db = await getTenantDb(store.id);
    const [order] = await db
      .select({
        id: orders.id,
        code: orders.code,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
      })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.code, orderCode.toUpperCase())))
      .limit(1);

    if (order) {
      orderData = order;
      const [p] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.storeId, store.id))
        .limit(1);
      firstProductId = p?.id || null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans py-12 px-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-2">
          <span className="text-sm font-black text-slate-900 block">{store.name}</span>
          <h1 className="text-2xl font-black text-slate-900">رأيك يهمنا ويسعدنا جداً</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            شاركنا تجربتك وتقييمك للمنتج وسرعة التوصيل كتابةً أو بتسجيل صوتي سريع
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
          <CustomerReviewForm
            subdomain={store.subdomain}
            storeId={store.id}
            orderId={orderData?.id || null}
            orderCode={orderData?.code || null}
            customerName={orderData?.customerName || ""}
            customerPhone={orderData?.customerPhone || ""}
            defaultProductId={firstProductId}
          />
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="size-4 text-emerald-600" />
          <span>تقييم آمن وموثق لمتجر {store.name}</span>
        </div>
      </div>
    </div>
  );
}