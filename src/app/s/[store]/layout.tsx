import type { Metadata, Viewport } from "next";
import { allPolicyPages } from "@/blueprint/policy-pages";
import { headers } from "next/headers";
import { requireStore, getBlueprintOrNull, getStoreBySubdomain } from "@/lib/tenant";
import { storeMetadata, storeViewport } from "@/lib/storefront-seo";
import { themeStyleSheet } from "@/blueprint/theme";
import { designStyleSheet } from "@/blueprint/design";
import { getStoreFacts } from "@/server/repos/facts";
import { truthfulBlueprint } from "@/blueprint/facts";
import { DepthController } from "@/components/storefront/DepthController";
import { StoreProvider } from "@/components/storefront/StoreProvider";
import { EditorProvider } from "@/editor/EditorProvider";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { PromoFromLink } from "@/components/storefront/PromoFromLink";
import { ConversionWidgets } from "@/components/storefront/ConversionWidgets";
import { Analytics } from "@/components/storefront/Analytics";
import { FrozenGate } from "@/components/storefront/FrozenGate";
import { OwnerFirstImpressionBanner } from "@/components/storefront/OwnerFirstImpressionBanner";
import { listVisibleCategories } from "@/server/repos/catalog";
import { getCustomerSession } from "@/server/auth";
import { notFound } from "next/navigation";

type Props = {
  children: React.ReactNode;
  params: Promise<{ store: string }>;
};

/** هوية المتجر نفسه في العنوان والأيقونة و Open Graph — لا أي أثر لهوية المنصة. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string }>;
}): Promise<Metadata> {
  const { store: sub } = await params;
  const store = await getStoreBySubdomain(sub);
  if (!store) return { robots: { index: false, follow: false } };
  const bp = await getBlueprintOrNull(store.id);
  return storeMetadata(store, bp ? truthfulBlueprint(bp, await getStoreFacts(store.id, bp)) : null);
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ store: string }>;
}): Promise<Viewport> {
  const { store: sub } = await params;
  const store = await getStoreBySubdomain(sub);
  return storeViewport(store ? await getBlueprintOrNull(store.id) : null);
}

/**
 * حالات المتجر التي تمنع التسوق العام وتعرض FrozenGate بدلاً من المحتوى.
 * هذه الحالات مقصودة ومصممة لمصلحة التاجر — نعرض شاشة أنيقة بدل 404 مخفي.
 */
const GATED_STATUSES: ReadonlySet<string> = new Set([
  "frozen",
  "intake",
  "building",
  "pending_review",
]);

export default async function StoreLayout({ children, params }: Props) {
  const { store: sub } = await params;
  const store = await requireStore(sub);
  const h = await headers();
  const pathname = (h.get("x-pathname") || "").toLowerCase();

  // مسارات إدارية لها layouts خاصة (لا Header/Footer عليها).
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");
  // صفحة التقييم صارت بهوية المتجر (رأسه وتذييله) كأي صفحة فيه.
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
        {children}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // بوابة الحالات: نتحقق قبل تحميل الـ blueprint.
  // هذا يمنع 404 لو المتجر قيد البناء (blueprint قد يكون غير موجود).
  // ═════════════════════════════════════════════════════════════════════
  if (GATED_STATUSES.has(store.status)) {
    return (
      <div className="min-h-dvh bg-[#07091a]">
        <FrozenGate status={store.status} />
      </div>
    );
  }

  // من هنا، status إما review | trial | active
  const [rawBp, categories, customerSession] = await Promise.all([
    getBlueprintOrNull(store.id),
    listVisibleCategories(store.id),
    getCustomerSession(store.id),
  ]);

  // دفاع أخير: لو الـ blueprint غير موجود لأي سبب (بيانات تالفة).
  if (!rawBp) {
    notFound();
  }

  // النصوص الحرة (الوصف وشعار الفوتر) تُعرض بعد حذف أي ادعاء لم يعد صحيحاً في سياسة المتجر الآن.
  const facts = await getStoreFacts(store.id, rawBp);
  const bp = truthfulBlueprint(rawBp, facts);

  const customer = customerSession
    ? {
        id: customerSession.customer.id,
        name: customerSession.customer.name,
        email: customerSession.customer.email,
        avatarUrl: customerSession.customer.avatarUrl,
      }
    : null;

  return (
    <StoreProvider
      value={{
        storeId: store.id,
        subdomain: store.subdomain,
        brand: bp.brand,
        conversion: bp.conversion,
        channels: bp.channels,
        payments: bp.payments,
        shipping: bp.shipping,
        acceptingOrders: store.acceptingOrders,
        vacationMessage: store.vacationMessage,
        customer,
        copy: bp.copy,
        design: bp.design,
        cardStyle: bp.theme.productCardStyle,
        facts,
      }}
    >
      <EditorProvider>
        <style
          dangerouslySetInnerHTML={{
            // الثيم (ألوان وخطوط) ثم نظام التصميم الخاص بالمتجر ثم جلده المنقّى.
            __html: themeStyleSheet(bp.theme, ".storefront") + designStyleSheet(bp, ".storefront"),
          }}
        />

        <OwnerFirstImpressionBanner
          subdomain={store.subdomain}
          storeName={store.name}
        />

        <div
          className="storefront flex min-h-dvh flex-col"
          data-button-style={bp.theme.buttonStyle}
          data-card-style={bp.theme.productCardStyle}
          data-theme-mode={bp.theme.mode}
          data-motion={bp.design.motion.level}
          data-depth={bp.design.motion.depth ? "on" : "off"}
        >
          <div className="s-progress" aria-hidden="true" />
          {bp.design.motion.depth ? <DepthController /> : null}
          {!store.acceptingOrders ? (
            // وضع الإجازة: يعرفه الزائر من أول صفحة، لا عند الدفع بعد أن يملأ سلته.
            <p role="status" className="s-announce px-4 py-2 text-center text-[13px] font-bold">
              {store.vacationMessage || "المتجر لا يستقبل طلبات الآن، وسنعود قريباً"}
            </p>
          ) : null}
          <Header
            header={bp.header}
            brand={bp.brand}
            categories={categories}
            channels={bp.channels}
          />

          <main className="flex-1">{children}</main>

          <Footer
            footer={bp.footer}
            brand={bp.brand}
            channels={bp.channels}
            pages={allPolicyPages(bp)}
            payments={bp.payments}
            categories={categories}
            facts={facts}
          />

          <CartDrawer />
          <PromoFromLink subdomain={store.subdomain} />
          <ConversionWidgets />
          <Analytics storeId={store.id} />
        </div>
      </EditorProvider>
    </StoreProvider>
  );
}