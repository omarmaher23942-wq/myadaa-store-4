// model.ts — بيانات محرر المنتج ومنطقه الخالص (بلا React ولا خادم): شكل النموذج، والحدود (نفس حدود الخادم)،
// وقراءة الأرقام كما يكتبها التاجر (عربية أو لاتينية وبفواصل)، والتحقق قبل الإرسال.
import { fmtNum } from "@/lib/format";
import type { Variant } from "../VariantMatrix";
import type { ProductImage } from "./ProductImages";

export type Status = "active" | "draft" | "hidden";

export type EditorProduct = {
  id?: string;
  slug?: string;
  name: string;
  categoryId: string | null;
  shortDescription: string;
  description: string;
  price: string;
  compareAt: string;
  cost: string;
  sku: string;
  trackStock: boolean;
  stock: string;
  images: ProductImage[];
  attributes: { label: string; value: string }[];
  optionNames: string[];
  variants: Variant[];
  tags: string[];
  badges: string[];
  status: Status;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
};

export type ProductStats = { views: number; sold: number; ratingAvg: number | null; ratingCount: number; createdAt: string };

export const EMPTY_PRODUCT: EditorProduct = {
  name: "",
  categoryId: null,
  shortDescription: "",
  description: "",
  price: "",
  compareAt: "",
  cost: "",
  sku: "",
  trackStock: true,
  stock: "",
  images: [],
  attributes: [],
  optionNames: [],
  variants: [],
  tags: [],
  badges: [],
  status: "active",
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
};

export const LIMITS = { name: 120, shortDescription: 200, description: 5000, seoTitle: 70, seoDescription: 160, sku: 40 } as const;


/** رقم من نص يكتبه التاجر: أرقام عربية أو لاتينية، وفواصل آلاف. فارغ ← null. */
export function toNumber(s: string): number | null {
  const t = s
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٫]/g, ".")
    .replace(/[,،٬\s]/g, "")
    .trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export type Errors = Partial<Record<"name" | "price" | "compareAt" | "cost" | "stock" | "categoryId" | "shortDescription" | "description" | "seoTitle" | "seoDescription" | "sku", string>>;

export function validateProduct(f: EditorProduct): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "اكتب اسم المنتج";
  else if (f.name.trim().length > LIMITS.name) e.name = `الاسم أطول من ${LIMITS.name} حرفاً`;
  const price = toNumber(f.price);
  if (price === null || Number.isNaN(price) || price <= 0) e.price = "اكتب سعر البيع بالجنيه";
  const compareAt = toNumber(f.compareAt);
  if (compareAt !== null && (Number.isNaN(compareAt) || compareAt < 0)) e.compareAt = "اكتب رقماً صحيحاً أو اتركه فارغاً";
  else if (compareAt !== null && price && compareAt <= price) e.compareAt = "يجب أن يكون أعلى من سعر البيع ليظهر كخصم، أو اتركه فارغاً";
  const cost = toNumber(f.cost);
  if (cost !== null && (Number.isNaN(cost) || cost < 0)) e.cost = "اكتب رقماً صحيحاً أو اتركه فارغاً";
  if (f.trackStock && !f.variants.length) {
    const stock = toNumber(f.stock);
    if (stock === null) e.stock = "اكتب الكمية المتاحة، أو أوقف «تتبع المخزون»";
    else if (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) e.stock = "الكمية عدد صحيح (0 أو أكثر)";
  }
  for (const k of ["shortDescription", "description", "seoTitle", "seoDescription", "sku"] as const) {
    if (f[k].length > LIMITS[k]) e[k] = `أطول من ${fmtNum(LIMITS[k])} حرف`;
  }
  return e;
}

export const FIELD_ORDER: (keyof Errors)[] = ["name", "shortDescription", "description", "price", "compareAt", "cost", "stock", "sku", "categoryId", "seoTitle", "seoDescription"];
