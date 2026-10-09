// nav.ts — خريطة صفحات لوحة التاجر: مصدر واحد للقائمة الجانبية ولوحة الأوامر (Ctrl/⌘+K).
// الصفحات الخاصة بالمنصة (PLATFORM_ONLY_NAV) تُستبعد تلقائياً في مشروع التاجر.
import {
  BarChart3,
  CreditCard,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  Package,
  Palette,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  TicketPercent,
  Truck,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { EDITION, INTEGRATIONS_NAV, PLATFORM_ONLY_NAV } from "@/lib/edition";

export type BadgeKey = "orders" | "reviews" | "products";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: BadgeKey;
  /** وصف قصير وكلمات بحث للوحة الأوامر. */
  hint: string;
  keywords?: string[];
};

export type NavSection = { title: string; items: NavItem[] };

const ALL: NavSection[] = [
  {
    title: "الرئيسية",
    items: [
      { label: "نظرة عامة", href: "/dashboard", icon: LayoutDashboard, exact: true, hint: "ملخص آخر 30 يوماً", keywords: ["home", "الرئيسية", "ملخص"] },
      { label: "متجري", href: "/dashboard/store", icon: Store, hint: "رابط متجرك وحالته ورمز QR", keywords: ["store", "رابط", "qr"] },
      { label: "التحليلات", href: "/dashboard/analytics", icon: BarChart3, hint: "المبيعات والزيارات ومراحل الشراء", keywords: ["analytics", "احصائيات", "تقارير"] },
    ],
  },
  {
    title: "المبيعات",
    items: [
      { label: "الطلبات", href: "/dashboard/orders", icon: ShoppingCart, badgeKey: "orders", hint: "تأكيد الطلبات وتجهيزها وشحنها", keywords: ["orders", "اوردر", "اوردرات"] },
      { label: "العملاء", href: "/dashboard/customers", icon: Users, hint: "من اشترى منك وكم أنفق", keywords: ["customers", "زباين", "زبائن"] },
      { label: "التقييمات", href: "/dashboard/reviews", icon: Star, badgeKey: "reviews", hint: "اعتماد آراء العملاء", keywords: ["reviews", "مراجعات", "اراء"] },
    ],
  },
  {
    title: "الكتالوج",
    items: [
      { label: "المنتجات", href: "/dashboard/products", icon: Package, badgeKey: "products", hint: "المنتجات والأسعار والمخزون", keywords: ["products", "مخزون", "اصناف"] },
      { label: "الأقسام", href: "/dashboard/categories", icon: FolderTree, hint: "أقسام المتجر وترتيبها", keywords: ["categories", "فئات", "تصنيفات"] },
      { label: "أكواد الخصم", href: "/dashboard/discounts", icon: TicketPercent, hint: "كوبونات وعروض", keywords: ["discounts", "كوبون", "خصم", "عروض"] },
      { label: "الشحن", href: "/dashboard/shipping", icon: Truck, hint: "أسعار الشحن لكل محافظة", keywords: ["shipping", "توصيل", "محافظات"] },
      { label: "السياسات والضمان", href: "/dashboard/policies", icon: ShieldCheck, hint: "الاستبدال والاسترجاع والمعاينة", keywords: ["policies", "استرجاع", "استبدال", "ضمان"] },
    ],
  },
  {
    title: "التصميم",
    items: [
      { label: "تصميم المتجر", href: "/dashboard/design", icon: Wand2, hint: "إعادة التصميم بالذكاء الاصطناعي والحركة", keywords: ["design", "ثيم", "الوان"] },
      { label: "محرر المحتوى", href: "/dashboard/content", icon: Palette, hint: "نصوص وصور وأقسام الصفحة الرئيسية", keywords: ["content", "محتوى", "الصفحه الرئيسيه"] },
    ],
  },
  {
    title: "الحساب",
    items: [
      { label: "الإعدادات", href: "/dashboard/settings", icon: Settings, hint: "بيانات المتجر والتواصل والدفع", keywords: ["settings", "اعدادات"] },
      { label: INTEGRATIONS_NAV.label, href: INTEGRATIONS_NAV.href, icon: KeyRound, hint: EDITION === "store" ? "مفاتيح الخدمات المربوطة بمتجرك" : "انقل متجرك لحساباتك بعد الدفع", keywords: ["integrations", "مفاتيح", "github", "vercel"] },
      { label: "الدفع والتفعيل", href: "/dashboard/billing", icon: CreditCard, hint: "ادفع مرة واحدة وفعّل متجرك", keywords: ["billing", "فوترة", "اشتراك", "دفع"] },
    ],
  },
];

export const NAV_SECTIONS: NavSection[] = ALL.map((s) => ({
  ...s,
  items: s.items.filter((i) => EDITION === "platform" || !(PLATFORM_ONLY_NAV as readonly string[]).includes(i.href)),
})).filter((s) => s.items.length > 0);

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** الشريط السفلي على الموبايل: أكثر 4 صفحات استخداماً، والباقي في «المزيد». */
export const MOBILE_NAV_HREFS = ["/dashboard", "/dashboard/orders", "/dashboard/products", "/dashboard/analytics"] as const;

export function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  const path = href.split("?")[0]!;
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}
