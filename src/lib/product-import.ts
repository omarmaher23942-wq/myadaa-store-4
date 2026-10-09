// product-import.ts — تحويل صفوف CSV إلى منتجات: يتعرف على عناوين الأعمدة بالعربية أو الإنجليزية، ويقرأ الأرقام
// بأي كتابة (١٢٥٠، 1,250، 450 ج.م)، ويعيد لكل صف أخطاءه وتنبيهاته بالعربية مع رقم السطر. نفس الدالة تعمل في
// المتصفح (معاينة قبل الاستيراد) وفي الخادم (تحقق نهائي)، فلا يدخل القاعدة صف لم يُعرض على التاجر.

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_IMAGES = 10;

export type ImportField = "name" | "price" | "compareAt" | "cost" | "stock" | "sku" | "category" | "description" | "images";

const ALIASES: Record<ImportField, string[]> = {
  name: ["name", "title", "product", "اسم المنتج", "الاسم", "المنتج"],
  price: ["price", "السعر", "سعر البيع"],
  compareAt: ["compare_at", "compare at", "old price", "السعر قبل الخصم", "السعر القديم"],
  cost: ["cost", "سعر التكلفة", "التكلفة"],
  stock: ["stock", "quantity", "qty", "الكمية", "المخزون"],
  sku: ["sku", "كود المنتج", "الكود"],
  category: ["category", "القسم", "الفئة"],
  description: ["description", "الوصف"],
  images: ["images", "image", "image_url", "image url", "الصور", "الصورة", "رابط الصورة"],
};

const norm = (s: string) => s.trim().toLowerCase().replace(/[_\s]+/g, " ").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");

/** يربط كل عمود بحقله من عنوانه؛ الأعمدة المجهولة تُتجاهل. */
export function mapHeader(header: string[]): Partial<Record<ImportField, number>> {
  const out: Partial<Record<ImportField, number>> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [field, names] of Object.entries(ALIASES) as [ImportField, string[]][]) {
      if (out[field] === undefined && names.some((a) => norm(a) === n)) out[field] = i;
    }
  });
  return out;
}

/** رقم من نص بأي كتابة شائعة: أرقام هندية، فواصل آلاف، «ج.م»/«جنيه»، فاصلة عشرية عربية. */
export function parseNumber(raw: string): number | null {
  const s = raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫]/g, ".")
    .replace(/(ج\.?\s?م\.?|جنيه|egp|le)/gi, "")
    .replace(/[,٬\s]/g, "")
    .trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export type ImportRow = {
  line: number;
  name: string;
  pricePiasters: number;
  compareAtPiasters: number | null;
  costPiasters: number | null;
  /** null = بلا تتبع مخزون (متاح دائماً). */
  stock: number | null;
  sku: string | null;
  category: string | null;
  description: string | null;
  images: string[];
  errors: string[];
  warnings: string[];
};

export type ImportPlan = { rows: ImportRow[]; missingColumns: ImportField[]; tooMany: boolean };

const toPiasters = (n: number) => Math.round(n * 100);

export function planImport(table: string[][]): ImportPlan {
  const [header = [], ...body] = table;
  const map = mapHeader(header);
  const missingColumns = (["name", "price"] as const).filter((f) => map[f] === undefined);
  const cell = (r: string[], f: ImportField) => (map[f] === undefined ? "" : (r[map[f]!] ?? "").trim());

  const rows = body.slice(0, IMPORT_MAX_ROWS).map((r, i): ImportRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = cell(r, "name").slice(0, 120);
    if (!name) errors.push("الاسم فارغ");

    const price = parseNumber(cell(r, "price"));
    if (price === null) errors.push("السعر فارغ");
    else if (Number.isNaN(price) || price <= 0) errors.push(`السعر «${cell(r, "price")}» غير صالح`);

    let compareAt = parseNumber(cell(r, "compareAt"));
    if (compareAt !== null && (Number.isNaN(compareAt) || (price && compareAt <= price))) {
      warnings.push("السعر قبل الخصم أُهمل لأنه ليس أكبر من السعر");
      compareAt = null;
    }
    let cost = parseNumber(cell(r, "cost"));
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
      warnings.push("سعر التكلفة غير صالح فأُهمل");
      cost = null;
    }

    const stockRaw = parseNumber(cell(r, "stock"));
    let stock: number | null = null;
    if (stockRaw !== null) {
      if (Number.isNaN(stockRaw) || stockRaw < 0 || !Number.isInteger(stockRaw)) errors.push(`الكمية «${cell(r, "stock")}» يجب أن تكون عدداً صحيحاً`);
      else stock = stockRaw;
    }

    const images = cell(r, "images")
      .split(/[|\s]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    const safeImages = images.filter((u) => /^https:\/\/[^\s]+$/i.test(u));
    const okImages = safeImages.slice(0, IMPORT_MAX_IMAGES);
    if (safeImages.length < images.length) warnings.push("روابط صور غير آمنة (ليست https) أُهملت");
    if (okImages.length < safeImages.length) warnings.push(`أكثر من ${IMPORT_MAX_IMAGES} صور؛ أُخذت أول ${IMPORT_MAX_IMAGES}`);

    return {
      line: i + 2,
      name,
      pricePiasters: price && !Number.isNaN(price) ? toPiasters(price) : 0,
      compareAtPiasters: compareAt ? toPiasters(compareAt) : null,
      costPiasters: cost !== null ? toPiasters(cost) : null,
      stock,
      sku: cell(r, "sku").slice(0, 40) || null,
      category: cell(r, "category").slice(0, 80) || null,
      description: cell(r, "description").slice(0, 5000) || null,
      images: okImages,
      errors,
      warnings,
    };
  });

  return { rows, missingColumns: [...missingColumns], tooMany: body.length > IMPORT_MAX_ROWS };
}

/** قالب CSV بعناوين عربية ومثالين، يفتح سليماً في Excel. */
export const IMPORT_TEMPLATE =
  "﻿" +
  [
    "اسم المنتج,السعر,السعر قبل الخصم,سعر التكلفة,الكمية,القسم,الكود,الوصف,الصور",
    'فستان كتان صيفي,450,599,250,20,فساتين,DR-01,"خامة كتان خفيفة، مناسبة للصيف",https://example.com/dress.jpg',
    "حقيبة جلد,780,,420,,حقائب,BG-02,جلد طبيعي بخياطة يدوية,",
  ].join("\r\n");
