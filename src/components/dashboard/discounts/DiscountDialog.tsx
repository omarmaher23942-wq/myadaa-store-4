"use client";

// DiscountDialog — إنشاء كود خصم أو تعديله، مع جملة حية تصف ما سيحدث للعميل بالضبط. التواريخ بتوقيت جهاز التاجر وتُرسل
// ISO فلا ينحرف الموعد بفرق توقيت الخادم، ومعها اختصارات (أسبوع، نهاية الشهر).
import { useEffect, useState } from "react";
import { Loader2, Shuffle, Truck, Percent, Banknote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { discountConditions, discountValueLabel, suggestCode, type DiscountType } from "@/lib/discounts";
import { saveDiscountAction } from "@/server/actions/discounts";
import type { DiscountRow } from "@/server/repos/discounts-list";
import { DashDialog } from "../ui/DashDialog";
import { Field, inputCls, Switch } from "../product/parts";
import { toNumber } from "../product/model";

type Draft = {
  code: string;
  type: DiscountType;
  value: string;
  minSubtotal: string;
  maxUses: string;
  /** "1" مرة واحدة، و"" بلا حد، أو عدد أكبر محفوظ من قبل. */
  perCustomer: string;
  startsAt: string; // datetime-local بتوقيت الجهاز
  endsAt: string;
  isActive: boolean;
};

/** ISO ← قيمة datetime-local بتوقيت الجهاز، والعكس. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function endOf(kind: "day" | "week" | "month"): string {
  const d = new Date();
  if (kind === "week") d.setDate(d.getDate() + 7);
  if (kind === "month") d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d.toISOString());
}

const TYPES: { key: DiscountType; label: string; icon: typeof Percent }[] = [
  { key: "percentage", label: "نسبة", icon: Percent },
  { key: "fixed", label: "مبلغ", icon: Banknote },
  { key: "free_shipping", label: "شحن مجاني", icon: Truck },
];

export function DiscountDialog({ discount, open, onClose, onSaved }: { discount: DiscountRow | null; open: boolean; onClose: () => void; onSaved: (code: string, isNew: boolean) => void }) {
  // يبدأ فارغاً (لا كود عشوائي أثناء العرض على الخادم)، ويُملأ عند الفتح.
  const [d, setD] = useState<Draft>({ code: "", type: "percentage", value: "", minSubtotal: "", maxUses: "", perCustomer: "1", startsAt: "", endsAt: "", isActive: true });
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = Boolean(discount && discount.usedCount > 0);

  function blank(): Draft {
    return { code: suggestCode(), type: "percentage", value: "10", minSubtotal: "", maxUses: "", perCustomer: "1", startsAt: "", endsAt: "", isActive: true };
  }

  useEffect(() => {
    if (!open) return;
    setError(null);
    setD(
      discount
        ? {
            code: discount.code,
            type: discount.type,
            value: discount.type === "fixed" ? String(discount.value / 100) : discount.type === "percentage" ? String(discount.value) : "",
            minSubtotal: discount.minSubtotalPiasters ? String(discount.minSubtotalPiasters / 100) : "",
            maxUses: discount.maxUses ? String(discount.maxUses) : "",
            perCustomer: discount.perCustomerLimit ? String(discount.perCustomerLimit) : "",
            startsAt: toLocalInput(discount.startsAt),
            endsAt: toLocalInput(discount.endsAt),
            isActive: discount.isActive,
          }
        : blank()
    );
  }, [open, discount]);

  const up = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    if (error?.field && (error.field === k || (k === "minSubtotal" && error.field === "minSubtotal"))) setError(null);
  };
  const err = (f: string) => (error?.field === f ? error.text : null);

  const value = toNumber(d.value);
  const min = toNumber(d.minSubtotal);
  const preview = {
    type: d.type,
    value: d.type === "fixed" ? Math.round((value ?? 0) * 100) : (value ?? 0),
    minSubtotalPiasters: min ? Math.round(min * 100) : null,
    perCustomerLimit: d.perCustomer ? Number(d.perCustomer) : null,
    maxUses: toNumber(d.maxUses) || null,
    startsAt: fromLocalInput(d.startsAt),
    endsAt: fromLocalInput(d.endsAt),
  };
  const valueOk = d.type === "free_shipping" || (value !== null && !Number.isNaN(value) && value > 0);
  const warnFree = d.type === "fixed" && value && min !== null && !Number.isNaN(min) && min > 0 && value >= min;

  async function save() {
    setSaving(true);
    const r = await saveDiscountAction({
      id: discount?.id,
      code: d.code,
      type: d.type,
      value: d.type === "free_shipping" ? 0 : value,
      minSubtotal: min,
      maxUses: toNumber(d.maxUses),
      perCustomerLimit: d.perCustomer ? Number(d.perCustomer) : null,
      startsAt: fromLocalInput(d.startsAt),
      endsAt: fromLocalInput(d.endsAt),
      isActive: d.isActive,
    }).catch(() => ({ ok: false as const, error: "انقطع الاتصال، حاول مرة أخرى", field: undefined }));
    setSaving(false);
    if (!r.ok) {
      setError({ field: r.field, text: r.error });
      if (!r.field || !["code", "value", "minSubtotal", "maxUses", "startsAt", "endsAt"].includes(r.field)) toast.error(r.error);
      return;
    }
    onSaved(d.code.toUpperCase(), !discount);
  }

  return (
    <DashDialog
      open={open}
      onClose={() => !saving && onClose()}
      title={discount ? `تعديل ${discount.code}` : "كود خصم جديد"}
      className="sm:max-w-lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
            إلغاء
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !valueOk || d.code.trim().length < 3}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {discount ? "احفظ" : "أنشئ الكود"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <Field label="الكود" error={err("code")} hint={locked ? "استُخدم في طلبات، فلا يتغير نصه." : "يكتبه العميل في صفحة الدفع. حروف إنجليزية وأرقام."}>
          {(p) => (
            <div className="flex gap-2">
              <input
                {...p}
                value={d.code}
                disabled={locked}
                onChange={(e) => up("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20))}
                dir="ltr"
                autoCapitalize="characters"
                spellCheck={false}
                className={cn(inputCls, "font-mono text-[15px] tracking-wider disabled:opacity-60")}
              />
              {!locked ? (
                <button type="button" onClick={() => up("code", suggestCode())} className="grid size-11 shrink-0 place-items-center rounded-xl border border-edge/10 text-ink-2 hover:bg-edge/5" aria-label="اقترح كوداً آخر" title="اقترح كوداً">
                  <Shuffle className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          )}
        </Field>

        <div role="radiogroup" aria-label="نوع الخصم" className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const on = d.type === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => up("type", t.key)}
                className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[12px] font-black transition-colors", on ? "border-nova/50 bg-nova/[0.08] text-ink" : "border-edge/10 text-ink-3 hover:bg-edge/[0.03]")}
              >
                <Icon className={cn("size-4", on && "text-nova-2")} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {d.type !== "free_shipping" ? (
            <Field label={d.type === "percentage" ? "النسبة (%)" : "المبلغ (ج.م)"} error={err("value")}>
              {(p) => <input {...p} value={d.value} onChange={(e) => up("value", e.target.value)} inputMode="decimal" dir="ltr" className={cn(inputCls, "tabular-nums")} placeholder={d.type === "percentage" ? "10" : "50"} />}
            </Field>
          ) : null}
          <Field label="أقل قيمة للطلب" optional error={err("minSubtotal")} hint="بالجنيه، قبل الشحن.">
            {(p) => <input {...p} value={d.minSubtotal} onChange={(e) => up("minSubtotal", e.target.value)} inputMode="decimal" dir="ltr" className={cn(inputCls, "tabular-nums")} placeholder="بلا حد" />}
          </Field>
        </div>
        {warnFree ? <p className="-mt-2 rounded-xl bg-warn/10 p-2.5 text-[12px] font-bold text-warn">قيمة الخصم تساوي أقل طلب أو تزيد عليه: قد يصبح الطلب بلا مقابل.</p> : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="أقصى عدد طلبات" optional error={err("maxUses")} hint={discount?.usedCount ? `استُخدم ${fmtNum(discount.usedCount)} مرة` : "لكل العملاء معاً."}>
            {(p) => <input {...p} value={d.maxUses} onChange={(e) => up("maxUses", e.target.value)} inputMode="numeric" dir="ltr" className={cn(inputCls, "tabular-nums")} placeholder="بلا حد" />}
          </Field>
          <Field label="لكل عميل">
            {(p) => (
              <select {...p} value={d.perCustomer} onChange={(e) => up("perCustomer", e.target.value)} className={cn(inputCls, "bg-space-2")}>
                <option value="1">مرة واحدة</option>
                {d.perCustomer && d.perCustomer !== "1" ? <option value={d.perCustomer}>{fmtNum(Number(d.perCustomer))} مرات</option> : null}
                <option value="">بلا حد</option>
              </select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="يبدأ" optional error={err("startsAt")} hint="فارغ = فوراً.">
            {(p) => <input {...p} type="datetime-local" value={d.startsAt} onChange={(e) => up("startsAt", e.target.value)} className={cn(inputCls, "bg-space-2")} />}
          </Field>
          <Field label="ينتهي" optional error={err("endsAt")}>
            {(p) => <input {...p} type="datetime-local" value={d.endsAt} onChange={(e) => up("endsAt", e.target.value)} className={cn(inputCls, "bg-space-2")} />}
          </Field>
        </div>
        <div className="-mt-1 flex flex-wrap gap-1.5">
          {(
            [
              ["day", "نهاية اليوم"],
              ["week", "بعد أسبوع"],
              ["month", "نهاية الشهر"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => up("endsAt", endOf(k))} className="min-h-9 rounded-lg bg-nova/10 px-2.5 text-[11.5px] font-bold text-nova-2 hover:bg-nova/20">
              ينتهي {label}
            </button>
          ))}
          {d.endsAt ? (
            <button type="button" onClick={() => up("endsAt", "")} className="min-h-9 rounded-lg px-2.5 text-[11.5px] font-bold text-ink-3 hover:bg-edge/5">
              بلا انتهاء
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border border-nova/20 bg-nova/[0.05] p-3.5 text-[12.5px] leading-6 text-ink-2" aria-live="polite">
          <b className="text-ink">ما يحدث للعميل:</b> يكتب <span className="font-mono font-black text-ink" dir="ltr">{d.code || "CODE"}</span> عند الدفع فيحصل على{" "}
          <b className="text-ink">{valueOk ? discountValueLabel(preview) : "…"}</b>
          {discountConditions(preview).length ? ` ${discountConditions(preview).join("، ")}` : ""}.
        </div>

        <div className="border-t border-edge/[0.06] pt-4">
          <Switch checked={d.isActive} onChange={(v) => up("isActive", v)} label="مفعّل" hint="أوقفه في أي وقت دون حذفه." />
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </DashDialog>
  );
}
