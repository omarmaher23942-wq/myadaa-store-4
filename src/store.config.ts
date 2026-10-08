// store.config.ts — هوية متجرك (مولّد من Colapia عند استلام متجرك).
// لا يحتوي أي مفتاح سري؛ مفاتيحك تُحفظ في قاعدة بياناتك أنت من لوحة التحكم.
export const STORE = {
  name: "ميادة فاشون",
  subdomain: "myadaa",
  /** المنصة التي استُلم منها المتجر (للاستلام الأول فقط من صفحة /setup). */
  importFrom: "https://colapia.com",
  generatedAt: "2026-10-08T20:40:18.227Z",
} as const;
