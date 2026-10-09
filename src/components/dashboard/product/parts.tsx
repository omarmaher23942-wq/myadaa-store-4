"use client";

// parts.tsx — لبنات محرر المنتج: قسم بعنوان، وحقل مربوط بعنوانه وتلميحه وخطئه وعدّاد أحرفه، ومفتاح تبديل،
// وإدخال شرائح (كلمات البحث والشارات) يقبل الفصل بفاصلة أو Enter أو لصق قائمة.
import { useId, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";

export const inputCls =
  "min-h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-[13px] font-bold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-3/80 focus:border-nova/60 focus:ring-2 focus:ring-nova/20 aria-[invalid=true]:border-bad/60 aria-[invalid=true]:ring-bad/15";

export function Section({ title, hint, action, children, id }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="dash-card scroll-mt-24 space-y-4 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[14px] font-black text-ink">{title}</h2>
          {hint ? <p className="mt-0.5 text-[12px] leading-5 text-ink-3">{hint}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** حقل بعنوان مربوط (htmlFor) وتلميح وخطأ يقرؤه قارئ الشاشة، وعدّاد أحرف عند الاقتراب من الحد. */
export function Field({
  label,
  hint,
  error,
  count,
  max,
  children,
  optional,
  id: fixedId,
}: {
  /** معرّف ثابت للحقل (للتركيز عليه من خارج النموذج)؛ وإلا يُولَّد. */
  id?: string;
  label: string;
  hint?: string;
  error?: string | null;
  count?: number;
  max?: number;
  optional?: boolean;
  children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}) {
  const autoId = useId();
  const id = fixedId ?? autoId;
  const hintId = `${id}-h`;
  const near = max !== undefined && count !== undefined && count >= max * 0.8;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-bold text-ink">
          {label}
          {optional ? <span className="ms-1 font-normal text-ink-3">(اختياري)</span> : null}
        </label>
        {near ? (
          <span className={cn("text-[11px] tabular-nums", count! > max! ? "font-bold text-bad" : "text-ink-3")} aria-live="polite">
            {fmtNum(count!)}/{fmtNum(max!)}
          </span>
        ) : null}
      </div>
      {children({ id, "aria-describedby": hint || error ? hintId : undefined, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={hintId} className="mt-1.5 text-[12px] font-bold text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[11.5px] leading-5 text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint, disabled, labelId }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean; labelId?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <label id={labelId} htmlFor={id} className="text-[12.5px] font-bold text-ink">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50",
          checked ? "bg-nova" : "bg-edge/15"
        )}
      >
        <span className={cn("size-6 rounded-full bg-white shadow transition-transform", checked ? "-translate-x-5" : "translate-x-0")} />
      </button>
    </div>
  );
}

/** شرائح نصية: Enter أو فاصلة (عربية أو لاتينية) تضيف، ولصق قائمة يضيفها كلها، وBackspace في حقل فارغ يحذف الأخيرة. */
export function ChipsInput({
  value,
  onChange,
  placeholder,
  max,
  maxLen,
  id,
  describedBy,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  max: number;
  maxLen: number;
  id?: string;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw
      .split(/[,،\n]/)
      .map((s) => s.trim().slice(0, maxLen))
      .filter(Boolean);
    if (!parts.length) return setDraft("");
    onChange([...new Set([...value, ...parts])].slice(0, max));
    setDraft("");
  };
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] p-1.5 focus-within:border-nova/60 focus-within:ring-2 focus-within:ring-nova/20">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-nova/10 py-1 pe-1 ps-2.5 text-[12px] font-bold text-nova-2">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="grid size-6 place-items-center rounded-md hover:bg-nova/15" aria-label={`حذف ${t}`}>
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      {value.length < max ? (
        <input
          id={id}
          aria-describedby={describedBy}
          value={draft}
          onChange={(e) => (/[,،]$/.test(e.target.value) ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (/[,،\n]/.test(t)) {
              e.preventDefault();
              add(t);
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          enterKeyHint="done"
          className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-[13px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-3/80"
        />
      ) : null}
    </div>
  );
}
