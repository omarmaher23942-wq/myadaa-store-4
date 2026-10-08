/** كل الأموال تُخزن بالقروش (integer). 1 جنيه = 100 قرش. */
const finite = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

export const toPiasters = (egp: number) => Math.round(finite(egp) * 100);
export const toEgp = (piasters: number) => finite(piasters) / 100;

const FMT_INT = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0, numberingSystem: "latn" });
const FMT_FRAC = new Intl.NumberFormat("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2, numberingSystem: "latn" });

/** تنسيق عربي مصري: "1,250 ج.م" (بدون كسور إن كانت صفرًا لتقليل الاحتكاك). قيمة غير صالحة تُعرض صفرًا لا NaN */
export function formatEgp(piasters: number, opts: { withSymbol?: boolean } = {}) {
  const p = Math.round(finite(piasters));
  const formatted = (p % 100 !== 0 ? FMT_FRAC : FMT_INT).format(p / 100);
  return opts.withSymbol === false ? formatted : `${formatted} ج.م`;
}

/** نسبة التوفير لعرض "وفّر 30%" */
export function savingsPercent(price: number, compareAt?: number | null) {
  const pr = finite(price);
  const ca = finite(compareAt ?? 0);
  if (!ca || ca <= pr) return 0;
  return Math.round(((ca - pr) / ca) * 100);
}
