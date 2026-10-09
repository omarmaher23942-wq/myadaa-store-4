import "server-only";
// order-notify.ts — يُبلغ العميل بكل تغيير مهم في حالة طلبه على بريده (إن كتبه عند الطلب)، بلا حساب.
// البريد يحمل رابط «طلباتي» على نفس المتجر. يعمل في الخلفية ولا يؤخر حفظ الحالة.
import { getBlueprint } from "@/lib/tenant";
import { sendCustomerOrderShippedEmail, sendEmail } from "@/lib/email";
import { storeUrl } from "@/lib/utils";
import { reviewToken } from "@/lib/order-access";

type Order = { id?: string; code: string; customerName: string; customerEmail: string | null; trackingNumber?: string | null; courierName?: string | null };

const MESSAGE: Partial<Record<string, { subject: (c: string) => string; headline: string; body: string }>> = {
  confirmed: { subject: (c) => `تم تأكيد طلبك ${c}`, headline: "طلبك تأكّد", body: "أكدنا طلبك وبدأنا تجهيزه، وهنبلغك أول ما يخرج للشحن." },
  preparing: { subject: (c) => `طلبك ${c} قيد التجهيز`, headline: "بنجهّز طلبك", body: "طلبك قيد التجهيز والتغليف الآن." },
  delivered: { subject: (c) => `تم توصيل طلبك ${c}`, headline: "وصل طلبك", body: "نتمنى يعجبك. رأيك في المنتجات يساعد غيرك يختار، ولو عندك أي ملاحظة كلمنا في أي وقت." },
  cancelled: { subject: (c) => `تم إلغاء طلبك ${c}`, headline: "تم إلغاء طلبك", body: "تم إلغاء الطلب. لو ده غير مقصود أو عندك سؤال، تواصل معنا." },
};

export async function notifyCustomerOfStatus(store: { id: string; subdomain: string }, order: Order, status: string): Promise<void> {
  if (!order.customerEmail) return;
  const bp = await getBlueprint(store.id);
  const trackUrl = storeUrl(store.subdomain, `/track?code=${encodeURIComponent(order.code)}`);
  if (status === "shipped") {
    await sendCustomerOrderShippedEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      storeName: bp.brand.name,
      storeSubdomain: store.subdomain,
      storeId: store.id,
      orderCode: order.code,
      trackingNumber: order.trackingNumber ?? "",
      courierName: order.courierName ?? "",
      trackingUrl: trackUrl,
      logoUrl: bp.brand.logo?.url,
      primaryColor: bp.theme.palette.primary,
    });
    return;
  }
  const m = MESSAGE[status];
  if (!m) return;
  // بعد التسليم: زر «قيّم مشترياتك» برابط موقّع يفتح تقييم هذا الطلب من أي جهاز.
  const reviewUrl = status === "delivered" && order.id ? storeUrl(store.subdomain, `/review?o=${encodeURIComponent(order.code)}&t=${reviewToken(store.id, order.id)}`) : null;
  await sendEmail({
    to: order.customerEmail,
    subject: m.subject(order.code),
    headline: m.headline,
    storeName: bp.brand.name,
    paragraphs: [`أهلاً ${order.customerName.split(" ")[0]}،`, m.body, `رقم طلبك: ${order.code}`],
    buttons: reviewUrl ? [{ title: "قيّم مشترياتك", url: reviewUrl }, { title: "تابع طلبك", url: trackUrl }] : [{ title: "تابع طلبك", url: trackUrl }],
  });
}
