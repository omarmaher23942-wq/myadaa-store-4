// facts.ts — الحقائق التي يحق للمتجر أن يقولها عن نفسه.
//
// أي شارة ثقة أو رسالة إعلان أو سطر في صفحة المنتج يدّعي شيئاً (دفع عند الاستلام، معاينة،
// استبدال، شحن مجاني...) يجب أن يكون صحيحاً في سياسة المتجر الآن، لا وقت البناء فقط.
// لذلك: الذكاء الاصطناعي يكتب الصياغة، لكن الحقيقة تأتي من هنا، وتُفحص عند كل عرض.
import type { StoreBlueprint } from "./schema";

export type FactKey =
  | "cod"
  | "inspection"
  | "returns"
  | "defect"
  | "free_shipping"
  | "free_shipping_over"
  | "nationwide"
  | "coverage"
  | "fast_delivery"
  | "pickup"
  | "wallets"
  | "whatsapp";

export type StoreFact = {
  key: FactKey;
  icon: string;
  /** عنوان قصير محايد (يُستخدم احتياطاً إن لم يكتب الذكاء الاصطناعي صياغة). */
  title: string;
  /** تفصيل صحيح حرفياً بأرقام المتجر. */
  detail: string;
};

export type FactContext = {
  /** عدد المحافظات التي يشحن إليها المتجر فعلاً (من جدول مناطق الشحن). */
  activeGovernorates?: number;
  /** أسرع مدة توصيل بالأيام بين المحافظات المفعّلة. */
  fastestDays?: number;
};

const egp = (piasters: number) => `${Math.round(piasters / 100).toLocaleString("ar-EG")} ج`;

/** أكبر رقم في نص المدة ("من 2 إلى 4 أيام عمل" → 4). */
function maxDays(eta: string): number | null {
  const nums = (eta.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 60);
  return nums.length ? Math.max(...nums) : null;
}

export function storeFacts(bp: StoreBlueprint, ctx: FactContext = {}): StoreFact[] {
  const out: StoreFact[] = [];
  const r = bp.returns;
  const s = bp.shipping;
  const p = bp.payments;

  if (p.cod.enabled) out.push({ key: "cod", icon: "banknote", title: "الدفع عند الاستلام", detail: "ادفع نقداً عند وصول طلبك" });
  if (s.inspectionAllowed) out.push({ key: "inspection", icon: "eye", title: "معاينة قبل الدفع", detail: "افتح الشحنة وافحص المنتج مع المندوب قبل أن تدفع" });

  if (r.windowDays > 0 && (r.allowExchange || r.allowRefund)) {
    const what = r.allowExchange && r.allowRefund ? "استبدال واسترجاع" : r.allowExchange ? "استبدال" : "استرجاع";
    out.push({ key: "returns", icon: "rotate-ccw", title: `${what} خلال ${r.windowDays} يوماً`, detail: `${what} خلال ${r.windowDays} يوماً من الاستلام وفق سياسة المتجر` });
  }
  if (r.defectPolicy !== "none") {
    out.push({ key: "defect", icon: "shield-check", title: "ضمان ضد العيوب", detail: "المنتج المعيب أو المخالف نتعامل معه فوراً وفق سياسة المتجر" });
  }

  if (s.freeOverPiasters === 0) out.push({ key: "free_shipping", icon: "truck", title: "شحن مجاني", detail: "الشحن مجاني على كل الطلبات" });
  else if (s.freeOverPiasters && s.freeOverPiasters > 0)
    out.push({ key: "free_shipping_over", icon: "gift", title: `شحن مجاني فوق ${egp(s.freeOverPiasters)}`, detail: `الشحن مجاني لأي طلب قيمته ${egp(s.freeOverPiasters)} أو أكثر` });

  if (typeof ctx.activeGovernorates === "number" && ctx.activeGovernorates > 0) {
    const all = ctx.activeGovernorates >= 27;
    out.push({
      key: all ? "nationwide" : "coverage",
      icon: "map-pin",
      title: all ? "شحن لكل محافظات مصر" : `شحن إلى ${ctx.activeGovernorates} محافظة`,
      detail: all ? "نوصّل لكل المحافظات حتى باب البيت" : `نوصّل إلى ${ctx.activeGovernorates} محافظة، وتظهر لك في صفحة الطلب`,
    });
  }

  const fastest = ctx.fastestDays ?? maxDays(s.generalEta);
  if (fastest && fastest <= 3) out.push({ key: "fast_delivery", icon: "zap", title: `توصيل خلال ${fastest} أيام`, detail: `يصل طلبك عادة خلال ${s.generalEta}` });

  if (s.pickupEnabled && s.pickupAddress) out.push({ key: "pickup", icon: "store", title: "استلام من المتجر", detail: `استلم طلبك بنفسك من ${s.pickupAddress}` });
  if (p.vodafoneCash.enabled || p.instapay.enabled) {
    const names = [p.vodafoneCash.enabled ? "فودافون كاش" : null, p.instapay.enabled ? "إنستاباي" : null].filter(Boolean).join(" و");
    out.push({ key: "wallets", icon: "smartphone", title: `الدفع بـ${names}`, detail: `ادفع مقدماً بتحويل ${names}` });
  }
  if (bp.channels.whatsappNumber) out.push({ key: "whatsapp", icon: "message-circle", title: "رد سريع على واتساب", detail: "كلمنا على واتساب في أي سؤال قبل الطلب أو بعده" });

  return out;
}

// كلمات تدل على ادعاء حقيقة بعينها: لأي شارة قديمة بلا مفتاح fact نستنتج ما تدّعيه ونتحقق منه.
const CLAIMS: { key: FactKey; re: RegExp }[] = [
  { key: "inspection", re: /معاين|فحص|افحص/ },
  { key: "cod", re: /عند الاستلام|كاش|نقد/ },
  { key: "returns", re: /استرجاع|استبدال|إرجاع|ارجاع|رد المبلغ/ },
  { key: "free_shipping", re: /شحن مجاني|توصيل مجاني/ },
  { key: "nationwide", re: /كل مصر|كل المحافظات|كل محافظات|جميع المحافظات|جميع محافظات|لكل مكان/ },
  { key: "fast_delivery", re: /توصيل سريع|شحن سريع|خلال \d+ (يوم|أيام|ساع)/ },
  { key: "wallets", re: /فودافون|إنستاباي|انستاباي|محفظ/ },
  { key: "whatsapp", re: /واتساب|واتس/ },
  { key: "defect", re: /ضمان|معيب|عيوب/ },
];

/** الحقيقة التي يدّعيها نص (أو null إن كان نصاً عاماً لا يدّعي سياسة). */
export function claimedFact(text: string): FactKey | null {
  for (const c of CLAIMS) if (c.re.test(text)) return c.key;
  return null;
}

const DIGITS = /[0-9٠-٩]+/g;
const toLatin = (x: string) => x.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const numbersIn = (t: string) => (toLatin(t).match(DIGITS) ?? []).map((n) => n.replace(/^0+(?=\d)/, ""));

/**
 * يُبقي فقط العناصر الصادقة الآن: عنصر مربوط بحقيقة غير متاحة يُحذف، وعنصر قديم بلا مفتاح
 * يُفحص نصه؛ فإن ادّعى سياسة غير صحيحة يُحذف. "free_shipping_over" يكفي لادعاء الشحن المجاني المشروط.
 * وإن ذكر العنصر رقماً لم يعد صحيحاً (مدة أو مبلغ تغيّر من اللوحة) تُستبدل صياغته بالحقيقة الحالية
 * (onMismatch = "replace") أو يُحذف (onMismatch = "drop"، مثل إجابات الأسئلة الشائعة).
 */
export function groundedItems<T extends { fact?: string; title?: string; text?: string }>(items: T[], facts: StoreFact[], onMismatch: "replace" | "drop" = "replace"): T[] {
  const have = new Set<string>(facts.map((f) => f.key));
  if (have.has("free_shipping_over")) have.add("free_shipping");
  const byKey = new Map(facts.map((f) => [f.key as string, f]));
  // ادعاء "كل مصر" بلا بيانات مناطق: نقبله فقط حين لا نعرف التغطية (لا نحذف ما لا نستطيع نفيه).
  const coverageUnknown = !facts.some((f) => f.key === "coverage" || f.key === "nationwide");
  const out: T[] = [];
  for (const it of items) {
    const key = it.fact ?? claimedFact(`${it.title ?? ""} ${it.text ?? ""}`);
    if (!key) {
      out.push(it);
      continue;
    }
    if ((key === "coverage" || key === "nationwide") && coverageUnknown) {
      out.push(it);
      continue;
    }
    if (key === "coverage" && have.has("nationwide")) {
      out.push(it);
      continue;
    }
    if (!have.has(key)) continue;
    const fact = byKey.get(key) ?? (key === "free_shipping" ? byKey.get("free_shipping_over") : undefined);
    const claimed = numbersIn(`${it.title ?? ""} ${it.text ?? ""}`);
    const truth = new Set(numbersIn(fact ? `${fact.title} ${fact.detail}` : ""));
    if (fact && claimed.some((n) => !truth.has(n))) {
      if (onMismatch === "drop") continue;
      out.push({ ...it, title: it.title !== undefined ? fact.title : it.title, text: it.text !== undefined ? fact.detail : it.text });
      continue;
    }
    out.push(it);
  }
  return out;
}

/** هل تصح كل الادعاءات في هذا النص الآن؟ (بنفس قواعد groundedItems، بما فيها الأرقام). */
function claimHolds(segment: string, facts: StoreFact[]): boolean {
  const keys = CLAIMS.filter((c) => c.re.test(segment)).map((c) => c.key);
  if (keys.length <= 1) return groundedItems([{ text: segment }], facts, "drop").length === 1;
  // أكثر من ادعاء في نفس الجملة: تصح فقط إن كانت كل حقيقة متاحة (والأرقام تُفحص لاحقاً على مستوى العبارة).
  return keys.every((key) => groundedItems([{ fact: key }], facts, "drop").length === 1);
}

// فواصل الجمل والعبارات في النص الحر: نهاية جملة، فاصلة، سطر جديد، أو واو عطف في بداية كلمة.
const SENTENCE = /[^.!؟?\n]+[.!؟?]*|\n/g;
const CLAUSE = /(،|,|؛|\s+-\s+|\s+(?=و\S))/;

/**
 * نص حر (وصف المتجر، شعار الفوتر، وصف محركات البحث، صفحة «عن المتجر») بعد حذف أي عبارة تدّعي سياسة
 * غير صحيحة الآن: «وشحن لكل محافظات مصر» تُحذف إن كان المتجر يشحن لبعض المحافظات فقط، ويبقى باقي الجملة.
 */
export function groundedText(text: string | undefined | null, facts: StoreFact[]): string {
  if (!text) return "";
  const out: string[] = [];
  for (const sentence of text.match(SENTENCE) ?? []) {
    if (sentence === "\n") {
      out.push("\n");
      continue;
    }
    if (!sentence.trim()) continue;
    if (!claimedFact(sentence) || claimHolds(sentence, facts)) {
      out.push(sentence);
      continue;
    }
    const end = /[.!؟?]\s*$/.exec(sentence)?.[0]?.trim() ?? "";
    const body = end ? sentence.slice(0, sentence.lastIndexOf(end)) : sentence;
    const parts = body.split(CLAUSE);
    const kept: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const seg = parts[i] ?? "";
      if (claimedFact(seg) && !claimHolds(seg, facts)) continue;
      if (kept.length && parts[i - 1] !== undefined) kept.push(parts[i - 1]!);
      kept.push(seg);
    }
    const joined = kept.join("").replace(/^[\s،,؛-]+|[\s،,؛-]+$/g, "").replace(/^و(?=\S)/, "");
    // جملة بقي منها أقل من كلمتين بلا معنى: تُحذف كلها.
    if (joined.split(/\s+/).filter(Boolean).length >= 2) out.push(`${joined}${end}`);
  }
  return out
    .map((s) => (s === "\n" ? s : s.trim()))
    .join(" ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

/** نسخة من الـ Blueprint بنصوص حرة صادقة (تُستخدم عند العرض فقط، ولا تُحفظ). */
export function truthfulBlueprint(bp: StoreBlueprint, facts: StoreFact[]): StoreBlueprint {
  const g = (t: string | undefined) => (t ? groundedText(t, facts) || undefined : t);
  return {
    ...bp,
    brand: { ...bp.brand, description: g(bp.brand.description), tagline: g(bp.brand.tagline) },
    footer: { ...bp.footer, tagline: g(bp.footer.tagline) },
    seo: { ...bp.seo, description: g(bp.seo.description), title: g(bp.seo.title) },
  };
}
