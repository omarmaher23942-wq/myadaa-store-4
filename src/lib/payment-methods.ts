// payment-methods.ts — وسائل الدفع كما يراها العميل في صفحة الدفع (الاسم والوصف ورقم التحويل). مصدر واحد للمتجر
// ولمعاينة «كما تظهر للعميل» في إعدادات اللوحة.
import type { StoreBlueprint } from "@/blueprint/schema";

export type PaymentMethodView = { id: "cod" | "vodafone_cash" | "instapay"; label: string; desc: string; targetNumber?: string };

export function paymentMethods(p: StoreBlueprint["payments"]): PaymentMethodView[] {
  const out: PaymentMethodView[] = [];
  if (p.cod.enabled)
    out.push({
      id: "cod",
      label: "الدفع عند الاستلام كاش",
      desc: "ادفع كاش للمندوب عند الاستلام",
    });
  if (p.vodafoneCash.enabled)
    out.push({
      id: "vodafone_cash",
      label: "فودافون كاش / محافظ إلكترونية",
      desc: p.vodafoneCash.number
        ? `حوّل على ${p.vodafoneCash.number}${p.vodafoneCash.holderName ? ` (باسم ${p.vodafoneCash.holderName})` : ""}`
        : "تحويل فودافون كاش",
      targetNumber: p.vodafoneCash.number,
    });
  if (p.instapay.enabled)
    out.push({
      id: "instapay",
      label: "إنستاباي (InstaPay)",
      desc:
        p.instapay.address ?? p.instapay.number
          ? `حوّل على ${p.instapay.address ?? p.instapay.number}${p.instapay.holderName ? ` (باسم ${p.instapay.holderName})` : ""}`
          : "تحويل إنستاباي",
      targetNumber: p.instapay.address ?? p.instapay.number,
    });
  return out;
}
