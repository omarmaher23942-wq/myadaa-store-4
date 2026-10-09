"use client";

// ThemePanel — ألوان المتجر وخطوطه: الألوان الأربعة الأساسية بمعاينة حية تشبه المتجر، ولون النص فوق كل لون يُحسب تلقائياً
// ليبقى مقروءاً، وتنبيه بنسبة التباين عند اختيار نص صعب القراءة (معيار WCAG: 4.5 فأكثر). بقية الألوان في «ألوان أخرى».
// الخطوط: المحمّلة في هذا المتجر فقط (AVAILABLE_FONTS)، فلا يختار التاجر خطاً لا يظهر. وضع المتجر (فاتح/داكن) يتبع الخلفية.
import { useId } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import type { Theme } from "@/blueprint/schema";
import { contrastRatio, readableOn } from "@/blueprint/palette";
import { FONT_VAR } from "@/blueprint/theme";
import { inputCls } from "../product/parts";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

type Palette = Theme["palette"];
type FontKey = Theme["fonts"]["heading"];

export const FONT_LABELS: Record<FontKey, string> = {
  cairo: "Cairo",
  tajawal: "Tajawal",
  ibm_plex_arabic: "IBM Plex Arabic",
  almarai: "Almarai",
  changa: "Changa",
  el_messiri: "El Messiri",
  readex_pro: "Readex Pro",
  noto_kufi: "Noto Kufi",
};

const MAIN: { key: keyof Palette; label: string; hint: string; on?: keyof Palette }[] = [
  { key: "primary", label: "لون العلامة", hint: "الأزرار والروابط والأسعار", on: "primaryForeground" },
  { key: "accent", label: "اللون المميز", hint: "الشارات والعروض", on: "accentForeground" },
  { key: "background", label: "الخلفية", hint: "خلفية صفحات المتجر" },
  { key: "foreground", label: "النص", hint: "لون الكتابة على الخلفية" },
];

const OTHER: { key: keyof Palette; label: string }[] = [
  { key: "secondary", label: "اللون الثانوي" },
  { key: "secondaryForeground", label: "النص فوق اللون الثانوي" },
  { key: "card", label: "البطاقات" },
  { key: "cardForeground", label: "نص البطاقات" },
  { key: "muted", label: "الأقسام الهادئة" },
  { key: "mutedForeground", label: "النص الثانوي" },
  { key: "border", label: "الحدود" },
  { key: "primaryForeground", label: "النص فوق لون العلامة" },
  { key: "accentForeground", label: "النص فوق اللون المميز" },
  { key: "success", label: "نجاح" },
  { key: "warning", label: "تنبيه" },
  { key: "danger", label: "خطأ" },
];

/** ألوان تُحسب نصوصها تلقائياً عند تغييرها. */
const AUTO_ON: Partial<Record<keyof Palette, keyof Palette>> = { primary: "primaryForeground", accent: "accentForeground", secondary: "secondaryForeground" };

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const full = (h: string) => (/^#[0-9a-f]{3}$/i.test(h) ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h);
const safeRatio = (a: string, b: string) => (HEX.test(a) && HEX.test(b) ? contrastRatio(full(a), full(b)) : 0);

export function ThemePanel({ value, onChange, fonts }: { value: Theme; onChange: (t: Theme) => void; fonts: readonly string[] }) {
  const p = value.palette;
  const setColor = (key: keyof Palette, hex: string) => {
    const next: Palette = { ...p, [key]: hex };
    const on = AUTO_ON[key];
    if (on && HEX.test(hex)) next[on] = readableOn(full(hex));
    // وضع المتجر (فاتح/داكن) يتبع الخلفية: منه لون عناصر المتصفح الأصلية (الحقول وشريط التمرير).
    const mode = key === "background" && HEX.test(hex) ? (readableOn(full(hex)) === "#ffffff" ? "dark" : "light") : value.mode;
    onChange({ ...value, mode, palette: next });
  };
  const textRatio = safeRatio(p.foreground, p.background);
  const fontOptions = (Object.keys(FONT_LABELS) as FontKey[]).filter((f) => fonts.includes(f) || f === value.fonts.heading || f === value.fonts.body);

  return (
    <div className="space-y-6">
      {/* معاينة حية */}
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-2xl border border-edge/10 p-4"
        style={{ background: p.background, color: p.foreground, fontFamily: `${FONT_VAR[value.fonts.body]}, system-ui`, fontSize: value.fonts.baseSize }}
      >
        <p className="text-[0.75em] font-bold opacity-70">معاينة</p>
        <p className="mt-1 text-[1.4em] font-black leading-snug" style={{ fontFamily: `${FONT_VAR[value.fonts.heading]}, system-ui` }}>
          أناقة يومية بسعر عادل
        </p>
        <p className="mt-1 text-[0.9em]" style={{ color: p.mutedForeground }}>
          تشكيلة جديدة كل أسبوع، وشحن لكل المحافظات.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-lg px-4 py-2 text-[0.85em] font-bold" style={{ background: p.primary, color: p.primaryForeground }}>
            اطلب الآن
          </span>
          <span className="rounded-full px-2.5 py-1 text-[0.75em] font-bold" style={{ background: p.accent, color: p.accentForeground }}>
            خصم 20%
          </span>
          <span className="rounded-lg border px-3 py-2 text-[0.8em]" style={{ background: p.card, color: p.cardForeground, borderColor: p.border }}>
            بطاقة منتج · <b style={{ color: p.primary }}>350 ج.م</b>
          </span>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-[13px] font-black text-ink">الألوان الأساسية</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MAIN.map((c) => (
            <ColorRow key={c.key} label={c.label} hint={c.hint} value={p[c.key]} onChange={(h) => setColor(c.key, h)} />
          ))}
        </div>
        <p className={cn("flex items-start gap-1.5 text-[12px] leading-5", textRatio >= 4.5 ? "text-ok" : "font-bold text-warn")} aria-live="polite">
          {textRatio >= 4.5 ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          {textRatio >= 4.5
            ? `النص واضح على الخلفية (التباين ${fmtNum(Math.round(textRatio * 10) / 10)} من 21)`
            : `النص صعب القراءة على هذه الخلفية (التباين ${fmtNum(Math.round(textRatio * 10) / 10)}، والمطلوب 4.5 على الأقل). غمّق النص أو فتّح الخلفية.`}
        </p>
      </fieldset>

      <details className="group rounded-xl border border-edge/10 bg-edge/[0.02]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-[12.5px] font-black text-ink">
          ألوان أخرى
          <ChevronDown className="size-4 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-3 border-t border-edge/[0.07] p-3.5 sm:grid-cols-2">
          {OTHER.map((c) => (
            <ColorRow key={c.key} label={c.label} value={p[c.key]} onChange={(h) => setColor(c.key, h)} compact />
          ))}
        </div>
      </details>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-[13px] font-black text-ink">الخطوط</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <FontSelect label="خط العناوين" value={value.fonts.heading} options={fontOptions} onChange={(f) => onChange({ ...value, fonts: { ...value.fonts, heading: f } })} />
          <FontSelect label="خط النصوص" value={value.fonts.body} options={fontOptions} onChange={(f) => onChange({ ...value, fonts: { ...value.fonts, body: f } })} />
        </div>
        {fontOptions.length < Object.keys(FONT_LABELS).length ? <p className="text-[11.5px] leading-5 text-ink-3">تظهر الخطوط المحمّلة في نسخة متجرك فقط.</p> : null}
        <SizeSlider value={value.fonts.baseSize} onChange={(n) => onChange({ ...value, fonts: { ...value.fonts, baseSize: n } })} />
      </fieldset>
    </div>
  );
}

function ColorRow({ label, hint, value, onChange, compact }: { label: string; hint?: string; value: string; onChange: (h: string) => void; compact?: boolean }) {
  const id = useId();
  const valid = HEX.test(value);
  return (
    <div className={cn("rounded-xl border border-edge/10 bg-edge/[0.02] p-2.5", compact && "p-2")}>
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          value={valid ? full(value) : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`اختر ${label}`}
          className="size-10 shrink-0 cursor-pointer rounded-lg border border-edge/15 bg-transparent p-0.5"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-[12px] font-bold text-ink">
            {label}
          </label>
          {hint ? <p className="truncate text-[11px] text-ink-3">{hint}</p> : null}
        </div>
        <input
          id={id}
          dir="ltr"
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v.startsWith("#") ? v : `#${v}`);
          }}
          maxLength={7}
          aria-invalid={!valid || undefined}
          className={cn(inputCls, "!min-h-9 w-24 shrink-0 px-2 font-mono text-[12px] uppercase")}
        />
      </div>
      {!valid ? <p className="mt-1.5 text-[11px] font-bold text-bad">اكتب اللون بصيغة ‎#RRGGBB</p> : null}
    </div>
  );
}

function FontSelect({ label, value, options, onChange }: { label: string; value: FontKey; options: FontKey[]; onChange: (f: FontKey) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-bold text-ink">
        {label}
      </label>
      <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value as FontKey)} style={{ fontFamily: `${FONT_VAR[value]}, system-ui` }}>
        {options.map((f) => (
          <option key={f} value={f}>
            {FONT_LABELS[f]}
          </option>
        ))}
      </select>
      <p className="mt-1.5 truncate text-[15px] text-ink-2" style={{ fontFamily: `${FONT_VAR[value]}, system-ui` }} aria-hidden="true">
        متجرك بخط {FONT_LABELS[value]}
      </p>
    </div>
  );
}

function SizeSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-bold text-ink">
        حجم النص
      </label>
      <div className="flex items-center gap-3">
        <input id={id} type="range" min={14} max={20} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 cursor-pointer accent-[var(--dash-nova)]" />
        <span className="w-14 shrink-0 text-center text-[12.5px] font-black tabular-nums text-ink">{fmtNum(value)}px</span>
      </div>
    </div>
  );
}
