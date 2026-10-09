// issues.ts — خطأ التحقق من إعدادات المتجر بلغة التاجر: «قسم «الواجهة الرئيسية» · العنوان الرئيسي: لا يمكن أن يكون فارغاً»
// بدل «home.0.headline: String must contain at least 1 character(s)»، مع مكانه (المفتاح الأعلى ومعرّف القسم) لينتقل
// المحرر إليه مباشرة.
import type { ZodIssue } from "zod";
import { SECTION_META } from "./registry-meta";
import { FIELD_LABELS } from "@/editor/field-meta";
import { arCount, NOUN } from "@/lib/format";
import type { StoreBlueprint } from "./schema";

export const BLUEPRINT_PART_LABELS: Record<string, string> = {
  brand: "العلامة التجارية",
  theme: "الألوان والخطوط",
  design: "تصميم المتجر",
  copy: "نصوص الأزرار",
  header: "الهيدر",
  footer: "الفوتر",
  channels: "قنوات التواصل",
  home: "أقسام الصفحة الرئيسية",
  productPage: "صفحة المنتج",
  conversion: "محرك المبيعات",
  payments: "الدفع",
  shipping: "الشحن",
  returns: "الاسترجاع",
  checkout: "إتمام الطلب",
  orderMessages: "رسائل الطلبات",
  invoice: "الفاتورة",
  customCss: "التصميم المخصص",
  pages: "صفحات المتجر",
  seo: "الظهور في محركات البحث",
};

export function issueMessage(i: ZodIssue): string {
  switch (i.code) {
    case "too_big": {
      const max = Number(i.maximum);
      if (i.type === "string") return `أطول من المسموح (الحد ${arCount(max, NOUN.char)})`;
      if (i.type === "array") return `أكثر من المسموح (الحد ${arCount(max, NOUN.item)})`;
      return `أكبر من المسموح (الحد ${max})`;
    }
    case "too_small": {
      const min = Number(i.minimum);
      if (i.type === "string") return min <= 1 ? "لا يمكن أن يكون فارغاً" : `أقصر من المطلوب (${arCount(min, NOUN.char)} على الأقل)`;
      if (i.type === "array") return min <= 1 ? "أضف عنصراً واحداً على الأقل" : `أضف ${arCount(min, NOUN.item)} على الأقل`;
      return `أصغر من المسموح (${min} على الأقل)`;
    }
    case "invalid_string":
      if (i.validation === "url") return "الرابط غير صحيح، يبدأ بـ https://";
      if (i.validation === "email") return "البريد غير صحيح";
      if (i.validation === "regex") return "الصيغة غير صحيحة";
      return "النص غير صالح";
    case "invalid_enum_value":
    case "invalid_literal":
    case "invalid_union_discriminator":
      return "اختيار غير متاح";
    case "invalid_type":
      return i.received === "undefined" || i.received === "null" ? "حقل مطلوب" : "قيمة غير صالحة";
    default:
      return "قيمة غير صالحة";
  }
}

export type IssueTarget = { top: string | null; sectionId: string | null };

/** نص عربي يحدد المكان والمشكلة، ومكانها ليفتحه المحرر. */
export function describeIssue(issue: ZodIssue, bp: Partial<StoreBlueprint>): { text: string; target: IssueTarget } {
  const [top, ...rest] = issue.path;
  const target: IssueTarget = { top: typeof top === "string" ? top : null, sectionId: null };
  let where = typeof top === "string" ? (BLUEPRINT_PART_LABELS[top] ?? "إعدادات المتجر") : "إعدادات المتجر";

  if (top === "home" && typeof rest[0] === "number") {
    const s = bp.home?.[rest[0]];
    if (s) {
      where = `قسم «${SECTION_META[s.type]?.label ?? s.type}»`;
      target.sectionId = s.id;
    }
    rest.shift();
  } else if (top === "pages" && typeof rest[0] === "number") {
    const p = bp.pages?.[rest[0]];
    if (p?.title) where = `صفحة «${p.title}»`;
    rest.shift();
  }

  // أقرب اسم حقل معروف من نهاية المسار (items.2.text ← «النص»).
  const field = [...rest].reverse().find((p): p is string => typeof p === "string" && Boolean(FIELD_LABELS[p]));
  const label = field ? FIELD_LABELS[field]!.label : null;
  return { text: `${where}${label ? ` · ${label}` : ""}: ${issueMessage(issue)}`, target };
}
