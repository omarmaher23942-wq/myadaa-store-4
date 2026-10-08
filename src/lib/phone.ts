/**
 * أرقام الموبايل المصرية: 010 / 011 / 012 / 015 + 8 أرقام.
 * نقبل الصيغ: 01012345678، 1012345678، +201012345678، 00201012345678، 201012345678،
 * و +2001012345678 / 2001012345678 (شائعة عند النسخ من جهات الاتصال)، مع مسافات أو شرطات أو أقواس،
 * وأرقامًا عربية (٠١٠) أو فارسية (۰۱۰)، ونحولها كلها إلى الصيغة القياسية 01XXXXXXXXX.
 */
const PHONE_RE = /^01[0125]\d{8}$/;

export function normalizeDigits(input: string) {
  return String(input ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizeEgyptianPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let s = normalizeDigits(raw).replace(/[^\d+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/\+/g, "");
  if (s.startsWith("0020")) s = s.slice(4);
  else if (s.startsWith("20") && (s.length === 12 || (s.length === 13 && s[2] === "0"))) s = s.slice(2);
  if (s.length === 10 && s.startsWith("1")) s = "0" + s;
  return PHONE_RE.test(s) ? s : null;
}

export const isEgyptianPhone = (raw: string) => normalizeEgyptianPhone(raw) !== null;

/** شكل مقروء: 010 1234 5678 */
export function prettyPhone(phone: string) {
  return String(phone ?? "").replace(/^(\d{3})(\d{4})(\d{4})$/, "$1 $2 $3");
}
