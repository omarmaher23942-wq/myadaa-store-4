// notes.ts — «ملاحظات من أرقامك» في النظرة العامة: استنتاجات مباشرة من بيانات المتجر نفسها، كل منها
// بسبب واضح ورابط لمكان التصرف. لا نسب عامة من خارج المتجر ولا وعود بنتائج.
import { arCount, fmtNum, NOUN } from "@/lib/format";

export type NoteTone = "ok" | "warn" | "nova";
export type Note = { id: string; tone: NoteTone; title: string; body: string; action?: { label: string; href: string } };

export type NotesInput = {
  days: number;
  current: { orders: number; sales: number; visits: number };
  previous: { orders: number; sales: number; visits: number };
  topProduct: { name: string; qty: number } | null;
  viewedNotBought: { id: string; name: string; viewers: number } | null;
  silentRepeat: number;
  hasOrdersEver: boolean;
  /** رابط مشاركة المتجر (صفحة «متجري» على المنصة، أو جذر الموقع في مشروع التاجر). */
  shareHref: string;
};

const pct = (cur: number, prev: number) => Math.round(((cur - prev) / prev) * 100);
const periodName = (d: number) => (d === 7 ? "الأسبوع السابق" : d === 30 ? "الثلاثين يوماً السابقة" : `${fmtNum(d)} يوماً السابقة`);

export function buildNotes(i: NotesInput): Note[] {
  const notes: Note[] = [];

  if (!i.hasOrdersEver) {
    notes.push({
      id: "first-order",
      tone: "nova",
      title: "متجرك لم يستقبل طلبه الأول بعد",
      body: "أسرع طريق لأول طلب أن يصل رابط متجرك لمن يعرفك: حالة واتساب، وصفحتك على فيسبوك، وصفحة إنستجرام.",
      action: { label: "رابط متجرك ورمز QR", href: i.shareHref },
    });
  }

  // تغير المبيعات بفترة مقارنة فيها طلبات كافية، مع قراءة الزيارات لتحديد السبب.
  const { current: c, previous: p } = i;
  if (p.orders >= 3 && c.orders >= 1 && p.sales > 0) {
    const sales = pct(c.sales, p.sales);
    const visits = p.visits > 0 ? pct(c.visits, p.visits) : null;
    if (sales >= 15) {
      notes.push({
        id: "sales-up",
        tone: "ok",
        title: `مبيعاتك أعلى بـ ${fmtNum(sales)}% من ${periodName(i.days)}`,
        body: i.topProduct
          ? `أكثر ما بِيع: «${i.topProduct.name}» (${arCount(i.topProduct.qty, NOUN.piece)}).`
          : "تابع التفاصيل يوماً بيوم في التحليلات.",
        action: { label: "التحليلات", href: "/dashboard/analytics" },
      });
    } else if (sales <= -15) {
      const lessTraffic = visits !== null && visits <= -15;
      notes.push({
        id: "sales-down",
        tone: "warn",
        title: `مبيعاتك أقل بـ ${fmtNum(Math.abs(sales))}% من ${periodName(i.days)}`,
        body: lessTraffic
          ? `والزيارات أقل أيضاً بـ ${fmtNum(Math.abs(visits!))}%، فالسبب الأقرب قلة من يصل لمتجرك. شارك رابطه من جديد.`
          : "عدد الزيارات لم يقل بالقدر نفسه، فالزوار يصلون ولا يكملون الشراء. راجع مراحل الشراء في التحليلات (السعر، الشحن، صفحة الدفع).",
        action: lessTraffic ? { label: "رابط متجرك", href: i.shareHref } : { label: "مراحل الشراء", href: "/dashboard/analytics" },
      });
    }
  }

  if (i.viewedNotBought && i.viewedNotBought.viewers >= 20) {
    notes.push({
      id: "viewed-not-bought",
      tone: "warn",
      title: `«${i.viewedNotBought.name}» يُشاهَد ولا يُطلب`,
      body: `شاهده ${arCount(i.viewedNotBought.viewers, NOUN.visitor)} في هذه الفترة ولم يطلبه أحد. راجع سعره وصوره ووصفه وتوفر مقاساته.`,
      action: { label: "افتح المنتج", href: `/dashboard/products/${i.viewedNotBought.id}` },
    });
  }

  if (i.silentRepeat >= 2) {
    notes.push({
      id: "silent-repeat",
      tone: "nova",
      title: `${arCount(i.silentRepeat, NOUN.customer)} اشتروا منك أكثر من مرة ثم توقفوا`,
      body: "آخر طلب لهم منذ أكثر من شهرين. رسالة منك بجديد متجرك أو كود خصم خاص قد تعيدهم.",
      action: { label: "عرض العملاء", href: "/dashboard/customers?segment=at_risk" },
    });
  }

  return notes.slice(0, 3);
}
