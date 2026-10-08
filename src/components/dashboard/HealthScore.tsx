// HealthScore — قائمة تحقق من اكتمال المتجر.
// - كل عنصر قابل للنقر → ينقل التاجر مباشرة.
// - النسبة تُحسب من عدد العناصر المكتملة.
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  Package,
  FileText,
  MessageCircle,
  CreditCard,
  Gift,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react";
import type { StoreBlueprint } from "@/blueprint/schema";

const SW = 1.75;

type Check = {
  ok: boolean;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

export function HealthScore({
  bp,
  productCount,
  hasLogo,
  hasOrders,
}: {
  bp: StoreBlueprint;
  productCount: number;
  hasLogo: boolean;
  hasOrders: boolean;
}) {
  const hasHeroImage = bp.home.some(
    (s) =>
      s.type === "hero" &&
      s.enabled &&
      "images" in s &&
      Array.isArray(s.images) &&
      s.images.length > 0
  );

  const hasReturnPolicy = bp.pages.some(
    (p) => p.slug === "returns" && p.body.length > 80
  );

  const hasContact = Boolean(
    (bp.channels as { whatsappNumber?: string }).whatsappNumber ||
      (bp.channels as { phone?: string }).phone
  );

  const hasPayment =
    bp.payments.cod.enabled ||
    bp.payments.vodafoneCash.enabled ||
    bp.payments.instapay.enabled;

  const hasExitOffer =
    bp.conversion.exitIntentOffer.enabled &&
    Boolean(bp.conversion.exitIntentOffer.couponCode);

  const checks: Check[] = [
    { ok: hasLogo, label: "أضف شعار المتجر", href: "/dashboard/design", icon: ImageIcon },
    {
      ok: productCount >= 5,
      label: `أضف 5 منتجات على الأقل (${productCount}/5)`,
      href: "/dashboard/products",
      icon: Package,
    },
    { ok: hasHeroImage, label: "أضف صورة للواجهة الرئيسية", href: "/dashboard/design", icon: ImageIcon },
    { ok: hasReturnPolicy, label: "اكتب سياسة الاستبدال", href: "/dashboard/content", icon: FileText },
    { ok: hasContact, label: "أضف وسيلة تواصل", href: "/dashboard/settings", icon: MessageCircle },
    { ok: hasPayment, label: "فعّل طريقة دفع", href: "/dashboard/settings", icon: CreditCard },
    { ok: hasExitOffer, label: "فعّل عرض الخروج بكود خصم", href: "/dashboard/discounts", icon: Gift },
    { ok: hasOrders, label: "أول طلب — شارك رابط متجرك", href: "/dashboard/settings", icon: ShoppingBag },
  ];

  const doneCount = checks.filter((c) => c.ok).length;
  const pct = Math.round((doneCount / checks.length) * 100);

  return (
    <div className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-ink">صحة المتجر</h2>
        <span
          className={
            pct === 100
              ? "font-mono text-2xl font-black text-emerald-600 dark:text-emerald-300"
              : pct >= 60
                ? "font-mono text-2xl font-black text-nova-2"
                : "font-mono text-2xl font-black text-amber-700 dark:text-amber-300"
          }
        >
          {pct}%
        </span>
      </div>

      <div className="my-3 h-2 overflow-hidden rounded-full bg-edge/[0.06]">
        <div
          className={
            pct === 100
              ? "h-full bg-emerald-400 transition-all duration-500"
              : "h-full bg-gradient-to-r from-nova to-aurora transition-all duration-500"
          }
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-2">
        {checks.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.label}>
              <Link
                href={c.href}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 text-[12px] transition-colors hover:bg-edge/[0.04]"
              >
                {c.ok ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="size-4 shrink-0 text-ink-3/60"
                    strokeWidth={SW}
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={
                    c.ok
                      ? "size-3.5 shrink-0 text-ink-3/60 line-through"
                      : "size-3.5 shrink-0 text-nova-2"
                  }
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                <span
                  className={
                    c.ok
                      ? "line-through opacity-50"
                      : "font-bold text-ink"
                  }
                >
                  {c.label}
                </span>
                {!c.ok ? (
                  <ArrowLeft
                    className="ms-auto size-3.5 shrink-0 text-nova-2"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}