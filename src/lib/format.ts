// format.ts — تنسيق الأعداد والعدّ بالعربية في كل الواجهات.
// الأرقام دائماً بالأرقام اللاتينية (1,250) كما في المبالغ (formatEgp)، فلا تختلط ١٢٥٠ بـ 1,250 في الشاشة نفسها.

const INT = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0, numberingSystem: "latn" });
const DEC = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1, numberingSystem: "latn" });

/** عدد صحيح بفواصل الآلاف: 1,250 */
export function fmtNum(n: number): string {
  return INT.format(Number.isFinite(n) ? n : 0);
}

/** عدد بخانة عشرية واحدة عند الحاجة: 3.5 أو 4 */
export function fmtDec(n: number): string {
  return DEC.format(Number.isFinite(n) ? n : 0);
}

/** صيغ المعدود العربي: واحد، مثنى، جمع (3–10)، تمييز مفرد منصوب (11–99)، مفرد (100، 1000...). */
export type ArNoun = { one: string; two: string; few: string; many: string; other?: string };

const RULES = new Intl.PluralRules("ar");

/**
 * عدد مع معدوده بقواعد العربية: 1 ← «طلب واحد»، 2 ← «طلبان»، 3 ← «3 طلبات»، 11 ← «11 طلباً»، 100 ← «100 طلب».
 * الصفر يُعاد بصيغة الجمع («0 طلبات») ونادراً ما يُعرض؛ الأفضل إخفاء العنصر أو كتابة جملة نفي.
 */
export function arCount(n: number, noun: ArNoun): string {
  const v = Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  switch (RULES.select(v)) {
    case "one":
      return noun.one;
    case "two":
      return noun.two;
    case "few":
      return `${fmtNum(v)} ${noun.few}`;
    case "many":
      return `${fmtNum(v)} ${noun.many}`;
    case "zero":
      return `${fmtNum(v)} ${noun.few}`;
    default:
      return `${fmtNum(v)} ${noun.other ?? noun.one.split(" ")[0]}`;
  }
}

export const NOUN = {
  order: { one: "طلب واحد", two: "طلبان", few: "طلبات", many: "طلباً", other: "طلب" },
  newOrder: { one: "طلب جديد", two: "طلبان جديدان", few: "طلبات جديدة", many: "طلباً جديداً", other: "طلب جديد" },
  receipt: { one: "إيصال واحد", two: "إيصالان", few: "إيصالات", many: "إيصالاً", other: "إيصال" },
  review: { one: "تقييم واحد", two: "تقييمان", few: "تقييمات", many: "تقييماً", other: "تقييم" },
  product: { one: "منتج واحد", two: "منتجان", few: "منتجات", many: "منتجاً", other: "منتج" },
  customer: { one: "عميل واحد", two: "عميلان", few: "عملاء", many: "عميلاً", other: "عميل" },
  cart: { one: "سلة واحدة", two: "سلتان", few: "سلات", many: "سلة", other: "سلة" },
  visit: { one: "زيارة واحدة", two: "زيارتان", few: "زيارات", many: "زيارة", other: "زيارة" },
  day: { one: "يوم واحد", two: "يومان", few: "أيام", many: "يوماً", other: "يوم" },
  piece: { one: "قطعة واحدة", two: "قطعتان", few: "قطع", many: "قطعة", other: "قطعة" },
  visitor: { one: "زائر واحد", two: "زائران", few: "زوار", many: "زائراً", other: "زائر" },
  row: { one: "صف واحد", two: "صفان", few: "صفوف", many: "صفاً", other: "صف" },
  image: { one: "صورة واحدة", two: "صورتان", few: "صور", many: "صورة", other: "صورة" },
  openOrder: { one: "طلب جارٍ", two: "طلبان جاريان", few: "طلبات جارية", many: "طلباً جارياً", other: "طلب جارٍ" },
  times: { one: "مرة", two: "مرتين", few: "مرات", many: "مرة", other: "مرة" },
  code: { one: "كود واحد", two: "كودان", few: "أكواد", many: "كوداً", other: "كود" },
  category: { one: "قسم واحد", two: "قسمان", few: "أقسام", many: "قسماً", other: "قسم" },
  newCategory: { one: "قسم جديد", two: "قسمان جديدان", few: "أقسام جديدة", many: "قسماً جديداً", other: "قسم جديد" },
  char: { one: "حرف واحد", two: "حرفان", few: "أحرف", many: "حرفاً", other: "حرف" },
  item: { one: "عنصر واحد", two: "عنصران", few: "عناصر", many: "عنصراً", other: "عنصر" },
} satisfies Record<string, ArNoun>;
