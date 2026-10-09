import { designSchema } from "./schema";
// blueprint/defaults.ts — بناء Blueprint افتراضي ذكي.
//
// التعديلات الجذرية:
//  1) استخراج palette من colorPreference عبر extractPalette (نص/بذرة).
//  2) اختيار fonts حسب المجال + المزاج عبر pickAdaptiveFonts.
//  3) variationSeed إلزامي — كل متجر مختلف.
//  4) announcement محذوف من الـ home الافتراضي (يأتي من AI composer فقط).
//  5) hero variant يُختار تلقائياً حسب السياق.
//  6) ambientBackdrop يُبنى من palette + seed.
import type { StoreBlueprint } from "./schema";
import { normalizeChannels, normalizePayments } from "./normalize";
import {
  extractPalette,
  pickAdaptiveFonts,
  resolveHeroVariant,
  buildVariationSeed,
  buildAmbientBackdrop,
} from "./palette";

const cap = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

export const INSPECTION_BADGE = {
  icon: "package-open",
  title: "معاينة قبل الاستلام",
  text: "افتح الشحنة وافحصها مع المندوب قبل ما تدفع",
} as const;
export const INSPECTION_TRUST = {
  icon: "package-open",
  text: "معاينة قبل الاستلام",
} as const;
export const INSPECTION_COD_NOTE = "معاينة الشحنة مع المندوب قبل الدفع متاحة";

// trust items تتكيّف مع الفئة + وجود القنوات.
function buildAdaptiveTrustItems(ctx: {
  industry: string;
  hasWhatsapp: boolean;
  inspectionAllowed: boolean;
}): Array<{ icon: string; title: string; text: string }> {
  const common: Array<{ icon: string; title: string; text: string }> = [
    { icon: "truck", title: "توصيل سريع", text: "لباب البيت في كل المحافظات" },
  ];

  const payment: { icon: string; title: string; text: string } = ctx.inspectionAllowed
    ? {
        icon: INSPECTION_BADGE.icon,
        title: INSPECTION_BADGE.title,
        text: INSPECTION_BADGE.text,
      }
    : {
        icon: "banknote",
        title: "ادفع عند الاستلام",
        text: "افحص طلبك قبل ما تدفع",
      };

  const returns: { icon: string; title: string; text: string } = {
    icon: "rotate-ccw",
    title: "استبدال سهل",
    text: "خلال 14 يوم من الاستلام",
  };

  const support: { icon: string; title: string; text: string } =
    ctx.hasWhatsapp
      ? {
          icon: "headphones",
          title: "دعم سريع",
          text: "بنرد عليك على واتساب وماسنجر فوراً",
        }
      : {
          icon: "headphones",
          title: "دعم سريع",
          text: "بنرد عليك على ماسنجر فوراً",
        };

  // إضافة مميزة لكل مجال.
  const industry: { icon: string; title: string; text: string }[] = [];
  switch (ctx.industry) {
    case "fashion":
    case "beauty":
      industry.push({
        icon: "sparkles",
        title: "أصلي ومضمون",
        text: "قطع أصلية مختارة بعناية",
      });
      break;
    case "electronics":
      industry.push({
        icon: "shield-check",
        title: "ضمان أصلي",
        text: "ضمان الوكيل المعتمد",
      });
      break;
    case "home":
      industry.push({
        icon: "home",
        title: "جودة البيت",
        text: "منتجات مختبرة قبل الشحن",
      });
      break;
    case "food":
      industry.push({
        icon: "leaf",
        title: "طازج يومياً",
        text: "توصيل سريع يحفظ الجودة",
      });
      break;
    default:
      industry.push({
        icon: "shield-check",
        title: "منتجات أصلية",
        text: "مختارة بعناية لك",
      });
  }

  return [common[0]!, payment, returns, ...industry, support];
}

// FAQ تتكيف مع وجود المعاينة + رقم واتساب.
function buildDynamicFaqItems(ctx: {
  inspectionAllowed: boolean;
  hasWhatsapp: boolean;
  shippingEta: string;
}): Array<{ q: string; a: string }> {
  const base = [
    {
      q: "إزاي أطلب؟",
      a: "اختار المنتج، اضغط أضف للسلة، وبعدين أكمل بياناتك وهنتواصل معاك لتأكيد الطلب.",
    },
    {
      q: "التوصيل بياخد قد إيه؟",
      a: ctx.shippingEta || "من 2 إلى 5 أيام عمل حسب المحافظة.",
    },
    {
      q: "أقدر أدفع عند الاستلام؟",
      a: "أكيد، الدفع عند الاستلام متاح لكل المحافظات.",
    },
  ];
  if (ctx.inspectionAllowed) {
    base.push({
      q: "أقدر أفتح الشحنة قبل ما أدفع؟",
      a: "أكيد، المعاينة مع المندوب قبل الدفع متاحة. افحص طلبك واطمّن وبعدين ادفع.",
    });
  }
  if (ctx.hasWhatsapp) {
    base.push({
      q: "أقدر أتواصل معاكم بسرعة؟",
      a: "أكيد، كلمنا على واتساب في أي وقت وهنرد عليك فوراً.",
    });
  }
  base.push({
    q: "لو المنتج مش مناسب؟",
    a: "تقدر تستبدله خلال 14 يوم من الاستلام بشرط يكون بحالته الأصلية.",
  });
  return base;
}

export function defaultBlueprint(input: {
  name: string;
  tagline?: string;
  industry?: string;
  messengerPageUsername?: string;
  instagramUsername?: string;
  facebookUrl?: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  vodafoneCash?: string;
  instapay?: string;
  inspectionAllowed?: boolean;
  colorPreference?: string;
  toneOfVoice?: string;
  storeId?: string;
  productCount?: number;
  hasHeroImages?: boolean;
  hasLogo?: boolean;
  variationSeed?: string;
}): StoreBlueprint {
  const name = cap(input.name.trim() || "متجري", 60);
  const tagline = cap(
    (input.tagline ?? "").trim() || "جودة تستاهلها، وسعر يريحك",
    120
  );
  const industry = cap((input.industry ?? "").trim() || "general", 60);
  const normalizedTone = (input.toneOfVoice ?? "friendly_egyptian").trim();
  const tone = [
    "friendly_egyptian",
    "premium_formal",
    "playful",
    "minimal",
  ].includes(normalizedTone)
    ? (normalizedTone as StoreBlueprint["brand"]["voice"])
    : "friendly_egyptian";
  const inspection = input.inspectionAllowed === true;

  const { channels } = normalizeChannels({
    messengerPageUsername: input.messengerPageUsername,
    instagramUsername: input.instagramUsername,
    facebookUrl: input.facebookUrl,
    email: input.email,
    phone: input.phone,
    whatsappNumber: input.whatsappNumber,
  });

  const { payments } = normalizePayments({
    cod: true,
    codNote: inspection ? INSPECTION_COD_NOTE : undefined,
    vodafoneCash: input.vodafoneCash,
    instapay: input.instapay,
    requireTransferProof: true,
    transferInstructions:
      "حوّل المبلغ على الرقم الظاهر، وارفع صورة التحويل واكتب الرقم اللي حوّلت منه، وهنأكد طلبك فوراً.",
  });

  // variationSeed: من المُدخل أو من hash(storeId + timestamp).
  const seed =
    input.variationSeed ??
    buildVariationSeed(input.storeId ?? name, Date.now());

  // استخراج palette + fonts.
  const extracted = extractPalette(input.colorPreference, industry, seed);
  const palette = extracted.palette;
  const fonts = pickAdaptiveFonts(industry, tone, seed);

  // بناء عناصر ديناميكية.
  const trustItems = buildAdaptiveTrustItems({
    industry,
    hasWhatsapp: Boolean(channels.whatsappNumber),
    inspectionAllowed: inspection,
  });

  // صف الثقة في صفحة المنتج يُبنى عند العرض من حقائق المتجر الفعلية (blueprint/facts.ts)، لا من هنا.
  const productTrustRow: { icon: string; text: string }[] = [];

  const faqItems = buildDynamicFaqItems({
    inspectionAllowed: inspection,
    hasWhatsapp: Boolean(channels.whatsappNumber),
    shippingEta: "من 2 إلى 5 أيام عمل حسب المحافظة.",
  });

  // hero variant ديناميكي.
  // resolveHeroVariant() قد يُرجع قيمًا خارج الـ union المسموح في home.hero
  // لذلك نفلّتها إلى مجموعة مقبولة فقط لتفادي خطأ التحقق من الأنواع.
  const rawHeroVariant = resolveHeroVariant({
    hasHeroImages: input.hasHeroImages ?? false,
    hasLogo: input.hasLogo ?? false,
    productCount: input.productCount ?? 0,
    industry,
    toneOfVoice: tone,
    seed,
  });

  const allowedHeroVariants = [
    "cinematic",
    "editorial",
    "centered",
    "ambient",
    "kinetic",
    "split",
    "fullscreen",
    "carousel",
    "product_spotlight",
    "collage",
    "video",
    "storyteller",
  ] as const;

  const heroVariant = (
    allowedHeroVariants.includes(rawHeroVariant as (typeof allowedHeroVariants)[number])
      ? rawHeroVariant
      : "cinematic"
  ) as Extract<
    StoreBlueprint["home"][number],
    { type: "hero" }
  >["variant"];

  // ambient backdrop للحالة عند غياب صور.
  const backdrop = buildAmbientBackdrop(palette, seed);

  return {
    schemaVersion: 1,
    variationSeed: seed,
    brand: {
      name,
      tagline,
      description: cap(
        `${name}: تسوّق أونلاين بسهولة، الدفع عند الاستلام والشحن لكل مصر.`,
        300
      ),
      voice: tone,
      industry,
    },
    design: designSchema.parse({}),
    copy: {},
    theme: {
      mode: palette.background === "#ffffff" ? "light" : "dark",
      palette,
      fonts,
      radius: "lg",
      buttonStyle: "solid",
      shadow: "soft",
      motion: tone === "minimal" ? "subtle" : "balanced",
      productCardStyle: "elevated",
      imageRatio: "square",
      backgroundPattern: "none",
      imageBackground: "none",
      ambientBackdrop: backdrop,
    },
    locale: { language: "ar", currency: "EGP", timezone: "Africa/Cairo" },
    header: {
      variant: "classic",
      sticky: true,
      transparentOnHero: false,
      showSearch: true,
      showCategoriesMenu: true,
      nav: [
        { label: "الرئيسية", target: { type: "home" } },
        { label: "كل المنتجات", target: { type: "all_products" } },
        { label: "تواصل معنا", target: { type: "contact" } },
      ],
    },
    footer: {
      variant: "rich",
      tagline: "",
      showPaymentIcons: true,
      showChannels: true,
      showPoweredBy: true,
    },
    channels,
    // ملاحظة: announcement محذوف من الـ home الافتراضي — يأتي من AI فقط لمنع
    // التكرار (bug سابق: يظهر مرتين لأن defaults + AI يضيفانه).
    home: [
      {
        id: "hero",
        type: "hero",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "fade",
        variant: heroVariant,
        enableParallax: false,
        enableKineticTypography: false,
        enableAmbientGlow: false,
        headline: cap(name, 90),
        subheadline: tagline || undefined,
        images: [],
        highlights: [
          { icon: "banknote", text: "الدفع عند الاستلام" },
          inspection
            ? { icon: INSPECTION_TRUST.icon, text: INSPECTION_TRUST.text }
            : { icon: "truck", text: "شحن لكل مصر" },
          { icon: "shield-check", text: "منتجات أصلية" },
        ],
        primaryCta: {
          label: "تسوّق الآن",
          target: { type: "all_products" },
          style: "primary",
        },
        overlayOpacity: 0.35,
        textAlign: "start",
        height: "tall",
        autoplayMs: 5000,
      },
      {
        id: "trust",
        type: "trust_badges",
        enabled: true,
        spacing: "compact",
        background: "muted",
        reveal: "stagger",
        variant: "row",
        items: trustItems,
      },
      {
        id: "cats",
        type: "categories",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "stagger",
        variant: "circles",
        title: "تسوّق حسب القسم",
        categorySlugs: [],
        showProductCount: true,
      },
      {
        id: "best",
        type: "product_grid",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "stagger",
        variant: "grid",
        title: "الأكثر طلباً",
        subtitle: "اللي الناس بتحبه أكتر",
        source: { type: "best_sellers" },
        limit: 8,
        columnsMobile: 2,
        columnsDesktop: 4,
        showViewAll: true,
        quickAdd: true,
      },
      {
        id: "promo",
        type: "promo_banner",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "zoom",
        variant: "wide",
        items: [
          {
            eyebrow: "عرض محدود",
            title: "خصم على أول طلب",
            text: "استخدم الكود وخد خصمك فوراً",
            couponCode: "WELCOME10",
            cta: {
              label: "اطلب الآن",
              target: { type: "all_products" },
              style: "primary",
            },
          },
        ],
      },
      {
        id: "new",
        type: "product_grid",
        enabled: true,
        spacing: "normal",
        background: "muted",
        reveal: "stagger",
        variant: "carousel",
        title: "وصل حديثاً",
        source: { type: "newest" },
        limit: 10,
        columnsMobile: 2,
        columnsDesktop: 4,
        showViewAll: true,
        quickAdd: true,
      },
      {
        id: "reviews",
        type: "testimonials",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "fade",
        variant: "carousel",
        title: "آراء عملائنا",
        items: [],
        includeVerifiedReviews: true,
      },
      {
        id: "faq",
        type: "faq",
        enabled: true,
        spacing: "normal",
        background: "default",
        reveal: "fade",
        variant: "accordion",
        title: "أسئلة شائعة",
        items: faqItems,
      },
      {
        id: "contact",
        type: "contact",
        enabled: true,
        spacing: "normal",
        background: "muted",
        reveal: "fade",
        variant: "cards",
        title: "تواصل معنا",
        showChannels: true,
      },
    ],
    productPage: {
      layout: "gallery_left",
      showSku: false,
      showAttributesTable: true,
      showReviews: true,
      showShareButtons: true,
      extraSections: [],
    },
    conversion: {
      stickyAddToCart: true,
      buyNowButton: true,
      freeShippingBar: { enabled: false, thresholdPiasters: 50000 },
      lowStockAlert: { enabled: true, threshold: 5 },
      socialProofToasts: {
        enabled: true,
        minOrdersToShow: 5,
        lookbackHours: 72,
      },
      liveViewers: true,
      exitIntentOffer: {
        enabled: false,
        title: "استنى! خصم خاص ليك",
        text: "استخدم الكود ده قبل ما يخلص",
        showOncePerDays: 3,
      },
      productTrustRow,
      deliveryEstimate: true,
      recommendations: {
        frequentlyBoughtTogether: true,
        completeTheLook: true,
        recentlyViewed: true,
        cartUpsell: true,
      },
      expressCheckout: true,
      rememberCustomer: true,
      messengerOrderButton: true,
      showSavings: true,
      cartDrawer: true,
      shareButtons: true,
      // Conversion flags جديدة — تُفعّل حسب المزاج + الـ seed.
      ambientSound: false,
      cursorFollower: tone === "premium_formal" || tone === "playful",
      liveActivityBar: true,
      kineticTypography: tone !== "minimal",
      viewTransitions: true,
      smartImageSequence: true,
      quickViewModal: true,
      stockPulseIndicator: true,
      product360Viewer: false,
      productARPreview: false,
      imageZoomLens: true,
      videoThumbs: true,
      multiLayerParallax: true,
      ambientBackdrop: true,
      scrollLinkedStory: true,
      comparisonBar: false,
      wishlistEnabled: true,
      voiceNavigation: false,
      aiSearch: true,
    },
    payments,
    shipping: {
      freeOverPiasters: null,
      flatRatePiasters: null,
      generalEta: "من 2 إلى 5 أيام عمل",
      pickupEnabled: false,
      inspectionAllowed: input.inspectionAllowed ?? true,
    },
    returns: {
      windowDays: 14,
      allowExchange: true,
      allowRefund: true,
      returnShippingPaidBy: "customer",
      refundDays: 7,
      conditions: [],
      defectPolicy: "replace_or_refund",
      defectReportHours: 48,
      defectShippingByStore: true,
    },
    checkout: {
      fields: {
        altPhone: "optional",
        city: "optional",
        landmark: "optional",
        notes: "optional",
        email: "hidden",
      },
      customFields: [],
      minOrderPiasters: null,
      termsCheckbox: false,
      successMessage: "شكراً لطلبك! هنتواصل معاك خلال ساعات للتأكيد.",
    },
    orderMessages: {
      confirmed:
        "أهلاً {name}، تم تأكيد طلبك {code} بإجمالي {total}. هيوصلك خلال {eta}. شكراً لثقتك في {store}.",
      shipped:
        "طلبك {code} خرج مع شركة الشحن وهيوصلك قريباً. رقم الشحنة: {tracking}",
      delivered:
        "نتمنى يكون طلبك {code} عجبك. لو حابب تقيّم تجربتك: {review_link}",
      abandoned:
        "أهلاً {name}، لاحظنا إنك سبت {items} في السلة. محتاج مساعدة في إتمام الطلب؟",
    },
    invoice: {
      showLogo: true,
      footerNote: "شكراً لتسوقك معنا",
      showQr: true,
      paperSize: "A5",
      showPrices: true,
    },
    customCss: "",
    // صفحات السياسات تُولَّد عند العرض من سياسات المتجر الفعلية (blueprint/policy-pages)،
    // ولا تُحفظ هنا إلا الصفحات التي يكتبها التاجر بنفسه.
    pages: [],
    seo: { noIndex: false },
  };
}