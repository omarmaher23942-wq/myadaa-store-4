// order-messages.ts — رسائل جاهزة يرسلها التاجر لعميله على واتساب حسب حالة الطلب، ونص بيانات الشحن
// لنسخه في نظام شركة الشحن. نصوص قصيرة مهذبة يعدّلها التاجر في واتساب قبل الإرسال.
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";

export type MessageOrder = {
  code: string;
  customerName: string;
  customerPhone: string;
  customerAltPhone?: string | null;
  governorate: string;
  city?: string | null;
  address: string;
  landmark?: string | null;
  totalPiasters: number;
  paymentMethod: string;
  paymentStatus: string;
  courierName?: string | null;
  trackingNumber?: string | null;
  /** رابط «قيّم مشترياتك» الموقّع (للطلب المُسلَّم فقط). */
  reviewUrl?: string | null;
};

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** المبلغ الذي يحصّله المندوب: الإجمالي لطلب الدفع عند الاستلام، وصفر لطلب مدفوع مسبقاً. */
export function amountToCollect(o: Pick<MessageOrder, "paymentMethod" | "paymentStatus" | "totalPiasters">): number {
  return o.paymentMethod === "cod" && o.paymentStatus !== "confirmed" ? o.totalPiasters : 0;
}

/** ما يُكتب للمندوب عن التحصيل، بصدق حسب حالة الدفع. */
export function collectNote(o: Pick<MessageOrder, "paymentMethod" | "paymentStatus" | "totalPiasters">): { text: string; tone: "warn" | "ok" | "bad" } {
  const collect = amountToCollect(o);
  if (collect > 0) return { text: formatEgp(collect), tone: "warn" };
  if (o.paymentMethod === "cod") return { text: "لا شيء (حُصّل المبلغ)", tone: "ok" };
  if (o.paymentStatus === "confirmed") return { text: "لا شيء (مدفوع بالتحويل)", tone: "ok" };
  if (o.paymentStatus === "rejected") return { text: "لا شيء، لكن التحويل لم يصل: لا تشحن قبل الدفع", tone: "bad" };
  return { text: "لا شيء (التحويل بانتظار تأكيدك)", tone: "warn" };
}

export type MessageKind = "confirm" | "preparing" | "shipped" | "delivered" | "cancelled" | "payment_rejected" | "general";

export function messageKindFor(status: string, paymentStatus: string): MessageKind {
  if (paymentStatus === "rejected" && status !== "cancelled") return "payment_rejected";
  switch (status) {
    case "new":
      return "confirm";
    case "confirmed":
    case "preparing":
      return "preparing";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      return "general";
  }
}

export const MESSAGE_LABEL: Record<MessageKind, string> = {
  confirm: "تأكيد الطلب والعنوان",
  preparing: "طلبك قيد التجهيز",
  shipped: "طلبك خرج للشحن",
  delivered: "شكر وطلب تقييم",
  cancelled: "بخصوص إلغاء الطلب",
  payment_rejected: "التحويل لم يصل",
  general: "رسالة عن الطلب",
};

export function orderMessage(kind: MessageKind, o: MessageOrder, storeName: string): string {
  const hi = `أهلاً ${first(o.customerName)}، معك ${storeName}.`;
  const where = [o.address, o.city, governorateName(o.governorate)].filter(Boolean).join("، ");
  const collect = amountToCollect(o);
  switch (kind) {
    case "confirm":
      return `${hi} استلمنا طلبك ${o.code} بقيمة ${formatEgp(o.totalPiasters)}. نرجو تأكيد العنوان: ${where}. هل البيانات صحيحة لنبدأ التجهيز؟`;
    case "preparing":
      return `${hi} تأكد طلبك ${o.code} ونجهّزه الآن، وسنبلغك فور خروجه للشحن.`;
    case "shipped": {
      const via = o.courierName ? ` مع ${o.courierName}` : "";
      const track = o.trackingNumber ? ` رقم الشحنة: ${o.trackingNumber}.` : "";
      const pay = collect > 0 ? ` المبلغ المطلوب عند الاستلام: ${formatEgp(collect)}.` : " الطلب مدفوع، لا شيء مطلوب عند الاستلام.";
      return `${hi} طلبك ${o.code} خرج للشحن${via}.${track}${pay}`;
    }
    case "delivered":
      return o.reviewUrl
        ? `${hi} نتمنى أن يكون طلبك ${o.code} قد أعجبك. رأيك يهمنا ويساعد غيرك: قيّم مشترياتك في دقيقة من هنا ${o.reviewUrl}`
        : `${hi} نتمنى أن يكون طلبك ${o.code} قد أعجبك. رأيك يهمنا ويساعدنا نتحسن.`;
    case "cancelled":
      return `${hi} بخصوص طلبك ${o.code}: تم إلغاؤه. إن كان ذلك غير مقصود أو لديك أي سؤال فنحن هنا.`;
    case "payment_rejected":
      return `${hi} لم يصلنا تحويل طلبك ${o.code} بقيمة ${formatEgp(o.totalPiasters)}. أرسل لنا صورة الإيصال الصحيحة أو أعد التحويل، وسنؤكد طلبك فوراً.`;
    default:
      return `${hi} بخصوص طلبك ${o.code} بقيمة ${formatEgp(o.totalPiasters)}.`;
  }
}

/** بيانات الشحن كنص جاهز للصق في نظام شركة الشحن أو إرساله للمندوب. */
export function shippingLabelText(o: MessageOrder, storeName: string): string {
  const phones = [o.customerPhone, o.customerAltPhone].filter(Boolean).join(" / ");
  const collect = amountToCollect(o);
  return [
    `${storeName} — طلب ${o.code}`,
    `الاسم: ${o.customerName}`,
    `الموبايل: ${phones}`,
    `المحافظة: ${governorateName(o.governorate)}${o.city ? ` — ${o.city}` : ""}`,
    `العنوان: ${o.address}${o.landmark ? ` (علامة مميزة: ${o.landmark})` : ""}`,
    collect > 0 ? `المطلوب تحصيله: ${formatEgp(collect)}` : "لا تحصيل عند الاستلام",
  ].join("\n");
}
