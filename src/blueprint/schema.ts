import { z } from "zod";

const hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "لون HEX غير صالح");

export const paletteSchema = z.object({
  primary: hex,
  primaryForeground: hex,
  secondary: hex,
  secondaryForeground: hex,
  accent: hex,
  accentForeground: hex,
  background: hex,
  foreground: hex,
  muted: hex,
  mutedForeground: hex,
  card: hex,
  cardForeground: hex.default("#0f172a"),
  border: hex,
  success: hex.default("#16a34a"),
  warning: hex.default("#f59e0b"),
  danger: hex.default("#dc2626"),
});

export const ambientBackdropSchema = z.object({
  layers: z.array(z.object({
    color: z.string(),
    opacity: z.number().min(0).max(1),
    position: z.string(),
    size: z.string(),
  })).max(4).default([]),
  blendMode: z.string().default("normal"),
});

export const fontFamilySchema = z.enum([
  "cairo", "tajawal", "ibm_plex_arabic", "almarai", "changa", "el_messiri", "readex_pro", "noto_kufi",
]);

export const themeSchema = z.object({
  mode: z.enum(["light", "dark", "auto"]).default("light"),
  palette: paletteSchema,
  darkPalette: paletteSchema.partial().optional(),
  fonts: z.object({
    heading: fontFamilySchema.default("cairo"),
    body: fontFamilySchema.default("cairo"),
    baseSize: z.number().min(14).max(20).default(16),
  }),
  radius: z.enum(["none", "sm", "md", "lg", "xl", "full"]).default("lg"),
  buttonStyle: z.enum(["solid", "soft", "outline", "gradient", "glass"]).default("solid"),
  shadow: z.enum(["none", "soft", "medium", "dramatic", "cinematic"]).default("soft"),
  motion: z.enum(["minimal", "subtle", "balanced", "expressive", "cinematic"]).default("balanced"),
  productCardStyle: z.enum([
    "minimal", "elevated", "bordered", "editorial", "overlay",
    "glass", "floating", "brutalist",
  ]).default("elevated"),
  imageRatio: z.enum(["square", "portrait", "landscape", "cinematic"]).default("square"),
  backgroundPattern: z.enum(["none", "dots", "grid", "noise", "gradient_mesh"]).default("none"),
  imageBackground: z.enum(["none", "muted", "card"]).default("none"),
  ambientBackdrop: ambientBackdropSchema.optional(),
});
export type Theme = z.infer<typeof themeSchema>;
export type Palette = z.infer<typeof paletteSchema>;
export type AmbientBackdrop = z.infer<typeof ambientBackdropSchema>;

export const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(200).default(""),
  focalX: z.number().min(0).max(1).default(0.5),
  focalY: z.number().min(0).max(1).default(0.5),
});

export const videoThumbSchema = z.object({
  url: z.string().url(),
  poster: z.string().url().optional(),
  duration: z.number().min(0).optional(),
});

export const model3dSchema = z.object({
  glbUrl: z.string().url(),
  usdzUrl: z.string().url().optional(),
  alt: z.string().max(200).default(""),
});

export const linkTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("home") }),
  z.object({ type: z.literal("all_products") }),
  z.object({ type: z.literal("category"), slug: z.string() }),
  z.object({ type: z.literal("product"), slug: z.string() }),
  z.object({ type: z.literal("page"), slug: z.string() }),
  z.object({ type: z.literal("section"), sectionId: z.string() }),
  z.object({ type: z.literal("contact") }),
  z.object({ type: z.literal("external"), url: z.string().url() }),
]);
export type LinkTarget = z.infer<typeof linkTargetSchema>;

export const ctaSchema = z.object({
  label: z.string().min(1).max(40),
  target: linkTargetSchema,
  style: z.enum(["primary", "secondary", "ghost", "link"]).default("primary"),
  icon: z.string().optional(),
});

export const productSourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("featured") }),
  z.object({ type: z.literal("newest") }),
  z.object({ type: z.literal("best_sellers") }),
  z.object({ type: z.literal("on_sale") }),
  z.object({ type: z.literal("category"), slug: z.string() }),
  z.object({ type: z.literal("manual"), slugs: z.array(z.string()).max(24) }),
  z.object({ type: z.literal("tag"), tag: z.string() }),
]);

const base = {
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  spacing: z.enum(["compact", "normal", "spacious"]).default("normal"),
  background: z.enum(["default", "muted", "primary", "dark", "gradient", "image", "ambient"]).default("default"),
  backgroundImage: imageSchema.optional(),
  reveal: z.enum(["none", "fade", "slide_up", "zoom", "stagger", "kinetic"]).default("fade"),
  anchor: z.string().max(40).optional(),
};

export const heroSection = z.object({
  ...base,
  type: z.literal("hero"),
  variant: z.enum([
    "split",
    "fullscreen",
    "centered",
    "carousel",
    "product_spotlight",
    "collage",
    "video",
    "editorial",
    "cinematic",
    "kinetic",
    "ambient",
    "storyteller",
    "orbit",
  ]).default("split"),
  eyebrow: z.string().max(60).optional(),
  headline: z.string().min(1).max(90),
  subheadline: z.string().max(220).optional(),
  images: z.array(imageSchema).max(8).default([]),
  videoUrl: z.string().url().optional(),
  primaryCta: ctaSchema.optional(),
  secondaryCta: ctaSchema.optional(),
  highlights: z.array(z.object({ icon: z.string(), text: z.string().max(40) })).max(4).default([]),
  spotlightProductSlug: z.string().optional(),
  overlayOpacity: z.number().min(0).max(0.9).default(0.35),
  textAlign: z.enum(["start", "center"]).default("start"),
  height: z.enum(["auto", "tall", "screen"]).default("tall"),
  autoplayMs: z.number().min(2500).max(10000).default(5000),
  enableParallax: z.boolean().default(true),
  enableKineticTypography: z.boolean().default(true),
  enableAmbientGlow: z.boolean().default(true),
});

export const announcementSection = z.object({
  ...base,
  type: z.literal("announcement"),
  variant: z.enum(["static", "marquee", "rotating"]).default("marquee"),
  messages: z.array(z.object({ text: z.string().max(120), target: linkTargetSchema.optional(), fact: z.string().max(30).optional() })).min(1).max(6),
  dismissible: z.boolean().default(false),
  sticky: z.boolean().default(true),
});

export const categoriesSection = z.object({
  ...base,
  type: z.literal("categories"),
  variant: z.enum([
    "grid", "circles", "stories", "cards_overlay", "scroll",
    "bento", "featured_hero", "marquee",
  ]).default("circles"),
  title: z.string().max(60).optional(),
  subtitle: z.string().max(140).optional(),
  categorySlugs: z.array(z.string()).default([]),
  showProductCount: z.boolean().default(true),
});

export const productGridSection = z.object({
  ...base,
  type: z.literal("product_grid"),
  variant: z.enum([
    "grid", "carousel", "masonry", "featured_first", "two_rows_scroll",
    "bento", "spotlight", "carousel_3d", "editorial",
  ]).default("grid"),
  title: z.string().max(60).optional(),
  subtitle: z.string().max(140).optional(),
  source: productSourceSchema,
  limit: z.number().min(2).max(24).default(8),
  columnsMobile: z.union([z.literal(1), z.literal(2)]).default(2),
  columnsDesktop: z.union([z.literal(3), z.literal(4), z.literal(5)]).default(4),
  showViewAll: z.boolean().default(true),
  quickAdd: z.boolean().default(true),
});

export const promoBannerSection = z.object({
  ...base,
  type: z.literal("promo_banner"),
  variant: z.enum(["wide", "split_duo", "triple", "ticket", "floating_card"]).default("wide"),
  items: z.array(z.object({
    eyebrow: z.string().max(40).optional(),
    title: z.string().max(70),
    text: z.string().max(160).optional(),
    image: imageSchema.optional(),
    cta: ctaSchema.optional(),
    couponCode: z.string().max(20).optional(),
  })).min(1).max(3),
});

export const countdownOfferSection = z.object({
  ...base,
  type: z.literal("countdown_offer"),
  variant: z.enum(["banner", "hero_card", "inline"]).default("banner"),
  title: z.string().max(70),
  text: z.string().max(160).optional(),
  endsAt: z.string(),
  source: productSourceSchema.optional(),
  cta: ctaSchema.optional(),
  couponCode: z.string().max(20).optional(),
});

export const trustBadgesSection = z.object({
  ...base,
  type: z.literal("trust_badges"),
  variant: z.enum(["row", "cards", "compact_strip", "horizontal_marquee"]).default("row"),
  items: z.array(z.object({
    icon: z.string(),
    title: z.string().max(40),
    text: z.string().max(90).optional(),
    // الحقيقة التي تدّعيها الشارة (blueprint/facts). تُخفى تلقائياً إن لم تعد صحيحة في سياسة المتجر.
    fact: z.string().max(30).optional(),
  })).min(1).max(6),
});

export const testimonialsSection = z.object({
  ...base,
  type: z.literal("testimonials"),
  variant: z.enum(["cards", "carousel", "masonry", "screenshots", "voice_reviews", "marquee"]).default("cards"),
  title: z.string().max(60).optional(),
  subtitle: z.string().max(160).optional(),
  items: z.array(z.object({
    name: z.string().max(40),
    text: z.string().max(300),
    rating: z.number().min(1).max(5).default(5),
    avatar: imageSchema.optional(),
    screenshot: imageSchema.optional(),
    audioUrl: z.string().url().optional(),
    audioDuration: z.number().min(0).optional(),
    location: z.string().max(30).optional(),
    verified: z.boolean().default(false),
  })).default([]),
  includeVerifiedReviews: z.boolean().default(true),
});

export const faqSection = z.object({
  ...base,
  type: z.literal("faq"),
  variant: z.enum(["accordion", "two_columns", "chat_bubbles", "split"]).default("accordion"),
  title: z.string().max(60).optional(),
  subtitle: z.string().max(160).optional(),
  items: z.array(z.object({ q: z.string().max(140), a: z.string().max(600) })).min(1).max(15),
});

export const aboutSection = z.object({
  ...base,
  type: z.literal("about"),
  variant: z.enum(["split", "centered_story", "timeline", "founder_note", "scroll_linked"]).default("founder_note"),
  title: z.string().max(70),
  body: z.string().max(1500),
  image: imageSchema.optional(),
  stats: z.array(z.object({ value: z.string().max(12), label: z.string().max(30) })).max(4).default([]),
  cta: ctaSchema.optional(),
  founderName: z.string().max(40).optional(),
  founderTitle: z.string().max(40).optional(),
  founderImage: imageSchema.optional(),
  milestones: z.array(z.object({
    label: z.string().max(12),
    title: z.string().max(60),
    text: z.string().max(160).optional(),
  })).max(6).default([]),
});

export const instagramSection = z.object({
  ...base,
  type: z.literal("instagram_gallery"),
  variant: z.enum(["grid", "scroll", "masonry"]).default("grid"),
  title: z.string().max(60).optional(),
  handle: z.string().max(40),
  items: z.array(z.object({ image: imageSchema, postUrl: z.string().url().optional() })).max(12).default([]),
});

export const richTextSection = z.object({
  ...base,
  type: z.literal("rich_text"),
  variant: z.enum(["narrow", "wide", "two_columns"]).default("narrow"),
  title: z.string().max(80).optional(),
  body: z.string().max(4000),
});

export const bundleSection = z.object({
  ...base,
  type: z.literal("bundle"),
  variant: z.enum(["build_your_set", "fixed_bundle"]).default("fixed_bundle"),
  title: z.string().max(70),
  text: z.string().max(160).optional(),
  productSlugs: z.array(z.string()).min(2).max(5),
  bundleDiscountPercent: z.number().min(0).max(60).default(10),
});

export const statsSection = z.object({
  ...base,
  type: z.literal("stats"),
  variant: z.enum(["row", "cards"]).default("row"),
  items: z.array(z.object({ value: z.string().max(12), label: z.string().max(30), icon: z.string().optional() })).min(2).max(4),
});

export const videoSection = z.object({
  ...base,
  type: z.literal("video"),
  variant: z.enum(["inline", "cinematic"]).default("inline"),
  title: z.string().max(70).optional(),
  videoUrl: z.string().url(),
  poster: imageSchema.optional(),
  cta: ctaSchema.optional(),
});

export const contactSection = z.object({
  ...base,
  type: z.literal("contact"),
  variant: z.enum(["cards", "split_map", "compact"]).default("cards"),
  title: z.string().max(60).optional(),
  showChannels: z.boolean().default(true),
  address: z.string().max(200).optional(),
  mapEmbedUrl: z.string().url().optional(),
  workingHours: z.string().max(120).optional(),
});

export const brandStorySection = z.object({
  ...base,
  type: z.literal("brand_story"),
  variant: z.enum(["scroll_linked", "split", "quote", "timeline"]).default("scroll_linked"),
  title: z.string().max(80),
  body: z.string().max(2000),
  image: imageSchema.optional(),
  quote: z.string().max(200).optional(),
  quoteAuthor: z.string().max(60).optional(),
});

export const newsletterSection = z.object({
  ...base,
  type: z.literal("newsletter"),
  variant: z.enum(["inline", "card", "strip"]).default("card"),
  title: z.string().max(70),
  subtitle: z.string().max(160).optional(),
  ctaLabel: z.string().max(30).default("اشترك الآن"),
  placeholder: z.string().max(60).default("أدخل بريدك الإلكتروني"),
});

export const customBlocksSection = z.object({
  ...base,
  type: z.literal("custom_blocks"),
  variant: z.literal("stack").default("stack"),
  title: z.string().max(80).optional(),
  blocks: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("heading"), text: z.string().max(120), level: z.union([z.literal(2), z.literal(3)]).default(2) }),
    z.object({ kind: z.literal("paragraph"), text: z.string().max(1200) }),
    z.object({ kind: z.literal("image"), image: imageSchema, caption: z.string().max(140).optional() }),
    z.object({ kind: z.literal("icon_list"), items: z.array(z.object({ icon: z.string(), text: z.string().max(120) })).max(8) }),
    z.object({ kind: z.literal("cta"), cta: ctaSchema }),
    z.object({ kind: z.literal("divider") }),
    z.object({ kind: z.literal("comparison"), columns: z.array(z.string().max(30)).min(2).max(3), rows: z.array(z.array(z.string().max(60))).max(8) }),
  ])).min(1).max(12),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSection, announcementSection, categoriesSection, productGridSection, promoBannerSection,
  countdownOfferSection, trustBadgesSection, testimonialsSection, faqSection, aboutSection,
  instagramSection, richTextSection, bundleSection, statsSection, videoSection, contactSection,
  brandStorySection, newsletterSection, customBlocksSection,
]);
export type Section = z.infer<typeof sectionSchema>;

export const conversionSchema = z.object({
  stickyAddToCart: z.boolean().default(true),
  buyNowButton: z.boolean().default(true),
  freeShippingBar: z.object({
    enabled: z.boolean().default(false),
    thresholdPiasters: z.number().int().min(0).default(50000),
  }).default({}),
  lowStockAlert: z.object({ enabled: z.boolean().default(true), threshold: z.number().int().min(1).max(20).default(5) }).default({}),
  socialProofToasts: z.object({
    enabled: z.boolean().default(true),
    minOrdersToShow: z.number().int().min(1).default(5),
    lookbackHours: z.number().int().min(1).max(168).default(72),
  }).default({}),
  liveViewers: z.boolean().default(true),
  exitIntentOffer: z.object({
    enabled: z.boolean().default(false),
    title: z.string().max(60).default("استنى! خصم خاص ليك"),
    text: z.string().max(160).default("استخدم الكود ده قبل ما يخلص"),
    couponCode: z.string().max(20).optional(),
    showOncePerDays: z.number().int().min(1).default(3),
  }).default({}),
  // صف الثقة في صفحة المنتج: فارغ = يُشتق من حقائق المتجر الفعلية (blueprint/facts) عند العرض.
  productTrustRow: z.array(z.object({ icon: z.string(), text: z.string().max(40), fact: z.string().max(30).optional() })).max(4).default([]),
  deliveryEstimate: z.boolean().default(true),
  recommendations: z.object({
    frequentlyBoughtTogether: z.boolean().default(true),
    completeTheLook: z.boolean().default(true),
    recentlyViewed: z.boolean().default(true),
    cartUpsell: z.boolean().default(true),
  }).default({}),
  expressCheckout: z.boolean().default(true),
  rememberCustomer: z.boolean().default(true),
  messengerOrderButton: z.boolean().default(true),
  showSavings: z.boolean().default(true),
  cartDrawer: z.boolean().default(true),
  shareButtons: z.boolean().default(true),

  // حقول سينمائية جديدة (Part 1)
  ambientSound: z.boolean().default(false),
  cursorFollower: z.boolean().default(false),
  liveActivityBar: z.boolean().default(true),
  kineticTypography: z.boolean().default(true),
  viewTransitions: z.boolean().default(true),
  smartImageSequence: z.boolean().default(true),
  quickViewModal: z.boolean().default(true),
  stockPulseIndicator: z.boolean().default(true),
  product360Viewer: z.boolean().default(false),
  productARPreview: z.boolean().default(false),
  imageZoomLens: z.boolean().default(true),
  videoThumbs: z.boolean().default(true),
  multiLayerParallax: z.boolean().default(true),
  ambientBackdrop: z.boolean().default(true),
  scrollLinkedStory: z.boolean().default(true),
  comparisonBar: z.boolean().default(false),
  wishlistEnabled: z.boolean().default(true),
  voiceNavigation: z.boolean().default(false),
  aiSearch: z.boolean().default(true),
});

export const paymentsSchema = z.object({
  cod: z.object({ enabled: z.boolean().default(true), note: z.string().max(160).optional() }),
  vodafoneCash: z.object({ enabled: z.boolean().default(false), number: z.string().regex(/^01[0125]\d{8}$/).optional(), holderName: z.string().max(60).optional() }),
  instapay: z.object({ enabled: z.boolean().default(false), address: z.string().max(80).optional(), number: z.string().regex(/^01[0125]\d{8}$/).optional(), holderName: z.string().max(60).optional() }),
  requireTransferProof: z.boolean().default(true),
  transferInstructions: z.string().max(400).optional(),
});

export const shippingSchema = z.object({
  freeOverPiasters: z.number().int().min(0).nullable().default(null),
  flatRatePiasters: z.number().int().min(0).nullable().default(null),
  generalEta: z.string().max(80).default("من 2 إلى 4 أيام عمل"),
  pickupEnabled: z.boolean().default(false),
  pickupAddress: z.string().max(200).optional(),
  // سياسة المعاينة قبل الدفع: تحكم شارة "معاينة قبل الدفع" في صفحة المنتج والـ checkout.
  inspectionAllowed: z.boolean().default(true),
});

// سياسة الاستبدال والاسترجاع كبيانات: تُولَّد منها صفحة "الاستبدال والاسترجاع" وشارات الثقة.
export const returnsSchema = z.object({
  windowDays: z.number().int().min(0).max(60).default(14),
  allowExchange: z.boolean().default(true),
  allowRefund: z.boolean().default(true),
  // من يتحمل مصاريف شحن المرتجع: العميل، أو المتجر دائماً، أو المتجر عند عيب أو خطأ فقط.
  returnShippingPaidBy: z.enum(["customer", "store", "store_if_defect"]).default("store_if_defect"),
  refundDays: z.number().int().min(1).max(30).default(7),
  conditions: z.array(z.string().max(160)).max(8).default([]),
  nonReturnable: z.string().max(300).optional(),
  // المنتج المعيب أو المخالف: التزام مستقل عن الاستبدال العادي، يختاره التاجر بالكامل.
  defectPolicy: z.enum(["replace_or_refund", "replace", "refund", "case_by_case", "none"]).default("replace_or_refund"),
  defectReportHours: z.number().int().min(12).max(720).default(48),
  defectShippingByStore: z.boolean().default(true),
});

export const policyPageSchema = z.object({
  slug: z.enum(["about", "shipping", "returns", "privacy", "terms", "faq", "contact"]),
  title: z.string().max(80),
  body: z.string().max(12000),
  enabled: z.boolean().default(true),
  showInFooter: z.boolean().default(true),
});

export const channelsSchema = z.object({
  messengerPageUsername: z.string().max(80).optional(),
  instagramUsername: z.string().max(80).optional(),
  facebookUrl: z.string().url().optional(),
  tiktokUsername: z.string().max(80).optional(),
  phone: z.string().regex(/^01[0125]\d{8}$/).optional(),
  whatsappNumber: z.string().regex(/^01[0125]\d{8}$/).optional(),
  email: z.string().email().optional(),
});

export const headerSchema = z.object({
  variant: z.enum(["classic", "centered_logo", "minimal", "mega"]).default("classic"),
  sticky: z.boolean().default(true),
  transparentOnHero: z.boolean().default(false),
  showSearch: z.boolean().default(true),
  nav: z.array(z.object({ label: z.string().max(30), target: linkTargetSchema })).max(8).default([]),
  showCategoriesMenu: z.boolean().default(true),
});

export const footerSchema = z.object({
  variant: z.enum(["rich", "minimal", "centered"]).default("rich"),
  tagline: z.string().max(160).optional(),
  showPaymentIcons: z.boolean().default(true),
  showChannels: z.boolean().default(true),
  showPoweredBy: z.boolean().default(true),
});

export const checkoutSchema = z.object({
  fields: z.object({
    altPhone: z.enum(["hidden", "optional", "required"]).default("optional"),
    city: z.enum(["hidden", "optional", "required"]).default("optional"),
    landmark: z.enum(["hidden", "optional", "required"]).default("optional"),
    notes: z.enum(["hidden", "optional"]).default("optional"),
    email: z.enum(["hidden", "optional", "required"]).default("hidden"),
  }).default({}),
  customFields: z.array(z.object({
    key: z.string().min(1).max(30),
    label: z.string().max(60),
    type: z.enum(["text", "select", "checkbox"]).default("text"),
    options: z.array(z.string()).default([]),
    required: z.boolean().default(false),
  })).max(5).default([]),
  minOrderPiasters: z.number().int().min(0).nullable().default(null),
  banner: z.string().max(160).optional(),
  termsCheckbox: z.boolean().default(false),
  successMessage: z.string().max(300).default("شكرًا لطلبك! هنتواصل معاك خلال ساعات للتأكيد."),
});

export const orderMessagesSchema = z.object({
  confirmed: z.string().max(500).default("أهلًا {name}، تم تأكيد طلبك {code} بإجمالي {total}. هيوصلك خلال {eta}. شكرًا لثقتك في {store}."),
  shipped: z.string().max(500).default("طلبك {code} خرج مع شركة الشحن وهيوصلك قريبًا. رقم الشحنة: {tracking}"),
  delivered: z.string().max(500).default("نتمنى يكون طلبك {code} عجبك. لو حابب تقيّم تجربتك: {review_link}"),
  abandoned: z.string().max(500).default("أهلًا {name}، لاحظنا إنك سبت {items} في السلة. محتاج مساعدة في إتمام الطلب؟"),
});

export const invoiceSchema = z.object({
  showLogo: z.boolean().default(true),
  footerNote: z.string().max(200).default("شكرًا لتسوقك معنا"),
  showQr: z.boolean().default(true),
  accentColor: hex.optional(),
  paperSize: z.enum(["A5", "A4", "thermal80"]).default("A5"),
  showPrices: z.boolean().default(true),
});

export const brandSchema = z.object({
  name: z.string().min(1).max(60),
  tagline: z.string().max(120).optional(),
  logo: imageSchema.optional(),
  logoDark: imageSchema.optional(),
  favicon: z.string().url().optional(),
  description: z.string().max(300).optional(),
  voice: z.enum(["friendly_egyptian", "premium_formal", "playful", "minimal"]).default("friendly_egyptian"),
  industry: z.string().max(60).default("general"),
});

export const seoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(160).optional(),
  ogImage: z.string().url().optional(),
  metaPixelId: z.string().max(30).optional(),
  gaMeasurementId: z.string().max(30).optional(),
  noIndex: z.boolean().default(false),
});

export const localeSchema = z.object({
  language: z.literal("ar").default("ar"),
  currency: z.literal("EGP").default("EGP"),
  timezone: z.literal("Africa/Cairo").default("Africa/Cairo"),
});

export const productPageSchema = z.object({
  layout: z.enum(["gallery_left", "gallery_stacked", "immersive"]).default("gallery_left"),
  showSku: z.boolean().default(false),
  showAttributesTable: z.boolean().default(true),
  showReviews: z.boolean().default(true),
  showShareButtons: z.boolean().default(true),
  extraSections: z.array(sectionSchema).max(4).default([]),
});


// ─── الحمض النووي للتصميم (Design DNA) ─────────────────────────────────────
// يكتبه مدير التصميم بالذكاء الاصطناعي لكل متجر، ويُترجم إلى متغيرات CSS وقواعد مكوّنات
// (blueprint/design.ts). كل حقل له قيمة افتراضية، فأي Blueprint قديم يبقى صالحاً.
export const designSchema = z.object({
  concept: z.string().max(80).default(""),
  mood: z.string().max(240).default(""),
  layout: z.object({
    container: z.enum(["narrow", "normal", "wide"]).default("normal"),
    density: z.enum(["airy", "balanced", "compact"]).default("balanced"),
    headingAlign: z.enum(["start", "center"]).default("start"),
  }).default({}),
  type: z.object({
    headingWeight: z.number().int().min(400).max(900).default(800),
    headingTracking: z.number().min(-0.05).max(0.08).default(-0.01),
    headingScale: z.number().min(0.85).max(1.35).default(1),
    bodyLeading: z.number().min(1.4).max(2.1).default(1.75),
  }).default({}),
  shape: z.object({
    card: z.number().int().min(0).max(40).default(16),
    button: z.number().int().min(0).max(999).default(14),
    input: z.number().int().min(0).max(24).default(12),
    image: z.number().int().min(0).max(40).default(14),
    chip: z.number().int().min(0).max(999).default(999),
  }).default({}),
  surface: z.object({
    background: z.enum(["solid", "soft_gradient", "radial_glow", "mesh", "paper", "dots", "grid", "lines", "waves"]).default("solid"),
    rhythm: z.enum(["flat", "alternate", "bands"]).default("alternate"),
    divider: z.enum(["none", "line", "wave", "curve", "slant"]).default("none"),
    grain: z.boolean().default(false),
  }).default({}),
  elevation: z.object({
    level: z.number().int().min(0).max(4).default(1),
    tint: hex.optional(),
    border: z.number().min(0).max(3).default(1),
  }).default({}),
  card: z.object({
    ratio: z.enum(["square", "portrait", "tall", "landscape"]).default("portrait"),
    fit: z.enum(["cover", "contain"]).default("cover"),
    imagePad: z.number().int().min(0).max(28).default(0),
    imageBg: z.enum(["none", "muted", "tint", "gradient"]).default("muted"),
    align: z.enum(["start", "center"]).default("start"),
    priceStyle: z.enum(["plain", "bold", "pill", "accent", "underline"]).default("bold"),
    hover: z.enum(["lift", "zoom", "swap", "glow", "none"]).default("zoom"),
    badge: z.enum(["pill", "tag", "corner", "ribbon"]).default("pill"),
    showCategory: z.boolean().default(false),
    quickAdd: z.enum(["button", "icon", "none"]).default("icon"),
  }).default({}),
  button: z.object({
    fill: z.enum(["solid", "gradient", "outline", "soft", "glass"]).default("solid"),
    weight: z.number().int().min(500).max(900).default(800),
    size: z.enum(["sm", "md", "lg"]).default("md"),
  }).default({}),
  icon: z.object({
    stroke: z.number().min(1).max(2.5).default(1.75),
    frame: z.enum(["none", "circle", "squircle", "square", "outline"]).default("squircle"),
    tone: z.enum(["primary", "accent", "foreground", "soft"]).default("primary"),
  }).default({}),
  heading: z.object({
    style: z.enum(["plain", "eyebrow", "underline", "ornament", "split"]).default("eyebrow"),
  }).default({}),
  header: z.object({
    surface: z.enum(["solid", "glass", "transparent", "bordered"]).default("glass"),
    logoSize: z.enum(["sm", "md", "lg"]).default("md"),
  }).default({}),
  /**
   * الحركة: calm ظهور ناعم فقط | lively ظهور متتابع وبطاقات تستجيب للمس | cinematic عناوين تتكشف كلمة كلمة،
   * وعمق مع التمرير، وصور تتنفس. depth = عمق ثلاثي الأبعاد (ميل البطاقات مع المؤشر، وطبقات تتحرك مع التمرير).
   */
  motion: z.object({
    level: z.enum(["calm", "lively", "cinematic"]).default("lively"),
    depth: z.boolean().default(true),
  }).default({}),
});
export type Design = z.infer<typeof designSchema>;

// ─── نصوص الواجهة (Microcopy) ──────────────────────────────────────────────
// أزرار وعناوين الواجهة بصوت المتجر نفسه، يكتبها الذكاء الاصطناعي. الفارغ يأخذ صياغة محايدة.
const mc = (max: number) => z.string().max(max).optional();
export const copySchema = z.object({
  addToCart: mc(24),
  buyNow: mc(24),
  soldOut: mc(24),
  viewAll: mc(24),
  cartTitle: mc(30),
  emptyCart: mc(80),
  continueShopping: mc(30),
  checkout: mc(30),
  searchPlaceholder: mc(50),
  newBadge: mc(14),
  saleBadge: mc(14),
  bestSellerBadge: mc(18),
  lowStock: mc(40),
  freeShippingGap: mc(70),
  freeShippingReached: mc(70),
  orderSuccessTitle: mc(60),
  trackOrder: mc(24),
  menu: mc(16),
  allProducts: mc(30),
}).default({});
export type StoreCopy = z.infer<typeof copySchema>;

export const blueprintSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  variationSeed: z.string().min(8).max(64),
  brand: brandSchema,
  theme: themeSchema,
  design: designSchema.default({}),
  copy: copySchema,
  locale: localeSchema.default({}),
  header: headerSchema.default({}),
  footer: footerSchema.default({}),
  channels: channelsSchema.default({}),
  home: z.array(sectionSchema).min(1).max(24),
  productPage: productPageSchema.default({}),
  conversion: conversionSchema.default({}),
  payments: paymentsSchema,
  shipping: shippingSchema.default({}),
  returns: returnsSchema.default({}),
  checkout: checkoutSchema.default({}),
  orderMessages: orderMessagesSchema.default({}),
  invoice: invoiceSchema.default({}),
  customCss: z.string().max(6000).default(""),
  pages: z.array(policyPageSchema).default([]),
  seo: seoSchema.default({}),
});

export type StoreBlueprint = z.infer<typeof blueprintSchema>;

export function validateBlueprint(input: unknown) {
  const r = blueprintSchema.safeParse(input);
  if (r.success) return { ok: true as const, data: r.data };
  return {
    ok: false as const,
    errors: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  };
}

// ─── Blueprint Check Schema (Anti-Duplication)
export const blueprintIssueSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  path: z.string(),
  message: z.string(),
});

export const blueprintFixSchema = z.object({
  path: z.string(),
  action: z.enum(["remove", "replace", "merge"]),
  value: z.string().optional(),
});

export const blueprintCheckSchema = z.object({
  clean: z.boolean(),
  score: z.number().min(0).max(100),
  duplicationsFound: z.array(z.object({
    type: z.string(),
    path1: z.string(),
    path2: z.string(),
    sample: z.string(),
  })).default([]),
  issues: z.array(blueprintIssueSchema).default([]),
  autoFixes: z.array(blueprintFixSchema).default([]),
  reasoning: z.string().optional(),
});

export type BlueprintCheck = z.infer<typeof blueprintCheckSchema>;
export type BlueprintIssue = z.infer<typeof blueprintIssueSchema>;
export type BlueprintFix = z.infer<typeof blueprintFixSchema>;

// Re-export section types for downstream
export type HeroSection = z.infer<typeof heroSection>;
export type AnnouncementSection = z.infer<typeof announcementSection>;
export type CategoriesSection = z.infer<typeof categoriesSection>;
export type ProductGridSection = z.infer<typeof productGridSection>;
export type PromoBannerSection = z.infer<typeof promoBannerSection>;
export type CountdownOfferSection = z.infer<typeof countdownOfferSection>;
export type TrustBadgesSection = z.infer<typeof trustBadgesSection>;
export type TestimonialsSection = z.infer<typeof testimonialsSection>;
export type FaqSection = z.infer<typeof faqSection>;
export type AboutSection = z.infer<typeof aboutSection>;
export type InstagramSection = z.infer<typeof instagramSection>;
export type RichTextSection = z.infer<typeof richTextSection>;
export type BundleSection = z.infer<typeof bundleSection>;
export type StatsSection = z.infer<typeof statsSection>;
export type VideoSection = z.infer<typeof videoSection>;
export type ContactSection = z.infer<typeof contactSection>;
export type BrandStorySection = z.infer<typeof brandStorySection>;
export type NewsletterSection = z.infer<typeof newsletterSection>;
export type CustomBlocksSection = z.infer<typeof customBlocksSection>;
export type Conversion = z.infer<typeof conversionSchema>;
export type Payments = z.infer<typeof paymentsSchema>;
export type Channels = z.infer<typeof channelsSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type Seo = z.infer<typeof seoSchema>;
export type PolicyPage = z.infer<typeof policyPageSchema>;