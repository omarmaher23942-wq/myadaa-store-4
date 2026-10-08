import { EDITION } from "@/lib/edition";
// lib/insights.ts — دالة توليد التحليلات الذكية (server-safe, serializable).
//
// القاعدة الحاسمة:
// لا React components، لا functions، لا Lucide icons كقيم.
// كل ما يخرج من هنا يجب أن يكون JSON-serializable لأن الناتج يُمرَّر
// من Server Component إلى Client Component كـ props.
//
// الأيقونات مُعرَّفة كـ string identifiers (مثل "trending-up")، والـ
// client يترجمها إلى LucideIcon عبر خريطة مركزيّة.

export type InsightTone = "growth" | "warning" | "opportunity" | "info";

/**
 * معرّفات الأيقونات المسموح بها — يقابلها مكوّن Lucide في العميل.
 * أي إضافة هنا يجب أن تُقابل بإضافة في ICON_MAP داخل AIInsightsPanel.tsx.
 */
export type InsightIconName =
  | "trending-up"
  | "alert-triangle"
  | "lightbulb"
  | "sparkles"
  | "shopping-cart"
  | "eye"
  | "users"
  | "package"
  | "flame";

export type Insight = {
  id: string;
  tone: InsightTone;
  iconName?: InsightIconName;
  title: string;
  message: string;
  metric?: { value: string; delta?: number };
  action?: { label: string; href: string };
};

export type GenerateInsightsInput = {
  ordersCount: number;
  ordersDelta: number;
  revenueEgp: number;
  revenueDelta: number;
  abandonedCount: number;
  abandonedValueEgp: number;
  customersCount: number;
  customersDelta: number;
  pendingReviewsCount: number;
  lowStockCount: number;
  topViewedNotPurchased?: { name: string; productId: string; views: number } | null;
  vipSilentCount: number;
};

/**
 * توليد قائمة التحليلات من الإحصائيات.
 * دالة نقية — لا side effects، لا React، لا functions في الناتج.
 */
export function generateInsights(input: GenerateInsightsInput): Insight[] {
  const out: Insight[] = [];

  // 1. النمو في الإيرادات
  if (input.revenueDelta >= 15 && input.ordersCount >= 5) {
    out.push({
      id: "revenue-growth",
      tone: "growth",
      iconName: "trending-up",
      title: "نمو قوي في المبيعات",
      message: "استمر على نفس استراتيجية التسويق، الأرقام تتحسن.",
      metric: {
        value: `${input.revenueEgp.toLocaleString("en-EG")} ج`,
        delta: input.revenueDelta,
      },
    });
  } else if (input.revenueDelta <= -15 && input.ordersCount >= 5) {
    out.push({
      id: "revenue-drop",
      tone: "warning",
      iconName: "trending-up",
      title: "تراجع في المبيعات",
      message: "راجع مصادر الزيارات وتجربة الشراء. ربما تحتاج خصماً أو تحسين الصفحات.",
      metric: {
        value: `${input.revenueEgp.toLocaleString("en-EG")} ج`,
        delta: input.revenueDelta,
      },
    });
  }

  // 2. السلات المتروكة
  if (input.abandonedCount >= 3 && input.abandonedValueEgp > 500) {
    out.push({
      id: "abandoned-carts",
      tone: "opportunity",
      iconName: "shopping-cart",
      title: "فرصة استرداد سلات متروكة",
      message: `عندك ${input.abandonedCount} عميل سابوا سلتهم. رسالة واتساب واحدة قد تعيد ${input.abandonedValueEgp.toLocaleString("en-EG")} ج.`,
      metric: { value: `${input.abandonedValueEgp.toLocaleString("en-EG")} ج` },
      action: { label: "افتح القائمة", href: "/dashboard/orders?filter=abandoned" },
    });
  }

  // 3. منتج يُشاهد كثيراً ولا يُشترى
  if (input.topViewedNotPurchased && input.topViewedNotPurchased.views >= 50) {
    out.push({
      id: "viewed-not-purchased",
      tone: "warning",
      iconName: "eye",
      title: `${input.topViewedNotPurchased.views} مشاهدة بدون شراء`,
      message: `منتج "${input.topViewedNotPurchased.name}" يُشاهد كثيراً لكن تحويله ضعيف. راجع السعر أو الصور أو الوصف.`,
      action: {
        label: "افتح المنتج",
        href: `/dashboard/products/${input.topViewedNotPurchased.productId}`,
      },
    });
  }

  // 4. عملاء VIP صامتون
  if (input.vipSilentCount >= 2) {
    out.push({
      id: "vip-silent",
      tone: "opportunity",
      iconName: "users",
      title: `${input.vipSilentCount} عملاء VIP لم يشتروا منذ فترة`,
      message: "تواصل معهم بعرض خاص. تكلفة استرجاع عميل قديم أقل 5× من جلب عميل جديد.",
      action: { label: "افتح قائمة العملاء", href: "/dashboard/customers?segment=vip" },
    });
  }

  // 5. مراجعات بانتظار الاعتماد
  if (input.pendingReviewsCount >= 3) {
    out.push({
      id: "pending-reviews",
      tone: "info",
      iconName: "sparkles",
      title: `${input.pendingReviewsCount} تقييمات بانتظار الاعتماد`,
      message: "التقييمات المعتمدة ترفع الثقة وتزيد معدل التحويل بـ 20%.",
      action: { label: "اعتمد الآن", href: "/dashboard/settings?tab=reviews" },
    });
  }

  // 6. مخزون منخفض
  if (input.lowStockCount >= 3) {
    out.push({
      id: "low-stock",
      tone: "warning",
      iconName: "package",
      title: `${input.lowStockCount} منتجات بمخزون منخفض`,
      message: "أعد التخزين لتجنب إلغاء الطلبات وفقدان ثقة العملاء.",
      action: { label: "راجع المنتجات", href: "/dashboard/products?filter=low_stock" },
    });
  }

  // 7. نمو العملاء
  if (input.customersDelta >= 20 && input.customersCount >= 10) {
    out.push({
      id: "customers-growth",
      tone: "growth",
      iconName: "users",
      title: "نمو في قاعدة العملاء",
      message: "اعمل على تحويلهم لعملاء دائمين بعروض ولاء.",
      metric: { value: `${input.customersCount}`, delta: input.customersDelta },
    });
  }

  // 8. لا يوجد نشاط كافٍ بعد
  if (input.ordersCount < 3 && input.customersCount < 5) {
    out.push({
      id: "early-stage",
      tone: "info",
      iconName: "flame",
      title: "بدايتك قريبة",
      message: "شارك رابط متجرك على فيسبوك وواتساب. عادةً أول 10 طلبات تأتي من دائرتك القريبة.",
      action: { label: "افتح رابط المتجر", href: EDITION === "store" ? "/" : "/dashboard/store" },
    });
  }

  // ترتيب: growth → opportunity → warning → info
  const order: Record<InsightTone, number> = {
    growth: 0,
    opportunity: 1,
    warning: 2,
    info: 3,
  };
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 5);
}