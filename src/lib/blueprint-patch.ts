// blueprint-patch.ts — حفظ «ما تغيّر فقط» في إعدادات المتجر (Blueprint). كل صفحة في اللوحة تعدّل جزءاً منها، فلو حفظت
// الصفحة نسختها الكاملة لمسحت ما حُفظ من صفحة أخرى بعد فتحها. بدلاً من ذلك: نحسب المسارات التي تغيّرت بين نسخة الفتح
// ونسخة التاجر (حتى عمق 2: «conversion.urgency» مثلاً)، ونطبّقها وحدها على النسخة الحالية في الخادم.
export type BpChange = { path: [string] | [string, string]; value: unknown };

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/**
 * تمثيل نصي لا يتأثر بترتيب المفاتيح: النسخة القادمة من القاعدة (jsonb يعيد ترتيب المفاتيح) والنسخة التي أعادها الحفظ
 * متطابقتان في المحتوى ومختلفتان في الترتيب، فالمقارنة بـ JSON.stringify وحده تخطئ.
 */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    isPlain(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x
  );
}
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

/** المسارات التي تغيّرت من base إلى next (المصفوفات تُقارن كاملة: ترتيب الأقسام مثلاً تغيير واحد). */
export function diffBlueprint(base: Record<string, unknown>, next: Record<string, unknown>): BpChange[] {
  const out: BpChange[] = [];
  for (const k of new Set([...Object.keys(base), ...Object.keys(next)])) {
    const a = base[k];
    const b = next[k];
    if (same(a, b)) continue;
    if (isPlain(a) && isPlain(b)) {
      for (const k2 of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!same(a[k2], b[k2])) out.push({ path: [k, k2], value: b[k2] });
      }
    } else {
      out.push({ path: [k], value: b });
    }
  }
  return out;
}

/** يطبّق التغييرات على نسخة جديدة من target (لا يعدّل الأصل). القيمة undefined تحذف المفتاح. */
export function applyChanges<T extends Record<string, unknown>>(target: T, changes: BpChange[]): T {
  const out: Record<string, unknown> = { ...target };
  for (const { path, value } of changes) {
    const [k, k2] = path;
    if (k2 === undefined) {
      if (value === undefined) delete out[k];
      else out[k] = value;
      continue;
    }
    const inner = isPlain(out[k]) ? { ...(out[k] as Record<string, unknown>) } : {};
    if (value === undefined) delete inner[k2];
    else inner[k2] = value;
    out[k] = inner;
  }
  return out as T;
}
