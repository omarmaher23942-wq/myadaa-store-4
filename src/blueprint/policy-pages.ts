// policy-pages.ts — صفحات السياسات تُولَّد حتمياً من سياسات المتجر الفعلية (لا من الذكاء الاصطناعي).
//
// السبب: صفحات الشحن والاستبدال والخصوصية والشروط التزام قانوني أمام العميل، فيجب أن تطابق
// ما يطبقه التاجر حرفياً (المدة، المصاريف، المعاينة، طرق الدفع)، وأن تكون موجودة دائماً.
// يكتب التاجر فوقها نسخته الخاصة من لوحة التحكم متى أراد، فتُقدَّم نسخته على المولَّدة.
import type { StoreBlueprint } from "./schema";

type Page = StoreBlueprint["pages"][number];
export type PolicySlug = Page["slug"];

const egp = (piasters: number) => `${Math.round(piasters / 100).toLocaleString("ar-EG")} جنيه`;

const PAID_BY: Record<StoreBlueprint["returns"]["returnShippingPaidBy"], string> = {
  customer: "يتحمل العميل مصاريف شحن المرتجع.",
  store: "يتحمل المتجر مصاريف شحن المرتجع بالكامل، فلن تدفع شيئاً لإرجاع أو استبدال منتج.",
  // قيمة قديمة: صار العيب سياسة مستقلة (defectLines)، فتبقى هنا لتغيير الرأي أو المقاس فقط.
  store_if_defect: "يتحمل العميل مصاريف شحن المرتجع عند تغيير الرأي أو المقاس.",
};

/** مهلة الإبلاغ بصيغة طبيعية: 48 ساعة، 3 أيام، 14 يوماً. */
export function reportWindow(hours: number): string {
  if (hours < 72) return `${hours} ساعة`;
  const d = Math.round(hours / 24);
  return d <= 10 ? `${d} أيام` : `${d} يوماً`;
}

/** قسم المنتج المعيب كما اختاره التاجر حرفياً؛ لا يُكتب شيء إن اختار «لا يوجد التزام». */
function defectLines(bp: StoreBlueprint): string[] {
  const r = bp.returns;
  if (r.defectPolicy === "none") return [];
  const within = `أبلغنا خلال **${reportWindow(r.defectReportHours)}** من الاستلام`;
  const shipping = r.defectShippingByStore ? "، ونتحمل مصاريف الشحن كاملة" : "، وتكون مصاريف الشحن على العميل";
  const action: Record<Exclude<typeof r.defectPolicy, "none">, string> = {
    replace_or_refund: `${within}، وسنستبدله أو نرد ثمنه كاملاً حسب ما تفضل${shipping}.`,
    replace: `${within}، وسنستبدله لك بمنتج سليم${shipping}.`,
    refund: `${within}، وسنرد لك ثمنه كاملاً${shipping}.`,
    case_by_case: `${within} مع صورة توضح المشكلة، وسنراجع الحالة ونتفق معك على الحل المناسب.`,
  };
  return ["## المنتجات المعيبة أو المخالفة", `إذا وصلك منتج معيب أو مختلف عما طلبته، ${action[r.defectPolicy]}`];
}

function contactLines(bp: StoreBlueprint): string[] {
  const c = bp.channels;
  const out: string[] = [];
  if (c.whatsappNumber) out.push(`- واتساب: **${c.whatsappNumber}**`);
  if (c.phone && c.phone !== c.whatsappNumber) out.push(`- الهاتف: **${c.phone}**`);
  if (c.email) out.push(`- البريد الإلكتروني: **${c.email}**`);
  if (c.instagramUsername) out.push(`- إنستجرام: **@${c.instagramUsername}**`);
  if (c.messengerPageUsername) out.push(`- ماسنجر: **${c.messengerPageUsername}**`);
  if (!out.length) out.push("- من خلال صفحة «تتبع الطلب» أو الرد على رسالة تأكيد طلبك.");
  return out;
}

function paymentLines(bp: StoreBlueprint): string[] {
  const p = bp.payments;
  const out: string[] = [];
  if (p.cod.enabled) out.push("- **الدفع عند الاستلام:** تدفع نقداً للمندوب عند وصول الطلب.");
  if (p.vodafoneCash.enabled) out.push("- **فودافون كاش:** تحويل إلى رقم المتجر الموضح في صفحة الدفع، ثم رفع صورة التحويل.");
  if (p.instapay.enabled) out.push("- **إنستاباي (InstaPay):** تحويل فوري إلى عنوان المتجر الموضح في صفحة الدفع، ثم رفع صورة التحويل.");
  if (!out.length) out.push("- طرق الدفع المتاحة تظهر لك في صفحة إتمام الطلب.");
  return out;
}

function shippingPage(bp: StoreBlueprint): Page {
  const s = bp.shipping;
  const fee =
    s.freeOverPiasters === 0
      ? "الشحن **مجاني** على كل الطلبات داخل مصر."
      : s.flatRatePiasters
        ? `رسوم الشحن ثابتة **${egp(s.flatRatePiasters)}** لأي محافظة.`
        : "رسوم الشحن تختلف حسب المحافظة، وتظهر لك بالضبط في صفحة إتمام الطلب قبل التأكيد.";
  const free =
    s.freeOverPiasters && s.freeOverPiasters > 0
      ? `\n- **شحن مجاني** لأي طلب قيمته **${egp(s.freeOverPiasters)}** أو أكثر.`
      : "";
  const body = [
    `نحرص في ${bp.brand.name} على وصول طلبك سليماً وفي أسرع وقت. هذه تفاصيل الشحن كما نطبقها فعلاً.`,
    "## مناطق التوصيل",
    "نوصّل إلى جميع المحافظات المتاحة في صفحة إتمام الطلب، حتى باب المنزل أو العمل.",
    "## مدة التوصيل",
    `يصل الطلب عادةً خلال **${s.generalEta}** من تأكيده. قد تزيد المدة يوماً أو يومين في المواسم والعطلات الرسمية، وسنبلغك بأي تأخير.`,
    "## رسوم الشحن",
    `- ${fee}${free}`,
    ...(s.pickupEnabled && s.pickupAddress
      ? ["## الاستلام من المتجر", `يمكنك استلام طلبك بنفسك من: **${s.pickupAddress}** بلا رسوم شحن.`]
      : []),
    "## المعاينة عند الاستلام",
    s.inspectionAllowed
      ? "من حقك **فتح الشحنة ومعاينة المنتج مع المندوب قبل الدفع**. إن لم يطابق ما طلبته يمكنك رفض الاستلام، وفي هذه الحالة لا تدفع إلا مصاريف الشحن إن وُجدت."
      : "لا تتاح معاينة المنتج قبل الدفع، لكن يحق لك الاستبدال أو الاسترجاع وفق سياسة الاستبدال الموضحة في صفحتها.",
    "## خطوات الطلب",
    "- بعد الطلب تصلك رسالة بكود الطلب.",
    "- نتواصل معك لتأكيد الطلب والعنوان.",
    "- نسلّم الشحنة لشركة الشحن، ويمكنك متابعتها من صفحة «تتبع الطلب».",
    "- يتصل بك المندوب قبل الوصول.",
    "## طرق الدفع",
    ...paymentLines(bp),
    "## للتواصل بخصوص الشحن",
    ...contactLines(bp),
  ].join("\n");
  return { slug: "shipping", title: "سياسة الشحن والتوصيل", body, enabled: true, showInFooter: true };
}

function returnsPage(bp: StoreBlueprint): Page {
  const r = bp.returns;
  const actions = [r.allowExchange ? "الاستبدال" : null, r.allowRefund ? "الاسترجاع واسترداد المبلغ" : null].filter(Boolean).join(" أو ");
  const conditions = r.conditions.length
    ? r.conditions
    : [
        "أن يكون المنتج بحالته الأصلية، غير مستخدم وغير مغسول.",
        "أن يكون في تغليفه الأصلي مع كل الملحقات والبطاقات.",
        "أن يكون معك كود الطلب أو رقم الموبايل المسجل به.",
      ];
  const body =
    r.windowDays === 0 || (!r.allowExchange && !r.allowRefund)
      ? [
          `في ${bp.brand.name} نراجع كل طلب بعناية قبل شحنه.`,
          "## الاستبدال والاسترجاع",
          "لا يتاح الاستبدال أو الاسترجاع بعد الاستلام لطبيعة منتجاتنا.",
          bp.shipping.inspectionAllowed ? "لذلك نتيح لك **معاينة المنتج مع المندوب قبل الدفع**، ويمكنك رفض الاستلام إن لم يطابق طلبك." : "",
          ...defectLines(bp),
          "## للتواصل",
          ...contactLines(bp),
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `رضاك في ${bp.brand.name} أولاً. يمكنك طلب ${actions} خلال **${r.windowDays} يوماً** من تاريخ الاستلام.`,
          "## شروط القبول",
          ...conditions.map((c) => `- ${c}`),
          ...(r.nonReturnable ? ["## منتجات لا تُستبدل ولا تُسترجع", r.nonReturnable] : []),
          "## مصاريف الشحن",
          PAID_BY[r.returnShippingPaidBy],
          "## الخطوات",
          "- تواصل معنا بكود الطلب وسبب الاستبدال أو الاسترجاع.",
          "- نحدد معك موعد استلام المرتجع من عنوانك.",
          "- بعد فحص المنتج والتأكد من مطابقته للشروط ننفذ طلبك.",
          ...(r.allowRefund
            ? [
                "## استرداد المبلغ",
                `يُرد المبلغ خلال **${r.refundDays} أيام عمل** من استلامنا للمرتجع، بنفس طريقة الدفع الأصلية أو بتحويل على فودافون كاش أو إنستاباي حسب ما تفضل.`,
              ]
            : []),
          ...defectLines(bp),
          "## حقوقك القانونية",
          "لا تنتقص هذه السياسة من حقوقك وفق قانون حماية المستهلك المصري رقم 181 لسنة 2018.",
          "## للتواصل",
          ...contactLines(bp),
        ].join("\n");
  return { slug: "returns", title: "سياسة الاستبدال والاسترجاع", body, enabled: true, showInFooter: true };
}

function privacyPage(bp: StoreBlueprint): Page {
  const tracking = [bp.seo.metaPixelId ? "Meta Pixel" : null, bp.seo.gaMeasurementId ? "Google Analytics" : null].filter(Boolean);
  const body = [
    `توضح هذه السياسة كيف يجمع ${bp.brand.name} بياناتك ويستخدمها ويحميها عند تسوقك من المتجر.`,
    "## البيانات التي نجمعها",
    "- **بيانات الطلب:** الاسم، رقم الموبايل، العنوان والمحافظة، وأي ملاحظات تكتبها.",
    "- **بيانات الدفع:** طريقة الدفع، وصورة التحويل إن دفعت بالتحويل. لا نطلب ولا نحفظ أي بيانات بطاقات بنكية.",
    "- **بيانات التصفح:** الصفحات والمنتجات التي تشاهدها، بشكل مجمع لتحسين المتجر.",
    "## لماذا نستخدمها",
    "- تنفيذ طلبك وتوصيله والتواصل معك بشأنه.",
    "- إرسال تحديثات حالة الطلب.",
    "- تحسين المنتجات والعروض وتجربة التسوق.",
    "- منع الاحتيال والطلبات الوهمية.",
    "## مع من نشاركها",
    "- **شركة الشحن:** الاسم والموبايل والعنوان فقط، لتوصيل الطلب.",
    "- **مزودو الخدمات التقنية:** الاستضافة وقاعدة البيانات وتخزين الصور، وفق اتفاقيات تحفظ سريتها.",
    ...(tracking.length ? [`- **أدوات القياس:** ${tracking.join(" و")} لقياس أداء الإعلانات، بلا بيانات تعريفية مباشرة.`] : []),
    "لا نبيع بياناتك ولا نؤجرها لأي طرف.",
    "## ملفات تعريف الارتباط (Cookies)",
    "نستخدم ملفات ضرورية لحفظ سلتك وتسجيل دخولك. ويمكنك حذفها من إعدادات المتصفح في أي وقت.",
    "## حماية البيانات",
    "تُنقل كل البيانات عبر اتصال مشفر (HTTPS)، ويقتصر الوصول إليها على فريق المتجر المسؤول عن تنفيذ الطلبات.",
    "## مدة الاحتفاظ",
    "نحتفظ ببيانات الطلبات المدة التي يتطلبها القانون والمحاسبة، ثم نحذفها أو نخفي هويتها.",
    "## حقوقك",
    "- الاطلاع على بياناتك المسجلة لدينا.",
    "- تصحيح أي بيانات غير دقيقة.",
    "- طلب حذف بياناتك، ما لم يلزمنا القانون بالاحتفاظ بها.",
    "- إيقاف أي رسائل تسويقية.",
    "## للتواصل بخصوص الخصوصية",
    ...contactLines(bp),
  ].join("\n");
  return { slug: "privacy", title: "سياسة الخصوصية", body, enabled: true, showInFooter: true };
}

function termsPage(bp: StoreBlueprint): Page {
  const body = [
    `باستخدامك متجر ${bp.brand.name} وإتمامك أي طلب، فأنت توافق على الشروط التالية.`,
    "## الطلبات",
    "- يُعد الطلب مؤكداً بعد تواصلنا معك وتأكيده.",
    "- يحق للمتجر إلغاء أي طلب لنفاد الكمية أو لخطأ واضح في السعر أو لبيانات غير صحيحة، مع إبلاغك ورد أي مبلغ مدفوع كاملاً.",
    "- يمكنك إلغاء الطلب مجاناً قبل خروجه للشحن.",
    "## الأسعار",
    "- كل الأسعار بالجنيه المصري، وتشمل الضرائب إن وُجدت.",
    "- رسوم الشحن تظهر منفصلة في صفحة إتمام الطلب قبل التأكيد.",
    "- السعر الملزم هو السعر وقت تأكيد طلبك.",
    "## الدفع",
    ...paymentLines(bp),
    "## صور المنتجات",
    "نحرص أن تطابق الصور المنتج الفعلي، وقد يختلف اللون قليلاً حسب إعدادات شاشتك.",
    "## الشحن والاستبدال",
    "تخضع مواعيد التوصيل والاستبدال والاسترجاع لسياسة الشحن وسياسة الاستبدال المنشورتين في المتجر.",
    "## التقييمات",
    "تُنشر تقييمات العملاء بعد مراجعتها، ويحق للمتجر حجب أي تقييم مسيء أو غير متعلق بالمنتج.",
    "## الملكية الفكرية",
    `كل محتوى المتجر من صور ونصوص وشعار ملك لـ ${bp.brand.name}، ولا يجوز نسخه أو استخدامه دون إذن.`,
    "## القانون الحاكم",
    "تخضع هذه الشروط لقوانين جمهورية مصر العربية، ومنها قانون حماية المستهلك رقم 181 لسنة 2018.",
    "## التواصل",
    ...contactLines(bp),
  ].join("\n");
  return { slug: "terms", title: "الشروط والأحكام", body, enabled: true, showInFooter: true };
}

function contactPage(bp: StoreBlueprint): Page {
  const body = [
    `يسعدنا تواصلك مع ${bp.brand.name} في أي وقت لأي سؤال عن منتج أو طلب.`,
    "## قنوات التواصل",
    ...contactLines(bp),
    "## متابعة طلبك",
    "يمكنك معرفة حالة طلبك فوراً من صفحة «تتبع الطلب» بكود الطلب ورقم الموبايل.",
    "## مواعيد الرد",
    "نرد على الرسائل يومياً، وفي العادة خلال ساعات قليلة.",
  ].join("\n");
  return { slug: "contact", title: "تواصل معنا", body, enabled: true, showInFooter: false };
}

function aboutPage(bp: StoreBlueprint): Page {
  const body = [
    bp.brand.description || `${bp.brand.name} متجر مصري يختار منتجاته بعناية ليقدم لك جودة حقيقية بسعر عادل.`,
    "## ما نلتزم به",
    "- منتجات مطابقة لما تراه في الصور والوصف.",
    `- توصيل خلال ${bp.shipping.generalEta}.`,
    ...(bp.shipping.inspectionAllowed ? ["- معاينة المنتج مع المندوب قبل الدفع."] : []),
    ...(bp.returns.windowDays > 0 ? [`- استبدال واسترجاع خلال ${bp.returns.windowDays} يوماً.`] : []),
    "- خدمة عملاء تتابع معك حتى يصلك طلبك.",
  ].join("\n");
  return { slug: "about", title: `عن ${bp.brand.name}`, body, enabled: true, showInFooter: true };
}

const BUILDERS: Partial<Record<PolicySlug, (bp: StoreBlueprint) => Page>> = {
  shipping: shippingPage,
  returns: returnsPage,
  privacy: privacyPage,
  terms: termsPage,
  contact: contactPage,
  about: aboutPage,
};

export const GENERATED_POLICY_SLUGS = Object.keys(BUILDERS) as PolicySlug[];

/** نسخة مولَّدة من سياسات المتجر الفعلية. */
export function generatePolicyPage(bp: StoreBlueprint, slug: PolicySlug): Page | null {
  return BUILDERS[slug]?.(bp) ?? null;
}

/** صفحة التاجر إن كتبها (ومفعّلة)، وإلا النسخة المولّدة. صفحة عطّلها التاجر صراحة لا تُعرض. */
export function resolvePolicyPage(bp: StoreBlueprint, slug: string): Page | null {
  const own = bp.pages.find((p) => p.slug === slug);
  if (own) {
    if (!own.enabled) return null;
    if (own.body.trim()) return own;
    // سجل بلا نص = النسخة المولّدة بإعدادات التاجر (الظهور في الفوتر).
    const gen = generatePolicyPage(bp, own.slug);
    return gen ? { ...gen, showInFooter: own.showInFooter } : null;
  }
  return (GENERATED_POLICY_SLUGS as string[]).includes(slug) ? generatePolicyPage(bp, slug as PolicySlug) : null;
}

/** كل صفحات المتجر الظاهرة (نسخ التاجر + المولّدة لما لم يكتبه). */
export function allPolicyPages(bp: StoreBlueprint): Page[] {
  const slugs = new Set<string>([...bp.pages.map((p) => p.slug), ...GENERATED_POLICY_SLUGS]);
  return [...slugs].map((s) => resolvePolicyPage(bp, s)).filter((p): p is Page => Boolean(p));
}
