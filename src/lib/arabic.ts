/**
 * تطبيع النص العربي للبحث:
 *  - إزالة التشكيل والتطويل
 *  - توحيد الألف (أ إ آ => ا)، التاء المربوطة (ة => ه)، الياء (ى => ي)، الهمزات على الواو والياء
 *  - توحيد الأرقام إلى لاتينية
 *  - تحويل الفرانكو الشائع إلى عربي تقريبي (fostan => فستان) عبر خريطة أصوات
 * الناتج يُخزن في products.search_text ويُطبّق على استعلام المستخدم أيضًا.
 */
const TASHKEEL = /[\u064B-\u0652\u0670\u0640]/g;

export function normalizeArabic(text: string) {
  return text
    .replace(TASHKEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** خريطة أصوات الفرانكو (ترتيب الأطول أولًا مهم) */
const FRANCO: [RegExp, string][] = [
  [/sh/g, "ش"], [/kh/g, "خ"], [/gh/g, "غ"], [/th/g, "ث"], [/ch/g, "ش"], [/ph/g, "ف"],
  [/aa/g, "ا"], [/ee/g, "ي"], [/oo/g, "و"], [/ou/g, "و"],
  [/2/g, "ء"], [/3/g, "ع"], [/5/g, "خ"], [/6/g, "ط"], [/7/g, "ح"], [/8/g, "غ"], [/9/g, "ص"],
  [/a/g, "ا"], [/b/g, "ب"], [/t/g, "ت"], [/g/g, "ج"], [/j/g, "ج"], [/d/g, "د"], [/r/g, "ر"],
  [/z/g, "ز"], [/s/g, "س"], [/f/g, "ف"], [/k/g, "ك"], [/q/g, "ق"], [/l/g, "ل"], [/m/g, "م"],
  [/n/g, "ن"], [/h/g, "ه"], [/w/g, "و"], [/y/g, "ي"], [/i/g, "ي"], [/e/g, ""], [/o/g, "و"], [/u/g, "و"],
  [/p/g, "ب"], [/v/g, "ف"], [/x/g, "كس"], [/c/g, "ك"],
];

function mapFranco(text: string) {
  let s = text;
  for (const [re, ar] of FRANCO) s = s.replace(re, ar);
  return s;
}

/** حرف علة قصير (o/u/i/e) بين حرفين ساكنين — يُحذف عادة عند الكتابة بالعربية */
const SHORT_VOWEL = /(?<=[b-df-hj-np-tv-z2-9])[eiou](?=[b-df-hj-np-tv-z2-9])/g;

/**
 * تحويل الفرانكو إلى "الهيكل" العربي الأشيع: تُحذف الحركات القصيرة بين الساكنين
 * (fostan => فستان، 7elw => حلو).
 */
export function francoToArabic(text: string) {
  return mapFranco(text.toLowerCase().replace(SHORT_VOWEL, ""));
}

/**
 * كل الصيغ العربية المحتملة لكلمة فرانكو: الهيكل + الصيغة الكاملة بالحروف
 * (kotshey => كتشي، كوتشي). تُفهرس كلها حتى يطابق البحث أياً كانت كتابة العميل.
 */
export function francoVariants(text: string): string[] {
  const lower = text.toLowerCase();
  return Array.from(new Set([francoToArabic(lower), mapFranco(lower)]));
}

/** يُنتج نصًا موحّدًا يحوي الأصل المُطبّع + كل صيغ الفرانكو إن كان لاتينيًا */
export function buildSearchText(parts: (string | null | undefined)[]) {
  const joined = parts.filter(Boolean).join(" ");
  const normalized = normalizeArabic(joined);
  const hasLatin = /[a-z]/i.test(joined);
  return hasLatin ? [normalized, ...francoVariants(normalized)].join(" ") : normalized;
}

/** تطبيع استعلام البحث القادم من المستخدم */
export function normalizeQuery(q: string) {
  const n = normalizeArabic(q);
  return /[a-z]/i.test(q) ? francoToArabic(n) : n;
}

/** slug عربي-صديق: نحافظ على العربية (Next.js يدعمها) ونحذف الرموز */
export function slugify(text: string) {
  return normalizeArabic(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}
