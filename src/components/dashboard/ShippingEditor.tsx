"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveShippingAction } from "@/server/actions/commerce";
import { saveBlueprintAction } from "@/server/actions/blueprint";
import { GOVERNORATES, governorateName } from "@/lib/egypt";
import type { StoreBlueprint } from "@/blueprint/schema";

type Z = { governorate: string; fee: number; codExtra: number; etaMin: number; etaMax: number; isActive: boolean };

const I = "w-full rounded-xl border border-edge/10 bg-space-2 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-nova";

export function ShippingEditor({ rows: init = [], bp: bpInit }: { rows: Z[]; bp: StoreBlueprint }) {
  const [rows, setRows] = useState(
    GOVERNORATES.map(
      (g) =>
        init.find((r) => r.governorate === g.code) ?? {
          governorate: g.code,
          fee: 60,
          codExtra: 0,
          etaMin: 2,
          etaMax: 5,
          isActive: true,
        }
    )
  );
  const [bp, setBp] = useState(bpInit);
  const [pending, start] = useTransition();

  const upd = (i: number, p: Partial<Z>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));

  const applyUnifiedFee = () => {
    const val = prompt("اكتب سعر الشحن الموحد لكل المحافظات (بالجنيه):", "60");
    if (val && !isNaN(Number(val))) {
      const f = Number(val);
      setRows((r) => r.map((x) => ({ ...x, fee: f })));
      toast.success(`تم تعيين سعر الشحن ${f} ج لكل المحافظات`);
    }
  };

  const save = () =>
    start(async () => {
      const [a, b] = await Promise.all([
        saveShippingAction(rows),
        saveBlueprintAction(bp, "تحديث إعدادات الشحن"),
      ]);
      if (a?.error || b?.error) toast.error(a?.error || b?.error);
      else toast.success("تم حفظ إعدادات الشحن بنجاح");
    });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={applyUnifiedFee}
          className="rounded-xl border border-edge/10 bg-space-2 px-3.5 py-2 text-xs font-bold text-ink-2 hover:bg-edge/[0.05] transition-colors shadow-xs"
        >
          ⚡ تطبيق سعر شحن موحد لكل المحافظات
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-xl bg-nova hover:bg-nova-deep px-5 py-2 text-xs font-black text-white shadow-xs transition-all disabled:opacity-40"
        >
          {pending ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>

      <div className="grid gap-4 rounded-2xl border border-edge/10 bg-space-2 p-5 md:grid-cols-2 shadow-xs">
        <div>
          <label className="block text-xs font-bold text-ink-2 mb-1">
            شحن مجاني للطلبات فوق (ج.م)
          </label>
          <input
            type="number"
            className={I}
            value={bp.shipping.freeOverPiasters !== null ? bp.shipping.freeOverPiasters / 100 : ""}
            placeholder="اتركه فارغاً إن لم ترغب"
            onChange={(e) =>
              setBp({
                ...bp,
                shipping: {
                  ...bp.shipping,
                  freeOverPiasters: e.target.value ? Number(e.target.value) * 100 : null,
                },
              })
            }
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-ink-2 mb-1">
            مدة التوصيل المعتادة (نص يظهر للعميل)
          </label>
          <input
            className={I}
            value={bp.shipping.generalEta || "من 2 إلى 4 أيام عمل"}
            onChange={(e) => setBp({ ...bp, shipping: { ...bp.shipping, generalEta: e.target.value } })}
          />
        </div>
      </div>

      {/* جدول المحافظات الـ 27 الفاتح والواضح */}
      <div className="overflow-x-auto rounded-2xl border border-edge/10 bg-space-2 shadow-xs">
        <table className="w-full text-xs text-start">
          <thead className="border-b border-edge/10 bg-edge/[0.03] text-ink-3 font-bold">
            <tr>
              <th className="p-3.5 text-start">المحافظة</th>
              <th className="p-3.5 text-start">سعر الشحن (ج.م)</th>
              <th className="p-3.5 text-start">مدة الشحن التقديرية</th>
              <th className="p-3.5 text-start">متاح للشحن</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/5">
            {rows.map((z, i) => (
              <tr key={z.governorate} className="hover:bg-edge/[0.05] transition-colors">
                <td className="p-3.5 font-bold text-ink">{governorateName(z.governorate)}</td>
                <td className="p-3.5">
                  <input
                    type="number"
                    className="w-24 rounded-lg border border-edge/10 bg-space-2 px-2.5 py-1 text-xs font-bold text-ink font-mono"
                    value={z.fee}
                    onChange={(e) => upd(i, { fee: Number(e.target.value) })}
                  />
                </td>
                <td className="p-3.5 text-ink-3 font-medium">
                  من {z.etaMin} إلى {z.etaMax} أيام
                </td>
                <td className="p-3.5">
                  <input
                    type="checkbox"
                    checked={z.isActive}
                    onChange={(e) => upd(i, { isActive: e.target.checked })}
                    className="size-4 accent-slate-900 rounded cursor-pointer"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}