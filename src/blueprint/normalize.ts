import { linkTargetSchema, type LinkTarget, type StoreBlueprint } from "./schema";
import { normalizeEgyptianPhone } from "@/lib/phone";

/**
 * طبقة التطبيع بين البيانات الخام (مخرجات الذكاء + بيانات التاجر) وبين blueprintSchema الصارم.
 * قاعدة واحدة: هذه الدوال لا ترمي أبدًا؛ تُرجع دائمًا قيمة يقبلها المخطط، أو تُسقط الحقل مع تحذير مقروء.
 * ملف نقي (بدون server-only) ليُستخدم من defaults.ts و composer.ts ونماذج الإعدادات.
 */

/* ───────────── أدوات صغيرة ───────────── */
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const firstStr = (...vals: unknown[]) => { for (const v of vals) { const s = str(v); if (s) return s; } return ""; };
const cap = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);
const trimSlashes = (s: string) => s.trim().replace(/^\/+|\/+$/g, "");
const optCap = (v: unknown, max: number) => { const s = str(v); return s ? cap(s, max) : undefined; };

/* =====================================================================
 *  1) أهداف الروابط (LinkTarget)
 * ===================================================================== */
export type TargetContext = {
  catSlugs?: ReadonlySet<string>;
  prodSlugs?: ReadonlySet<string>;
  pageSlugs?: ReadonlySet<string>;
};

export const POLICY_SLUGS = ["about", "shipping", "returns", "privacy", "terms", "faq", "contact"] as const;
const POLICY = new Set<string>(POLICY_SLUGS);

const T_HOME: LinkTarget = { type: "home" };
const T_ALL: LinkTarget = { type: "all_products" };
const T_CONTACT: LinkTarget = { type: "contact" };

const HOME_WORDS = new Set(["home", "index", "main", "landing", "root", "الرئيسية", "الصفحة الرئيسية", "البداية"]);
const ALL_WORDS = new Set(["all_products", "all-products", "allproducts", "all", "products", "product", "shop", "store", "catalog", "catalogue", "collection", "collections", "المنتجات", "كل المنتجات", "المتجر", "تسوق", "تسوّق", "تسوق الآن"]);
const CONTACT_WORDS = new Set(["contact", "contact_us", "contact-us", "contactus", "support", "help", "تواصل", "تواصل معنا", "اتصل بنا", "كلمنا"]);
const SIMPLE_TYPES = new Set<LinkTarget["type"]>(["home", "all_products", "contact"]);

/** التحقق من أن الهدف يشير لشيء موجود فعلًا في المتجر */
function verify(t: LinkTarget, ctx: TargetContext): LinkTarget | null {
  switch (t.type) {
    case "category": return t.slug && (!ctx.catSlugs || ctx.catSlugs.has(t.slug)) ? t : null;
    case "product": return t.slug && (!ctx.prodSlugs || ctx.prodSlugs.has(t.slug)) ? t : null;
    case "page":
      if (t.slug === "contact") return T_CONTACT;
      return POLICY.has(t.slug) && (!ctx.pageSlugs || ctx.pageSlugs.has(t.slug)) ? t : null;
    case "section": return t.sectionId ? t : null;
    case "external": return /^https?:\/\//i.test(t.url) ? t : null;
    default: return t;
  }
}

/** نص ➔ هدف: يفهم "home" و"all_products" و"category:slug" و"/c/slug" و"page:about" و"#section" والروابط الخارجية والـ slug المجرد */
function fromString(raw: string, ctx: TargetContext): LinkTarget | null {
  const s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  const bare = trimSlashes(lower);
  const bareOriginal = trimSlashes(s);

  if (bare === "" || HOME_WORDS.has(lower) || HOME_WORDS.has(bare)) return T_HOME;
  if (ALL_WORDS.has(lower) || ALL_WORDS.has(bare)) return T_ALL;
  if (CONTACT_WORDS.has(lower) || CONTACT_WORDS.has(bare)) return T_CONTACT;

  if (/^https?:\/\//i.test(s)) {
    const p = linkTargetSchema.safeParse({ type: "external", url: s });
    return p.success ? p.data : null;
  }
  if (s.startsWith("#")) {
    const id = s.slice(1).trim();
    return id ? { type: "section", sectionId: id } : null;
  }

  const m = bareOriginal.match(/^(?:(category|categories|cat|c)|(product|products|p)|(page|pages|pg)|(section|sections|sec))\s*[:/=]\s*(.+)$/i);
  if (m) {
    const val = trimSlashes(m[5] ?? "");
    if (!val) return m[1] || m[2] ? T_ALL : null;
    if (m[1]) return { type: "category", slug: val };
    if (m[2]) return { type: "product", slug: val };
    if (m[3]) return val.toLowerCase() === "contact" ? T_CONTACT : { type: "page", slug: val.toLowerCase() };
    return { type: "section", sectionId: val };
  }

  if (POLICY.has(bare)) return bare === "contact" ? T_CONTACT : { type: "page", slug: bare };
  if (ctx.catSlugs?.has(bareOriginal)) return { type: "category", slug: bareOriginal };
  if (ctx.catSlugs?.has(bare)) return { type: "category", slug: bare };
  if (ctx.prodSlugs?.has(bareOriginal)) return { type: "product", slug: bareOriginal };
  if (ctx.prodSlugs?.has(bare)) return { type: "product", slug: bare };
  return null;
}

/** كائن ➔ هدف: يقبل الشكل الصحيح مباشرة، أو أشكالًا ناقصة/بديلة مثل { type:"products", slug } أو { href } */
function fromObject(o: Record<string, unknown>, ctx: TargetContext): LinkTarget | null {
  const direct = linkTargetSchema.safeParse(o);
  if (direct.success) return direct.data;

  const type = str(o.type ?? o.kind);
  const slug = firstStr(o.slug, o.categorySlug, o.productSlug, o.pageSlug, o.sectionId, o.id, o.value);
  if (type) {
    if (slug) { const t = fromString(`${type}:${slug}`, ctx); if (t) return t; }
    const simple = fromString(type, ctx);
    if (simple && SIMPLE_TYPES.has(simple.type)) return simple;
    if (type.toLowerCase() === "external") { const u = firstStr(o.url, o.href); if (u) return fromString(u, ctx); }
  }
  const href = firstStr(o.href, o.url, o.path, o.link, o.to, o.target);
  return href ? fromString(href, ctx) : null;
}

/** أي قيمة ➔ LinkTarget صالح دائمًا (الافتراضي: كل المنتجات) */
export function normalizeLinkTarget(raw: unknown, ctx: TargetContext = {}, fallback: LinkTarget = T_ALL): LinkTarget {
  let t: LinkTarget | null = null;
  if (typeof raw === "string") t = fromString(raw, ctx);
  else if (raw && typeof raw === "object") t = fromObject(raw as Record<string, unknown>, ctx);
  return (t && verify(t, ctx)) ?? fallback;
}

/** يمشي على أي بنية (أقسام الرئيسية مثلًا) ويطبّع كل مفتاح اسمه target أينما كان */
export function normalizeTargetsDeep<T>(value: T, ctx: TargetContext = {}): T {
  if (Array.isArray(value)) return value.map((v) => normalizeTargetsDeep(v, ctx)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === "target" ? normalizeLinkTarget(v, ctx) : normalizeTargetsDeep(v, ctx);
    }
    return out as T;
  }
  return value;
}

/* ───────────── روابط الهيدر ───────────── */
export type NavItem = StoreBlueprint["header"]["nav"][number];

export function normalizeNav(raw: unknown, ctx: TargetContext, fallback: NavItem[]): NavItem[] {
  if (!Array.isArray(raw)) return fallback;
  const out: NavItem[] = [];
  const seenLabel = new Set<string>();
  const seenTarget = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = cap(firstStr(o.label, o.title, o.text, o.name), 30);
    if (!label) continue;
    const target = normalizeLinkTarget(o.target ?? o.href ?? o.url ?? o.link ?? o.to, ctx);
    const tKey = JSON.stringify(target);
    if (seenLabel.has(label) || seenTarget.has(tKey)) continue;
    seenLabel.add(label); seenTarget.add(tKey);
    out.push({ label, target });
    if (out.length >= 8) break;
  }
  return out.length ? out : fallback;
}

/* =====================================================================
 *  2) الهواتف
 * ===================================================================== */
/** أي قيمة ➔ رقم مصري قياسي 01XXXXXXXXX أو undefined (لا يمر أي شيء غير صالح إلى الـ Regex) */
export function normalizePhoneField(raw: unknown): string | undefined {
  const s = str(raw);
  return s ? normalizeEgyptianPhone(s) ?? undefined : undefined;
}

/* =====================================================================
 *  3) الدفع
 * ===================================================================== */
export type PaymentsInput = {
  cod?: boolean;
  codNote?: unknown;
  vodafoneCash?: unknown;
  vodafoneHolderName?: unknown;
  instapay?: unknown;
  instapayHolderName?: unknown;
  requireTransferProof?: boolean;
  transferInstructions?: unknown;
};

const looksLikeInstapayAddress = (s: string) => /^[^\s@]+@[^\s@]+$/.test(s) || /^[\w.\-]{3,80}$/.test(s);

export function normalizePayments(input: PaymentsInput): { payments: StoreBlueprint["payments"]; warnings: string[] } {
  const warnings: string[] = [];

  const vfRaw = str(input.vodafoneCash);
  const vfNumber = normalizePhoneField(vfRaw);
  if (vfRaw && !vfNumber) warnings.push(`رقم فودافون كاش غير صالح فتم تعطيله: "${cap(vfRaw, 30)}"`);

  const ipRaw = str(input.instapay);
  const ipNumber = normalizePhoneField(ipRaw);
  const ipAddress = !ipNumber && ipRaw && looksLikeInstapayAddress(ipRaw) ? cap(ipRaw, 80) : undefined;
  if (ipRaw && !ipNumber && !ipAddress) warnings.push(`عنوان إنستاباي غير مفهوم فتم تعطيله: "${cap(ipRaw, 30)}"`);

  let codEnabled = input.cod !== false;
  if (!codEnabled && !vfNumber && !ipNumber && !ipAddress) {
    codEnabled = true;
    warnings.push("لا توجد أي وسيلة دفع صالحة، تم تفعيل الدفع عند الاستلام تلقائيًا");
  }

  const payments: StoreBlueprint["payments"] = {
    cod: { enabled: codEnabled, note: optCap(input.codNote, 160) },
    vodafoneCash: { enabled: !!vfNumber, number: vfNumber, holderName: optCap(input.vodafoneHolderName, 60) },
    instapay: { enabled: !!(ipNumber || ipAddress), number: ipNumber, address: ipAddress, holderName: optCap(input.instapayHolderName, 60) },
    requireTransferProof: input.requireTransferProof ?? true,
    transferInstructions: optCap(input.transferInstructions, 400),
  };
  return { payments, warnings };
}

/* =====================================================================
 *  4) القنوات
 *  قنوات الاستقبال (بوت Colapia) هي Meta فقط، أما قنوات متجر التاجر فتشمل رقم واتساب التاجر
 *  إن طلبه صراحة في المحادثة (زر التواصل المباشر داخل متجره).
 * ===================================================================== */
export type ChannelsInput = {
  phone?: unknown;
  whatsappNumber?: unknown;
  instagramUsername?: unknown;
  messengerPageUsername?: unknown;
  facebookUrl?: unknown;
  tiktokUsername?: unknown;
  email?: unknown;
};

const username = (v: unknown) => {
  const s = str(v).replace(/\s+/g, "");
  if (!s) return undefined;
  const m = s.match(/(?:instagram\.com|tiktok\.com|facebook\.com|m\.me)\/@?([^/?#]+)/i);
  const u = (m?.[1] ?? s).replace(/^@+/, "");
  return u ? cap(u, 80) : undefined;
};

const httpsUrl = (v: unknown) => {
  const s = str(v);
  if (!s) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch { return undefined; }
};

const emailAddr = (v: unknown) => {
  const s = str(v).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? cap(s, 120) : undefined;
};

const pageFromFacebookUrl = (url?: string) => {
  const m = url?.match(/facebook\.com\/([^/?#]+)/i)?.[1];
  if (!m || /^(profile\.php|people|pages|groups|share|photo|watch)$/i.test(m)) return undefined;
  return cap(m.replace(/^@+/, ""), 80);
};

export function normalizeChannels(input: ChannelsInput): { channels: StoreBlueprint["channels"]; warnings: string[] } {
  const warnings: string[] = [];
  const phoneRaw = str(input.phone);
  const phone = normalizePhoneField(phoneRaw);
  if (phoneRaw && !phone) warnings.push(`رقم التواصل غير صالح فتم إسقاطه: "${cap(phoneRaw, 30)}"`);

  const waRaw = str(input.whatsappNumber);
  const whatsappNumber = normalizePhoneField(waRaw);
  if (waRaw && !whatsappNumber) warnings.push(`رقم الواتساب غير صالح فتم إسقاطه: "${cap(waRaw, 30)}"`);

  const facebookUrl = httpsUrl(input.facebookUrl);
  const channels: StoreBlueprint["channels"] = {
    messengerPageUsername: username(input.messengerPageUsername) ?? pageFromFacebookUrl(facebookUrl),
    instagramUsername: username(input.instagramUsername),
    facebookUrl,
    tiktokUsername: username(input.tiktokUsername),
    phone,
    whatsappNumber,
    email: emailAddr(input.email),
  };
  return { channels, warnings };
}
