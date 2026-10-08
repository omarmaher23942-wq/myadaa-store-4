"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setOrderStatusAction, updateOrderMetaAction } from "@/server/actions/orders";

const STATUS_MAP = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  shipped: "مع شركة الشحن",
  delivered: "تم التوصيل",
  returned: "مرتجع",
  cancelled: "ملغي",
} as const;

export function OrderActions({ order: o }: { order: any }) {
  const [pending, start] = useTransition();
  const [meta, setMeta] = useState({
    courierName: o.courierName ?? "",
    trackingNumber: o.trackingNumber ?? "",
    internalNotes: o.internalNotes ?? "",
  });

  const updateStatus = (st: string) =>
    start(async () => {
      try {
        await setOrderStatusAction(o.id, st as any);
        toast.success(`تم تحديث حالة الطلب إلى: ${STATUS_MAP[st as keyof typeof STATUS_MAP] || st}`);
      } catch (err: any) {
        toast.error(err?.message || "حدث خطأ أثناء تحديث الحالة");
      }
    });

  const saveMeta = () =>
    start(async () => {
      try {
        await updateOrderMetaAction(o.id, meta);
        toast.success("تم حفظ بيانات الشحن والملاحظات بنجاح");
      } catch (err: any) {
        toast.error(err?.message || "حدث خطأ أثناء الحفظ");
      }
    });

  return (
    <aside className="space-y-4" dir="rtl">
      {/* صندوق الحالة الحالية وتغييرها */}
      <div className="rounded-2xl border border-edge/10 bg-space-2 p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-black text-ink border-b border-edge/10 pb-2.5">
          الحالة الحالية:{" "}
          <span className="text-ink font-bold">
            {STATUS_MAP[o.status as keyof typeof STATUS_MAP] || o.status}
          </span>
        </h2>

        <div className="grid gap-2">
          {o.status === "new" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => updateStatus("confirmed")}
              className="rounded-xl bg-nova hover:bg-nova-deep text-white font-black py-2.5 text-xs transition-colors shadow-xs disabled:opacity-40"
            >
              ✓ تأكيد الطلب
            </button>
          )}
          {o.status === "confirmed" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => updateStatus("preparing")}
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black py-2.5 text-xs transition-colors shadow-xs disabled:opacity-40"
            >
              📦 جاري التجهيز
            </button>
          )}
          {o.status === "preparing" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => updateStatus("shipped")}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 text-xs transition-colors shadow-xs disabled:opacity-40"
            >
              🚚 تسليم للمندوب / الشحن
            </button>
          )}
          {o.status === "shipped" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => updateStatus("delivered")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 text-xs transition-colors shadow-xs disabled:opacity-40"
            >
              ✓ تم التوصيل وتحصيل المبلغ
            </button>
          )}
          {o.status !== "cancelled" && o.status !== "delivered" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm("هل أنت متأكد من إلغاء هذا الطلب؟") && updateStatus("cancelled")}
              className="rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
            >
              إلغاء الطلب
            </button>
          )}
        </div>
      </div>

      {/* بيانات الشحن والملاحظات الداخلية */}
      <div className="rounded-2xl border border-edge/10 bg-space-2 p-5 shadow-xs space-y-3">
        <h2 className="text-xs font-black text-ink border-b border-edge/10 pb-2.5">
          بيانات بوليصة الشحن
        </h2>
        <div>
          <label className="block text-[11px] text-ink-2 font-bold mb-1">
            شركة الشحن / اسم المندوب
          </label>
          <input
            className="w-full rounded-xl border border-edge/10 bg-space-2 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-nova"
            placeholder="اسم الشركة أو المندوب"
            value={meta.courierName}
            onChange={(e) => setMeta({ ...meta, courierName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[11px] text-ink-2 font-bold mb-1">
            رقم الشحنة (Tracking Number)
          </label>
          <input
            className="w-full rounded-xl border border-edge/10 bg-space-2 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-nova font-mono"
            placeholder="TRK-XXXXX"
            dir="ltr"
            value={meta.trackingNumber}
            onChange={(e) => setMeta({ ...meta, trackingNumber: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[11px] text-ink-2 font-bold mb-1">
            ملاحظات داخلية (خاصة بك)
          </label>
          <textarea
            className="w-full rounded-xl border border-edge/10 bg-space-2 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-nova"
            rows={2}
            placeholder="ملاحظات لا يراها العميل..."
            value={meta.internalNotes}
            onChange={(e) => setMeta({ ...meta, internalNotes: e.target.value })}
          />
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={saveMeta}
          className="w-full rounded-xl bg-nova hover:bg-nova-deep text-white font-bold py-2 text-xs transition-colors shadow-xs disabled:opacity-40"
        >
          {pending ? "جاري الحفظ..." : "حفظ بيانات الشحن"}
        </button>
      </div>
    </aside>
  );
}