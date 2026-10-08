// links.ts — تحويل LinkTarget في Blueprint إلى href فعلي.
//
// السبب الجذري لإصلاح "تواصل معنا":
// النسخة السابقة كانت ترجع `/#contact`، لكن القسم الـ contact في الرئيسية
// لا يُصيَّر دائماً بـ id="contact" (يعتمد على block implementation). الآن
// نوجّه إلى `/pages/contact` كصفحة حقيقية، مع fallback آمن إلى الرئيسية إن
// لم تكن الصفحة موجودة. كذلك type="section" يُصيَّر إلى `/#{sectionId}` كما
// هو، ويفترض أن block الرئيسية يضع id على القسم.
import type { LinkTarget } from "@/blueprint/schema";

export function hrefFor(t: LinkTarget | undefined): string {
  if (!t) return "/";
  switch (t.type) {
    case "home":
      return "/";
    case "all_products":
      return "/search";
    case "category":
      return `/c/${encodeURIComponent(t.slug)}`;
    case "product":
      return `/p/${encodeURIComponent(t.slug)}`;
    case "page":
      return `/pages/${encodeURIComponent(t.slug)}`;
    case "section":
      return `/#${encodeURIComponent(t.sectionId)}`;
    case "contact":
      // صفحة حقيقية بدل hash قد لا يوجد له anchor.
      return "/pages/contact";
    case "external":
      return t.url;
  }
}