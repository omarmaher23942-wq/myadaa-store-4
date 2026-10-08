"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDiscountAction, deleteDiscountAction } from "@/server/actions/commerce";
type D = { id?: string; code: string; type: "percentage" | "fixed" | "free_shipping"; value: number; minSubtotal: number | null; maxUses: number | null; usedCount?: number; perCustomerLimit: number | null; endsAt: string | null; isActive: boolean };
const blank: D = { code: "", type: "percentage", value: 10, minSubtotal: null, maxUses: null, perCustomerLimit: 1, endsAt: null, isActive: true };
const I = "w-full rounded-lg border px-3 py-2 text-sm";
export function DiscountsManager({ rows }: { rows: D[] }) {
  const [e, setE] = useState<D>(blank); const [pending, start] = useTransition();
  const label = (d: D) => d.type === "percentage" ? `${d.value}%` : d.type === "fixed" ? `${d.value} ج.م` : "شحن مجاني";
  return <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
    <div className="rounded-2xl bg-space-2 shadow-sm divide-y">{rows.map((d) => <div key={d.id} className="flex items-center gap-3 p-3 text-sm"><code className="rounded bg-edge/[0.06] px-2 py-1 font-bold">{d.code}</code><span className="font-bold text-teal-700">{label(d)}</span><span className="text-ink-3">استُخدم {d.usedCount}{d.maxUses ? `/${d.maxUses}` : ""}</span>{!d.isActive && <span className="text-xs text-red-600">موقوف</span>}<div className="ms-auto flex gap-2"><button onClick={() => setE(d)} className="rounded border px-2 py-1 text-xs">تعديل</button><button onClick={() => start(() => deleteDiscountAction(d.id!))} className="rounded border px-2 py-1 text-xs text-red-600">حذف</button></div></div>)}{!rows.length && <p className="p-10 text-center text-ink-3">أنشئ أول كود خصم (مثل WELCOME10)</p>}</div>
    <div className="space-y-3 rounded-2xl bg-space-2 p-5 shadow-sm"><h2 className="font-bold">{e.id ? "تعديل" : "كود جديد"}</h2>
      <input className={I + " uppercase"} placeholder="الكود" value={e.code} onChange={(x) => setE({ ...e, code: x.target.value.toUpperCase() })} />
      <select className={I} value={e.type} onChange={(x) => setE({ ...e, type: x.target.value as D["type"] })}><option value="percentage">نسبة %</option><option value="fixed">مبلغ ثابت</option><option value="free_shipping">شحن مجاني</option></select>
      {e.type !== "free_shipping" && <input type="number" className={I} placeholder="القيمة" value={e.value} onChange={(x) => setE({ ...e, value: Number(x.target.value) })} />}
      <input type="number" className={I} placeholder="حد أدنى للطلب (ج.م) اختياري" value={e.minSubtotal ?? ""} onChange={(x) => setE({ ...e, minSubtotal: x.target.value ? Number(x.target.value) : null })} />
      <div className="grid grid-cols-2 gap-2"><input type="number" className={I} placeholder="أقصى استخدام" value={e.maxUses ?? ""} onChange={(x) => setE({ ...e, maxUses: x.target.value ? Number(x.target.value) : null })} /><input type="number" className={I} placeholder="لكل عميل" value={e.perCustomerLimit ?? ""} onChange={(x) => setE({ ...e, perCustomerLimit: x.target.value ? Number(x.target.value) : null })} /></div>
      <label className="block text-xs">ينتهي في <input type="datetime-local" className={I} value={e.endsAt ?? ""} onChange={(x) => setE({ ...e, endsAt: x.target.value || null })} /></label>
      <label className="text-sm"><input type="checkbox" checked={e.isActive} onChange={(x) => setE({ ...e, isActive: x.target.checked })} /> مفعّل</label>
      <button disabled={pending || !e.code} onClick={() => start(async () => { const r = await saveDiscountAction(e); r.error ? toast.error(r.error) : (toast.success("تم الحفظ"), setE(blank)); })} className="btn-brand w-full">حفظ</button></div>
  </div>;
}
