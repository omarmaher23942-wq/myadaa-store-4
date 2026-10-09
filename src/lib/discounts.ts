// discounts.ts — منطق أكواد الخصم المشترك بين اللوحة والخادم: حالة الكود الآن، ووصفه بجملة يفهمها التاجر كما سيعيشها
// العميل، واقتراح كود. نفس شروط الدفع (checkout.ts: validateDiscount).
import { fmtNum } from "@/lib/format";

export type DiscountType = "percentage" | "fixed" | "free_shipping";
export type DiscountShape = {
  code: string;
  type: DiscountType;
  /** نسبة (1-100) أو مبلغ بالقروش. */
  value: number;
  minSubtotalPiasters: number | null;
  maxUses: number | null;
  usedCount: number;
  perCustomerLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export type DiscountState = "active" | "paused" | "scheduled" | "expired" | "exhausted";

export const DISCOUNT_STATE: Record<DiscountState, { label: string; tone: "ok" | "muted" | "nova" | "bad" | "warn" }> = {
  active: { label: "يعمل الآن", tone: "ok" },
  paused: { label: "موقوف", tone: "muted" },
  scheduled: { label: "يبدأ لاحقاً", tone: "nova" },
  expired: { label: "انتهى", tone: "bad" },
  exhausted: { label: "نفدت مرات استخدامه", tone: "warn" },
};

export function discountState(d: Pick<DiscountShape, "isActive" | "startsAt" | "endsAt" | "maxUses" | "usedCount">, now = Date.now()): DiscountState {
  if (!d.isActive) return "paused";
  if (d.endsAt && Date.parse(d.endsAt) < now) return "expired";
  if (d.maxUses && d.usedCount >= d.maxUses) return "exhausted";
  if (d.startsAt && Date.parse(d.startsAt) > now) return "scheduled";
  return "active";
}

const egp = (p: number) => `${fmtNum(p / 100)} ج.م`;

export function discountValueLabel(d: Pick<DiscountShape, "type" | "value">): string {
  if (d.type === "percentage") return `خصم ${fmtNum(d.value)}%`;
  if (d.type === "fixed") return `خصم ${egp(d.value)}`;
  return "شحن مجاني";
}

const cairo = (iso: string) =>
  new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(new Date(iso));

/** جملة الشروط كما يعيشها العميل: «على طلب من 300 ج.م أو أكثر · مرة واحدة لكل موبايل · حتى 15 أكتوبر 11:59 م». */
export function discountConditions(d: Pick<DiscountShape, "minSubtotalPiasters" | "perCustomerLimit" | "maxUses" | "startsAt" | "endsAt">): string[] {
  const out: string[] = [];
  if (d.minSubtotalPiasters) out.push(`على طلب من ${egp(d.minSubtotalPiasters)} أو أكثر`);
  if (d.perCustomerLimit === 1) out.push("مرة واحدة لكل رقم موبايل");
  else if (d.perCustomerLimit) out.push(`${fmtNum(d.perCustomerLimit)} مرات لكل رقم موبايل`);
  if (d.maxUses) out.push(`لأول ${fmtNum(d.maxUses)} طلب`);
  if (d.startsAt && Date.parse(d.startsAt) > Date.now()) out.push(`يبدأ ${cairo(d.startsAt)}`);
  if (d.endsAt) out.push(`حتى ${cairo(d.endsAt)}`);
  return out;
}

/** كود مقترح سهل القراءة والكتابة (بلا 0/O و1/I). */
export function suggestCode(prefix = "SAVE"): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tail = "";
  const r = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(4)) : Uint8Array.from({ length: 4 }, () => Math.floor(Math.random() * 256));
  for (const b of r) tail += abc[b % abc.length];
  return `${prefix}${tail}`.slice(0, 20);
}
