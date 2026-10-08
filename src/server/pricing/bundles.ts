// bundles.ts — خصم الطقم يُحسب من الـ Blueprint لا من السعر الذي أرسله المتصفح.
// لكل قسم طقم في السلة: عدد الأطقم المكتملة = أقل كمية بين منتجاته، ويُخصم نصيب كل منتج على هذه الأطقم فقط.
import type { StoreBlueprint } from "@/blueprint/schema";

type Line = { p: { id: string; slug: string }; v?: unknown; unit: number; total: number };
type Item = { productId: string; variantId?: string; qty: number; bundleId?: string };

export function applyBundleDiscounts(lines: Line[], input: Item[], bp: Pick<StoreBlueprint, "home">): void {
  const byBundle = new Map<string, Map<string, number>>();
  for (const i of input) {
    if (!i.bundleId || i.variantId) continue;
    const m = byBundle.get(i.bundleId) ?? new Map<string, number>();
    m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty);
    byBundle.set(i.bundleId, m);
  }
  for (const [bundleId, qtys] of byBundle) {
    const sec = bp.home.find((s) => s.type === "bundle" && s.id === bundleId);
    if (!sec || sec.type !== "bundle") continue;
    const setLines = sec.productSlugs.map((slug) => lines.find((l) => l.p.slug === slug && !l.v));
    if (setLines.some((l) => !l)) continue;
    const sets = Math.min(...setLines.map((l) => qtys.get(l!.p.id) ?? 0));
    if (sets <= 0) continue;
    for (const l of setLines) l!.total -= Math.round((l!.unit * sec.bundleDiscountPercent) / 100) * sets;
  }
}
