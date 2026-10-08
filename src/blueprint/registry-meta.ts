import type { Section } from "./schema";

/**
 * بيانات وصفية لكل نوع قسم.
 * تُستخدم في الداشبورد لإضافة أقسام وعرض أسمائها وأيقوناتها.
 * كل قسم جديد في `sectionSchema` MUST يُضاف هنا، وإلا يفشل التحقق من الأنواع.
 */
export const SECTION_META: Record<
  Section["type"],
  { label: string; icon: string; description: string }
> = {
  hero: {
    label: "الواجهة الرئيسية",
    icon: "image",
    description: "أول ما يراه الزائر: عنوان قوي وصورة وزر",
  },
  announcement: {
    label: "شريط إعلان",
    icon: "megaphone",
    description: "رسائل قصيرة متحركة أعلى الصفحة",
  },
  categories: {
    label: "الأقسام",
    icon: "layout-grid",
    description: "تصنيفات المتجر بأشكال متعددة",
  },
  product_grid: {
    label: "منتجات",
    icon: "shopping-bag",
    description: "شبكة أو شريط منتجات من مصدر محدد",
  },
  promo_banner: {
    label: "بانر عرض",
    icon: "badge-percent",
    description: "عرض أو كود خصم بتصميم لافت",
  },
  countdown_offer: {
    label: "عرض بعدّاد",
    icon: "timer",
    description: "عرض محدود بوقت حقيقي",
  },
  trust_badges: {
    label: "شارات الثقة",
    icon: "shield-check",
    description: "لماذا يشتري منك الزائر",
  },
  testimonials: {
    label: "آراء العملاء",
    icon: "message-square-quote",
    description: "تقييمات وسكرين شوتات",
  },
  faq: {
    label: "أسئلة شائعة",
    icon: "circle-help",
    description: "إجابات تقلل التردد",
  },
  about: {
    label: "من نحن",
    icon: "users",
    description: "قصة المتجر",
  },
  instagram_gallery: {
    label: "معرض إنستجرام",
    icon: "instagram",
    description: "صور من حسابك",
  },
  rich_text: {
    label: "نص حر",
    icon: "text",
    description: "محتوى منسق",
  },
  bundle: {
    label: "طقم بخصم",
    icon: "package",
    description: "منتجات معًا بسعر أفضل",
  },
  stats: {
    label: "أرقام",
    icon: "bar-chart-3",
    description: "إحصائيات تبني الثقة",
  },
  video: {
    label: "فيديو",
    icon: "play",
    description: "فيديو للمنتج أو المتجر",
  },
  contact: {
    label: "تواصل",
    icon: "phone",
    description: "قنوات التواصل والعنوان",
  },
  custom_blocks: {
    label: "قسم مخصص",
    icon: "blocks",
    description: "تركيبة حرة من عناصر محكومة",
  },
  brand_story: {
    label: "قصة البراند",
    icon: "book-open",
    description: "حكاية علامتك التجارية ورسالتها في سرد بصري شيق",
  },
  newsletter: {
    label: "النشرة البريدية",
    icon: "mail",
    description: "نموذج اشتراك بسيط لبناء قائمة تسويقية",
  },
};