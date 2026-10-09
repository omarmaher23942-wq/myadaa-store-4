// store-settings.ts — قواعد إعدادات المتجر التشغيلية (الدفع والتواصل ووضع الإجازة): نفس الدالة تتحقق في المتصفح
// (رسالة عند الحقل نفسه) وعلى الخادم (saveStoreSettingsAction)، وتطبّع الأرقام (٠١٠، +20، مسافات) والحسابات (@، روابط).
import { normalizeEgyptianPhone } from "./phone";

export type SettingsDraft = {
  cod: boolean;
  vodafone: { enabled: boolean; number: string; holder: string };
  instapay: { enabled: boolean; target: string; holder: string };
  requireTransferProof: boolean;
  transferInstructions: string;
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  facebook: string;
  acceptingOrders: boolean;
  vacationMessage: string;
};

export type SettingsField =
  | "payments"
  | "vodafone.number"
  | "vodafone.holder"
  | "instapay.target"
  | "instapay.holder"
  | "transferInstructions"
  | "whatsapp"
  | "phone"
  | "email"
  | "instagram"
  | "facebook"
  | "vacationMessage";

export const SETTINGS_LIMITS = { holder: 60, instructions: 400, vacation: 160 } as const;

/** الترتيب الذي ينتقل به التركيز لأول خطأ. */
export const SETTINGS_FIELD_ORDER: SettingsField[] = ["payments", "vodafone.number", "vodafone.holder", "instapay.target", "instapay.holder", "transferInstructions", "whatsapp", "phone", "email", "instagram", "facebook", "vacationMessage"];

const IPA = /^[a-z0-9][a-z0-9._-]{0,39}@instapay$/i;

/** حساب إنستاجرام من أي شكل: @name أو name أو رابط الحساب. */
export function cleanInstagram(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "";
  const fromUrl = /instagram\.com\/([^/?#\s]+)/i.exec(t)?.[1];
  const u = (fromUrl ?? t).replace(/^@+/, "").trim();
  return /^[a-z0-9._]{1,30}$/i.test(u) ? u.toLowerCase() : null;
}

/** رابط صفحة فيسبوك (https، على facebook.com أو fb.com). */
export function cleanFacebook(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "";
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (!/(^|\.)(facebook\.com|fb\.com)$/i.test(u.hostname) || u.pathname.length < 2) return null;
    u.protocol = "https:";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** الرقم أو عنوان إنستاباي (name@instapay). */
export function cleanInstapay(raw: string): { number?: string; address?: string } | null {
  const t = raw.trim();
  if (!t) return {};
  if (IPA.test(t)) return { address: t.toLowerCase() };
  const n = normalizeEgyptianPhone(t);
  return n ? { number: n } : null;
}

export type CleanSettings = {
  payments: {
    cod: { enabled: boolean };
    vodafoneCash: { enabled: boolean; number?: string; holderName?: string };
    instapay: { enabled: boolean; address?: string; number?: string; holderName?: string };
    requireTransferProof: boolean;
    transferInstructions?: string;
  };
  channels: { whatsappNumber?: string; phone?: string; email?: string; instagramUsername?: string; facebookUrl?: string };
  ops: { acceptingOrders: boolean; vacationMessage: string };
};

/** يتحقق ويطبّع. أخطاء بالحقل ورسالة عربية، أو قيم نظيفة جاهزة للحفظ. */
export function validateSettings(d: SettingsDraft): { ok: true; data: CleanSettings } | { ok: false; errors: Partial<Record<SettingsField, string>> } {
  const e: Partial<Record<SettingsField, string>> = {};
  if (!d.cod && !d.vodafone.enabled && !d.instapay.enabled) e.payments = "فعّل وسيلة دفع واحدة على الأقل، وإلا لن يستطيع أحد الطلب";

  const vf = d.vodafone.number.trim() ? normalizeEgyptianPhone(d.vodafone.number) : null;
  if (d.vodafone.enabled && !d.vodafone.number.trim()) e["vodafone.number"] = "اكتب رقم المحفظة الذي يحوّل عليه العميل";
  else if (d.vodafone.number.trim() && !vf) e["vodafone.number"] = "رقم موبايل مصري من 11 رقماً يبدأ بـ 01";

  const ip = cleanInstapay(d.instapay.target);
  if (d.instapay.enabled && !d.instapay.target.trim()) e["instapay.target"] = "اكتب رقمك أو عنوانك على إنستاباي (مثل name@instapay)";
  else if (ip === null) e["instapay.target"] = "رقم موبايل مصري أو عنوان بصيغة name@instapay";

  if (d.vodafone.holder.trim().length > SETTINGS_LIMITS.holder) e["vodafone.holder"] = `الاسم ${SETTINGS_LIMITS.holder} حرفاً على الأكثر`;
  if (d.instapay.holder.trim().length > SETTINGS_LIMITS.holder) e["instapay.holder"] = `الاسم ${SETTINGS_LIMITS.holder} حرفاً على الأكثر`;
  if (d.transferInstructions.trim().length > SETTINGS_LIMITS.instructions) e.transferInstructions = `التعليمات ${SETTINGS_LIMITS.instructions} حرفاً على الأكثر`;

  const wa = d.whatsapp.trim() ? normalizeEgyptianPhone(d.whatsapp) : "";
  if (wa === null) e.whatsapp = "رقم موبايل مصري من 11 رقماً يبدأ بـ 01";
  const ph = d.phone.trim() ? normalizeEgyptianPhone(d.phone) : "";
  if (ph === null) e.phone = "رقم موبايل مصري من 11 رقماً يبدأ بـ 01";
  const email = d.email.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "البريد غير صحيح";
  const ig = cleanInstagram(d.instagram);
  if (ig === null) e.instagram = "اسم الحساب فقط (حروف إنجليزية وأرقام و . و _) أو رابط الحساب";
  const fb = cleanFacebook(d.facebook);
  if (fb === null) e.facebook = "رابط صفحتك على فيسبوك (facebook.com/...)";

  const vacation = d.vacationMessage.trim();
  if (vacation.length > SETTINGS_LIMITS.vacation) e.vacationMessage = `الرسالة ${SETTINGS_LIMITS.vacation} حرفاً على الأكثر`;

  if (Object.keys(e).length) return { ok: false, errors: e };
  const opt = (v: string | null | undefined) => (v ? v : undefined);
  return {
    ok: true,
    data: {
      payments: {
        cod: { enabled: d.cod },
        vodafoneCash: { enabled: d.vodafone.enabled, number: opt(vf), holderName: opt(d.vodafone.holder.trim()) },
        instapay: { enabled: d.instapay.enabled, address: ip?.address, number: ip?.number, holderName: opt(d.instapay.holder.trim()) },
        requireTransferProof: d.requireTransferProof,
        transferInstructions: opt(d.transferInstructions.trim()),
      },
      channels: { whatsappNumber: opt(wa), phone: opt(ph), email: opt(email), instagramUsername: opt(ig), facebookUrl: opt(fb) },
      ops: { acceptingOrders: d.acceptingOrders, vacationMessage: vacation },
    },
  };
}

/** مسودة الصفحة من الإعدادات المحفوظة. */
export function draftFrom(
  bp: { payments: { cod: { enabled: boolean }; vodafoneCash: { enabled: boolean; number?: string; holderName?: string }; instapay: { enabled: boolean; address?: string; number?: string; holderName?: string }; requireTransferProof: boolean; transferInstructions?: string }; channels: { whatsappNumber?: string; phone?: string; email?: string; instagramUsername?: string; facebookUrl?: string } },
  ops: { acceptingOrders: boolean; vacationMessage: string | null }
): SettingsDraft {
  const p = bp.payments;
  const c = bp.channels;
  return {
    cod: p.cod.enabled,
    vodafone: { enabled: p.vodafoneCash.enabled, number: p.vodafoneCash.number ?? "", holder: p.vodafoneCash.holderName ?? "" },
    instapay: { enabled: p.instapay.enabled, target: p.instapay.address ?? p.instapay.number ?? "", holder: p.instapay.holderName ?? "" },
    requireTransferProof: p.requireTransferProof,
    transferInstructions: p.transferInstructions ?? "",
    whatsapp: c.whatsappNumber ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    instagram: c.instagramUsername ?? "",
    facebook: c.facebookUrl ?? "",
    acceptingOrders: ops.acceptingOrders,
    vacationMessage: ops.vacationMessage ?? "",
  };
}
