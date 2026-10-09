// parts.tsx — أجزاء صغيرة مشتركة لقائمة الطلب ولوحة المراحل (بلا حالة؛ تعمل في الخادم والعميل).
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { orderStatusLabel, orderStatusTone, TONE_CHIP } from "@/lib/order-status";
import type { OrderRow } from "@/server/repos/orders-list";

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (mins < 1) return "الآن";
  if (mins < 60) return mins === 1 ? "منذ دقيقة" : mins === 2 ? "منذ دقيقتين" : `منذ ${mins} ${mins <= 10 ? "دقائق" : "دقيقة"}`;
  const h = Math.round(mins / 60);
  if (h < 24) return h === 1 ? "منذ ساعة" : h === 2 ? "منذ ساعتين" : `منذ ${h} ${h <= 10 ? "ساعات" : "ساعة"}`;
  const days = Math.round(h / 24);
  if (days < 7) return days === 1 ? "أمس" : days === 2 ? "منذ يومين" : `منذ ${days} أيام`;
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short", timeZone: "Africa/Cairo" }).format(d);
}

export function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black", TONE_CHIP[orderStatusTone(status)], className)}>
      {orderStatusLabel(status)}
    </span>
  );
}

/** حالة الدفع حين تحتاج انتباهاً فقط (إيصال للمراجعة أو مرفوض)، أو «مدفوع» للتحويل المؤكد. */
export function PaymentChip({ row }: { row: Pick<OrderRow, "paymentMethod" | "paymentStatus" | "status"> }) {
  if (row.status === "cancelled" || row.status === "returned") return null;
  if (row.paymentStatus === "under_review") return <span className="inline-flex rounded-full bg-warn/12 px-2 py-0.5 text-[11px] font-black text-warn">إيصال للمراجعة</span>;
  if (row.paymentStatus === "rejected") return <span className="inline-flex rounded-full bg-bad/12 px-2 py-0.5 text-[11px] font-black text-bad">التحويل لم يصل</span>;
  if (row.paymentMethod !== "cod" && row.paymentStatus === "confirmed") return <span className="inline-flex rounded-full bg-ok/12 px-2 py-0.5 text-[11px] font-black text-ok">مدفوع</span>;
  return null;
}

/** سجل العميل مع المتجر: أوضح إشارة مخاطرة للدفع عند الاستلام (من رفض الاستلام قبل ذلك). */
export function HistoryBadge({ h }: { h: OrderRow["history"] }) {
  if (h.returned > 0)
    return (
      <span className="inline-flex rounded-full bg-bad/12 px-2 py-0.5 text-[10.5px] font-black text-bad" title="رفض الاستلام أو أرجع طلباً سابقاً">
        رفض/أرجع {fmtNum(h.returned)}
      </span>
    );
  if (h.delivered > 0)
    return (
      <span className="inline-flex rounded-full bg-ok/12 px-2 py-0.5 text-[10.5px] font-black text-ok" title="استلم طلبات سابقة">
        استلم {fmtNum(h.delivered)} من قبل
      </span>
    );
  if (h.total === 0) return <span className="inline-flex rounded-full bg-edge/[0.06] px-2 py-0.5 text-[10.5px] font-bold text-ink-3">أول طلب</span>;
  return null;
}

export function itemsSummary(it: OrderRow["items"]): string {
  if (!it.first) return "—";
  return it.lines > 1 ? `${it.first} +${fmtNum(it.lines - 1)}` : it.pieces > 1 ? `${it.first} × ${fmtNum(it.pieces)}` : it.first;
}
