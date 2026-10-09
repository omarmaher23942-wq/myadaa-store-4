// editable.ts — ما يعرضه محرر المحتوى من إعدادات المتجر: الحقول التي يقرؤها المتجر فعلاً فقط.
// مخطط الـ Blueprint فيه مفاتيح كثيرة بلا أي أثر (خيارات «سينمائية» لم تُبنَ، وتصميمات لا يفرّق بينها القسم، وحقول
// لا يعرضها)، فإظهارها يجعل التاجر يعدّل ما لا يتغير. القاعدة: مسار له قائمة هنا لا يُعرض منه غيرها، ومسار بلا قائمة
// يُعرض كله عدا المفاتيح التقنية. عند جعل حقل جديد يعمل في المتجر: أضفه هنا وأعطه اسماً في field-meta.ts.
import type { Section } from "@/blueprint/schema";

/** مفاتيح لا تظهر للتاجر في أي مكان. */
export const TECHNICAL_KEYS = new Set(["id", "type", "schemaVersion", "anchor", "fact", "focalX", "focalY", "enabled"]);

/** خلفية القسم ومسافاته وحركته: تطبّقها SectionShell على الأقسام التي تستخدمها. */
const SHELL = ["background", "backgroundImage", "spacing", "reveal"];

/** الأقسام التي يعرضها المتجر (registry.tsx)، بالحقول التي تقرؤها. */
export const SECTION_FIELDS: Partial<Record<Section["type"], string[]>> = {
  hero: ["variant", "eyebrow", "headline", "subheadline", "images", "primaryCta", "secondaryCta", "spotlightProductSlug", "overlayOpacity"],
  announcement: ["messages"],
  categories: ["variant", "title", "subtitle", "categorySlugs", "showProductCount"],
  product_grid: ["variant", "title", "subtitle", "source", "limit", "columnsDesktop", "showViewAll", "quickAdd", ...SHELL],
  promo_banner: ["items", ...SHELL],
  countdown_offer: ["title", "text", "endsAt", "couponCode", ...SHELL],
  trust_badges: ["variant", "items", ...SHELL],
  testimonials: ["title", "subtitle", "items", "includeVerifiedReviews", ...SHELL],
  faq: ["variant", "title", "subtitle", "items", ...SHELL],
  about: ["title", "body", ...SHELL],
  bundle: ["title", "text", "productSlugs", "bundleDiscountPercent", ...SHELL],
  video: ["title", "videoUrl", ...SHELL],
  contact: ["title", "address", ...SHELL],
  brand_story: ["variant", "title", "body", "image", "quote", ...SHELL],
  custom_blocks: ["title", "blocks", ...SHELL],
};

/** أنواع الأقسام التي يمكن إضافتها (يعرضها المتجر). يطابقها اختبار مع registry.tsx. */
export const ADDABLE_SECTIONS = Object.keys(SECTION_FIELDS) as Section["type"][];

/** حقول بقية الأجزاء والعناصر المتداخلة (المسار كما يبنيه SchemaForm). */
export const PATH_FIELDS: Record<string, string[]> = {
  brand: ["name", "tagline", "description", "logo", "favicon", "voice"],
  header: ["variant", "nav", "showCategoriesMenu"],
  "header.nav[]": ["label", "target"],
  footer: ["tagline", "showChannels", "showPaymentIcons"],
  conversion: ["lowStockAlert", "socialProofToasts", "exitIntentOffer", "productTrustRow", "showSavings", "recommendations", "rememberCustomer"],
  "conversion.recommendations": ["frequentlyBoughtTogether"],
  "conversion.productTrustRow[]": ["icon", "text"],
  productPage: ["layout", "showAttributesTable", "showReviews", "showShareButtons"],
  seo: ["title", "description", "ogImage", "noIndex"],
  "section:announcement.messages[]": ["text"],
  "section:promo_banner.items[]": ["title", "text", "couponCode"],
  "section:trust_badges.items[]": ["icon", "title", "text"],
  "section:testimonials.items[]": ["screenshot", "name", "text"],
  "section:faq.items[]": ["q", "a"],
  "section:custom_blocks.blocks[]": ["text"],
};

/** خيارات «مفعّل» داخل كائنات محرك المبيعات تبقى ظاهرة (وتختفي من غيرها: إظهار القسم من قائمة الأقسام). */
const ENABLED_PARENTS = new Set(["conversion.lowStockAlert", "conversion.socialProofToasts", "conversion.exitIntentOffer"]);

/** خيارات القوائم التي يفرّق بينها المتجر فعلاً (غيرها يُعرض كأحدها، فلا داعي لعرضه). */
export const ENUM_OPTIONS: Record<string, string[]> = {
  "section:hero.variant": ["split", "editorial", "collage", "product_spotlight", "centered", "fullscreen", "orbit"],
  "section:categories.variant": ["circles", "cards", "stories"],
  "section:product_grid.variant": ["grid", "carousel", "featured_first", "spotlight"],
  "section:faq.variant": ["accordion", "two_columns", "chat_bubbles"],
  "section:trust_badges.variant": ["row", "cards"],
  "section:brand_story.variant": ["split", "quote"],
  "header.variant": ["classic", "centered_logo", "minimal"],
  "section:custom_blocks.blocks[].kind": ["heading", "paragraph"],
};

/** الحقول الظاهرة من كائن، بترتيب القائمة إن وُجدت. */
export function visibleKeys(path: string, keys: string[]): string[] {
  const list = path.startsWith("section:") && !path.includes(".") ? SECTION_FIELDS[path.slice(8) as Section["type"]] : PATH_FIELDS[path];
  if (list) return list.filter((k) => keys.includes(k));
  return keys.filter((k) => !TECHNICAL_KEYS.has(k) || (k === "enabled" && ENABLED_PARENTS.has(path)));
}

/** تصميمات قديمة يعرضها المتجر كأحد الخيارات المسموح بها (يظهر في القائمة ما يراه العميل فعلاً). */
export const ENUM_ALIASES: Record<string, Record<string, string>> = {
  "section:hero.variant": { cinematic: "fullscreen", video: "fullscreen", carousel: "split", kinetic: "centered", ambient: "centered", storyteller: "centered" },
  "section:categories.variant": { bento: "cards", grid: "stories", cards_overlay: "stories", scroll: "stories", featured_hero: "stories", marquee: "stories" },
  "section:product_grid.variant": { masonry: "featured_first", bento: "featured_first", two_rows_scroll: "carousel", carousel_3d: "carousel", editorial: "grid" },
  "section:faq.variant": { split: "accordion" },
  "section:trust_badges.variant": { compact_strip: "row", horizontal_marquee: "cards" },
  "section:brand_story.variant": { scroll_linked: "split", timeline: "split" },
  "header.variant": { mega: "classic" },
};

/** خيارات قائمة والقيمة المعروضة: المسموح بها فقط، والقيمة القديمة تُعرض بما يراه العميل. */
export function enumView(path: string, all: string[], current: unknown): { options: string[]; selected: string | undefined } {
  const cur = typeof current === "string" ? current : undefined;
  const allowed = ENUM_OPTIONS[path];
  if (!allowed) return { options: all, selected: cur };
  const options = all.filter((o) => allowed.includes(o));
  const selected = cur && options.includes(cur) ? cur : cur ? ENUM_ALIASES[path]?.[cur] : undefined;
  return { options: selected || !cur ? options : [...options, cur], selected: selected ?? cur };
}
