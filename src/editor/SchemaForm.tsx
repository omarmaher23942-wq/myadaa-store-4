"use client";

// SchemaForm — نموذج يُبنى من مخطط Zod لجزء من إعدادات المتجر (قسم في الرئيسية، العلامة، الهيدر…).
// - يعرض فقط ما يقرؤه المتجر فعلاً (editable.ts) بأسماء عربية (field-meta.ts)، وكل عنوان مربوط بحقله.
// - `path` يحدد المكان («section:hero»، «brand»، «section:faq.items[]»)، ومنه القائمة المسموحة وأسماء الحقول الخاصة.
// - الصور تُضغط في المتصفح وتُرفع لمساحة المتجر، والمنتجات والأقسام تُختار بالاسم لا بالمعرّف.
import { z } from "zod";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Copy, ImagePlus, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { Icon } from "@/components/storefront/Icon";
import { ICON_NAMES } from "@/blueprint/icons";
import { Field, Switch, ChipsInput, inputCls } from "@/components/dashboard/product/parts";
import { toNumber } from "@/components/dashboard/product/model";
import { isHostedImage } from "@/lib/media-hosts";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CONTEXT_LABELS, ENUM_LABELS, FIELD_LABELS, ICON_LABELS, literalLabel, type FieldMeta } from "./field-meta";
import { enumView, visibleKeys } from "./editable";
import { useImageUpload } from "./useImageUpload";

export type FormCtx = {
  categories: { slug: string; name: string }[];
  products: { slug: string; name: string }[];
  pages?: { slug: string; title: string }[];
  sections?: { id: string; label: string }[];
};

type P = {
  schema: z.ZodTypeAny;
  value: unknown;
  onChange: (v: unknown) => void;
  /** مكان الحقل: «brand»، «section:hero»، «section:hero.primaryCta»، «section:faq.items[]»… */
  path: string;
  name?: string;
  ctx: FormCtx;
  depth?: number;
};

type Img = { url: string; alt: string; focalX: number; focalY: number };
const SW = 1.75;

function meta(path: string, name?: string): FieldMeta {
  return CONTEXT_LABELS[path] ?? (name ? FIELD_LABELS[name] : undefined) ?? { label: name ?? "" };
}

function unwrap(s: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean; def?: unknown } {
  let optional = false;
  let def: unknown;
  let cur = s;
  for (;;) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) {
      optional = true;
      cur = cur._def.innerType;
    } else if (cur instanceof z.ZodDefault) {
      def = cur._def.defaultValue();
      cur = cur._def.innerType;
    } else break;
  }
  return { inner: cur, optional, def };
}

export function emptyOf(s: z.ZodTypeAny): unknown {
  const { inner, def, optional } = unwrap(s);
  if (def !== undefined) return def;
  if (optional) return undefined;
  if (inner instanceof z.ZodString) return "";
  if (inner instanceof z.ZodNumber) return inner.minValue ?? 0;
  if (inner instanceof z.ZodBoolean) return false;
  if (inner instanceof z.ZodEnum) return inner.options[0];
  if (inner instanceof z.ZodLiteral) return inner.value;
  if (inner instanceof z.ZodArray) return [];
  if (inner instanceof z.ZodObject) return Object.fromEntries(Object.entries(inner.shape).map(([k, v]) => [k, emptyOf(v as z.ZodTypeAny)]).filter(([, v]) => v !== undefined));
  if (inner instanceof z.ZodDiscriminatedUnion || inner instanceof z.ZodUnion) return emptyOf(inner.options[0]);
  return undefined;
}

const isImageObj = (o: z.ZodObject<z.ZodRawShape>) => "url" in o.shape && "focalX" in o.shape;
const isCtaObj = (o: z.ZodObject<z.ZodRawShape>) => "label" in o.shape && "target" in o.shape;
const strMax = (s: z.ZodString) => (s._def.checks as { kind: string; value?: number }[]).find((c) => c.kind === "max")?.value;
const isUrlStr = (s: z.ZodString) => (s._def.checks as { kind: string }[]).some((c) => c.kind === "url");

export function SchemaForm({ schema, value, onChange, path, name, ctx, depth = 0 }: P) {
  const { inner, optional } = unwrap(schema);
  const m = meta(path, name);
  const str = typeof value === "string" ? value : "";

  // ─── حقول لها واجهة خاصة بالاسم ───
  if (name === "icon" && inner instanceof z.ZodString) return <IconPicker label={m.label} value={str} onChange={onChange} />;
  if ((name === "favicon" || name === "ogImage") && inner instanceof z.ZodString)
    return <UrlImageField label={m.label} hint={m.hint} value={str} onChange={(v) => onChange(v || (optional ? undefined : ""))} square={name === "favicon"} />;
  if (name === "endsAt" && inner instanceof z.ZodString) return <DateTimeField label={m.label} hint={m.hint} value={str} onChange={onChange} />;
  if (name === "couponCode" && inner instanceof z.ZodString)
    return (
      <Field label={m.label} hint={m.hint} optional={optional}>
        {(a) => <input {...a} dir="ltr" className={cn(inputCls, "font-mono uppercase")} maxLength={strMax(inner)} value={str} onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s+/g, "") || (optional ? undefined : ""))} />}
      </Field>
    );
  if (name === "spotlightProductSlug")
    return (
      <Field label={m.label} hint={m.hint ?? "لتصميم «منتج نجم»"}>
        {(a) => (
          <select {...a} className={inputCls} value={str} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">بلا منتج نجم</option>
            {ctx.products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  if ((name === "productSlugs" || name === "slugs") && inner instanceof z.ZodArray)
    return <ProductPicker label={m.label} hint={m.hint} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} products={ctx.products} max={inner._def.maxLength?.value ?? 24} min={inner._def.minLength?.value ?? 0} />;
  if (name === "categorySlugs") return <CategoryChips label={m.label} hint={m.hint} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} categories={ctx.categories} />;

  // ─── نص ───
  if (inner instanceof z.ZodString) {
    const max = strMax(inner);
    const set = (v: string) => onChange(v || (optional ? undefined : ""));
    if (isUrlStr(inner))
      return (
        <Field label={m.label} hint={m.hint} optional={optional}>
          {(a) => <input {...a} type="url" dir="ltr" inputMode="url" placeholder="https://" className={inputCls} value={str} onChange={(e) => set(e.target.value.trim())} />}
        </Field>
      );
    const long = (max ?? 0) > 150 || name === "body";
    return (
      <Field label={m.label} hint={m.hint} optional={optional} count={str.length} max={max}>
        {(a) =>
          long ? (
            <textarea {...a} dir="auto" rows={name === "body" ? 8 : 3} maxLength={max} className={cn(inputCls, "py-2.5 leading-7")} value={str} onChange={(e) => set(e.target.value)} />
          ) : (
            <input {...a} dir="auto" maxLength={max} className={inputCls} value={str} onChange={(e) => set(e.target.value)} />
          )
        }
      </Field>
    );
  }

  // ─── رقم ───
  if (inner instanceof z.ZodNumber) return <NumberField label={m.label} hint={m.hint} value={typeof value === "number" ? value : undefined} min={inner.minValue ?? undefined} max={inner.maxValue ?? undefined} onChange={onChange} percent={name === "overlayOpacity"} />;

  // ─── تبديل ───
  if (inner instanceof z.ZodBoolean) return <Switch label={m.label} hint={m.hint} checked={Boolean(value)} onChange={onChange} />;

  // ─── قائمة اختيارات ───
  if (inner instanceof z.ZodEnum) {
    const v = enumView(path, inner.options as string[], value);
    return <Choice label={m.label} hint={m.hint} options={v.options.map((o) => ({ value: o, label: ENUM_LABELS[o] ?? "غير مدعوم" }))} value={v.selected} onChange={onChange} />;
  }
  if (inner instanceof z.ZodLiteral) return null;
  if (inner instanceof z.ZodUnion) {
    const lits = (inner.options as z.ZodTypeAny[]).map((o) => unwrap(o).inner).filter((o): o is z.ZodLiteral<unknown> => o instanceof z.ZodLiteral);
    if (lits.length)
      return <Choice label={m.label} hint={m.hint} options={lits.map((l) => ({ value: l.value, label: literalLabel(name, l.value) }))} value={value} onChange={onChange} />;
    return null;
  }

  // ─── اختيار بنوع (وجهة الرابط، مصدر المنتجات، نوع الفقرة) ───
  if (inner instanceof z.ZodDiscriminatedUnion) return <UnionField inner={inner} value={value} onChange={onChange} path={path} name={name} ctx={ctx} depth={depth} label={m.label} hint={m.hint} />;

  // ─── كائن ───
  if (inner instanceof z.ZodObject) {
    if (isImageObj(inner)) return <ImageField label={m.label} hint={m.hint} value={value as Img | undefined} onChange={onChange} optional={optional} />;
    const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const keys = visibleKeys(path, Object.keys(inner.shape)).filter((k) => !(isCtaObj(inner) && !["label", "target"].includes(k)));
    const fields = (list: string[]) => (
      <div className="space-y-4">
        {list.map((k) => (
          <SchemaForm
            key={k}
            name={k}
            path={`${path}.${k}`}
            schema={inner.shape[k] as z.ZodTypeAny}
            value={obj[k]}
            onChange={(nv) => onChange({ ...obj, [k]: nv })}
            ctx={ctx}
            depth={depth + 1}
          />
        ))}
      </div>
    );
    if (depth === 0) return fields(keys);
    if (optional && value === undefined)
      return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-edge/15 p-3">
          <span className="text-[12.5px] font-bold text-ink-2">{m.label}</span>
          <button type="button" onClick={() => onChange(emptyOf(inner))} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-[12px] font-bold text-nova-2 hover:bg-nova/10">
            <Plus className="size-4" aria-hidden="true" />
            أضف
          </button>
        </div>
      );
    // خيار له «مفعّل»: العنوان نفسه مفتاح التشغيل، وتفاصيله تظهر حين يعمل فقط.
    const toggle = keys.includes("enabled") && unwrap(inner.shape.enabled as z.ZodTypeAny).inner instanceof z.ZodBoolean;
    const on = toggle ? Boolean(obj.enabled) : true;
    const rest = keys.filter((k) => !(toggle && k === "enabled"));
    return (
      <Group label={m.label} hint={m.hint} toggle={toggle ? { on, set: (v) => onChange({ ...obj, enabled: v }) } : undefined} onRemove={optional ? () => onChange(undefined) : undefined}>
        {on && rest.length ? fields(rest) : null}
      </Group>
    );
  }

  // ─── قائمة عناصر ───
  if (inner instanceof z.ZodArray) {
    const arr = Array.isArray(value) ? (value as unknown[]) : [];
    const el = inner.element as z.ZodTypeAny;
    const max = inner._def.maxLength?.value ?? 99;
    const min = inner._def.minLength?.value ?? 0;
    const elInner = unwrap(el).inner;
    if (elInner instanceof z.ZodObject && isImageObj(elInner)) return <ImagesField label={m.label} hint={m.hint} value={arr as Img[]} onChange={onChange} max={max} />;
    if (elInner instanceof z.ZodString)
      return (
        <Field label={m.label} hint={m.hint ?? "افصل بينها بفاصلة أو Enter"}>
          {(a) => <ChipsInput id={a.id} describedBy={a["aria-describedby"]} value={arr as string[]} onChange={onChange} placeholder="اكتب ثم Enter" max={max} maxLen={strMax(elInner) ?? 60} />}
        </Field>
      );
    return <ItemsField label={m.label} hint={m.hint} arr={arr} el={el} min={min} max={max} onChange={onChange} path={`${path}[]`} ctx={ctx} depth={depth} />;
  }

  return null;
}

function Group({ label, hint, toggle, onRemove, children }: { label: string; hint?: string; toggle?: { on: boolean; set: (v: boolean) => void }; onRemove?: () => void; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-4 rounded-xl border border-edge/10 bg-edge/[0.02] p-3.5">
      {toggle ? (
        <Switch label={label} hint={hint} checked={toggle.on} onChange={toggle.set} labelId={id} />
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p id={id} className="text-[12.5px] font-black text-ink">
              {label}
            </p>
            {hint ? <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
          </div>
          {onRemove ? (
            <button type="button" onClick={onRemove} className="inline-flex min-h-8 shrink-0 items-center rounded-lg px-2 text-[11.5px] font-bold text-bad hover:bg-bad/10">
              احذف
            </button>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── عناصر متكررة ───────────────────────────────────────────────────────────

function summarize(item: unknown, i: number): string {
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    for (const k of ["title", "q", "text", "name", "label", "headline"]) if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim().slice(0, 60);
  }
  return `عنصر ${fmtNum(i + 1)}`;
}

function ItemsField({ label, hint, arr, el, min, max, onChange, path, ctx, depth }: { label: string; hint?: string; arr: unknown[]; el: z.ZodTypeAny; min: number; max: number; onChange: (v: unknown) => void; path: string; ctx: FormCtx; depth: number }) {
  const [open, setOpen] = useState<number | null>(arr.length === 1 ? 0 : null);
  const labelId = useId();
  const move = (i: number, d: 1 | -1) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const a = [...arr];
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
    if (open === i) setOpen(j);
  };
  return (
    <div role="group" aria-labelledby={labelId}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p id={labelId} className="text-[12.5px] font-bold text-ink">
          {label}
        </p>
        <span className="text-[11px] tabular-nums text-ink-3">
          {fmtNum(arr.length)}/{fmtNum(max)}
        </span>
      </div>
      {hint ? <p className="-mt-1 mb-2 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
      <ul className="space-y-2">
        {arr.map((item, i) => {
          const title = summarize(item, i);
          const isOpen = open === i;
          return (
            <li key={i} className="rounded-xl border border-edge/10 bg-edge/[0.02]">
              <div className="flex items-center gap-1 p-1.5">
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-start text-[12.5px] font-bold text-ink hover:bg-edge/[0.04]">
                  <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
                  <span className="truncate">{title}</span>
                </button>
                <IconBtn label={`حرّك «${title}» لأعلى`} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="size-4" strokeWidth={SW} aria-hidden="true" />
                </IconBtn>
                <IconBtn label={`حرّك «${title}» لأسفل`} onClick={() => move(i, 1)} disabled={i === arr.length - 1}>
                  <ArrowDown className="size-4" strokeWidth={SW} aria-hidden="true" />
                </IconBtn>
                <IconBtn label={`كرّر «${title}»`} onClick={() => onChange([...arr.slice(0, i + 1), JSON.parse(JSON.stringify(item)), ...arr.slice(i + 1)])} disabled={arr.length >= max}>
                  <Copy className="size-4" strokeWidth={SW} aria-hidden="true" />
                </IconBtn>
                <IconBtn
                  label={`احذف «${title}»`}
                  danger
                  disabled={arr.length <= min}
                  onClick={() => {
                    onChange(arr.filter((_, j) => j !== i));
                    setOpen(null);
                  }}
                >
                  <Trash2 className="size-4" strokeWidth={SW} aria-hidden="true" />
                </IconBtn>
              </div>
              {isOpen ? (
                <div className="border-t border-edge/[0.07] p-3.5">
                  <SchemaForm schema={el} value={item} onChange={(nv) => onChange(arr.map((x, j) => (j === i ? nv : x)))} path={path} ctx={ctx} depth={depth + 1} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {arr.length < max ? (
        <button
          type="button"
          onClick={() => {
            onChange([...arr, emptyOf(el)]);
            setOpen(arr.length);
          }}
          className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge/15 text-[12px] font-bold text-ink-2 transition-colors hover:border-nova/50 hover:text-ink"
        >
          <Plus className="size-4" aria-hidden="true" />
          أضف
        </button>
      ) : null}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-25", danger ? "text-bad hover:bg-bad/10" : "text-ink-3 hover:bg-edge/[0.06] hover:text-ink")}
    >
      {children}
    </button>
  );
}

// ─── اختيار من خيارات ───────────────────────────────────────────────────────

function Choice({ label, hint, options, value, onChange }: { label: string; hint?: string; options: { value: unknown; label: string }[]; value: unknown; onChange: (v: unknown) => void }) {
  const id = useId();
  if (options.length > 4)
    return (
      <Field label={label} hint={hint}>
        {(a) => (
          <select {...a} className={inputCls} value={String(value ?? "")} onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)?.value)}>
            {options.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  return (
    <div>
      <p id={id} className="mb-1.5 text-[12.5px] font-bold text-ink">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1 rounded-xl border border-edge/10 bg-edge/[0.03] p-1">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn("min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-[12px] font-bold transition-colors", on ? "bg-nova text-white shadow-sm" : "text-ink-2 hover:bg-edge/[0.05] hover:text-ink")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="mt-1.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
    </div>
  );
}

function UnionField({ inner, value, onChange, path, name, ctx, depth, label, hint }: { inner: z.ZodDiscriminatedUnion<string, z.ZodObject<z.ZodRawShape>[]>; value: unknown; onChange: (v: unknown) => void; path: string; name?: string; ctx: FormCtx; depth: number; label: string; hint?: string }) {
  const disc = inner.discriminator as string;
  const opts = inner.options as z.ZodObject<z.ZodRawShape>[];
  const valueOf = (o: z.ZodObject<z.ZodRawShape>) => String((o.shape[disc] as z.ZodLiteral<unknown>).value);
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const view = enumView(`${path}.${disc}`, opts.map(valueOf), obj[disc] ?? valueOf(opts[0]!));
  const cur = view.selected ?? valueOf(opts[0]!);
  const opt = opts.find((o) => valueOf(o) === cur) ?? opts[0]!;
  const sub = visibleKeys(path, Object.keys(opt.shape)).filter((k) => k !== disc);
  const set = (k: string, v: unknown) => onChange({ ...obj, [disc]: cur, [k]: v });

  return (
    <div className="space-y-3">
      <Field label={label} hint={hint}>
        {(a) => (
          <select
            {...a}
            className={inputCls}
            value={cur}
            onChange={(e) => {
              const next = opts.find((o) => valueOf(o) === e.target.value) ?? opts[0]!;
              onChange({ ...(emptyOf(next) as object), [disc]: e.target.value });
            }}
          >
            {view.options.map((o) => (
              <option key={o} value={o}>
                {ENUM_LABELS[o] ?? "غير مدعوم"}
              </option>
            ))}
          </select>
        )}
      </Field>
      {sub.map((k) => {
        const v = obj[k];
        if (k === "slug" && (cur === "category" || cur === "product" || cur === "page")) {
          const list = cur === "category" ? ctx.categories.map((c) => ({ v: c.slug, l: c.name })) : cur === "product" ? ctx.products.map((p) => ({ v: p.slug, l: p.name })) : (ctx.pages ?? []).map((p) => ({ v: p.slug, l: p.title }));
          const what = cur === "category" ? "القسم" : cur === "product" ? "المنتج" : "الصفحة";
          return (
            <Field key={k} label={what}>
              {(a) => (
                <select {...a} className={inputCls} value={typeof v === "string" ? v : ""} onChange={(e) => set(k, e.target.value)}>
                  <option value="">اختر {what}</option>
                  {list.map((x) => (
                    <option key={x.v} value={x.v}>
                      {x.l}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          );
        }
        if (k === "sectionId")
          return (
            <Field key={k} label="القسم">
              {(a) => (
                <select {...a} className={inputCls} value={typeof v === "string" ? v : ""} onChange={(e) => set(k, e.target.value)}>
                  <option value="">اختر القسم</option>
                  {(ctx.sections ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          );
        return <SchemaForm key={k} name={k} path={`${path}.${k}`} schema={opt.shape[k] as z.ZodTypeAny} value={v} onChange={(nv) => set(k, nv)} ctx={ctx} depth={depth + 1} />;
      })}
      {name === "source" && cur === "category" && !ctx.categories.length ? <p className="text-[11.5px] text-warn">لا أقسام في متجرك بعد.</p> : null}
    </div>
  );
}

// ─── أرقام وتواريخ ──────────────────────────────────────────────────────────

function NumberField({ label, hint, value, min, max, onChange, percent }: { label: string; hint?: string; value: number | undefined; min?: number; max?: number; onChange: (v: unknown) => void; percent?: boolean }) {
  const slider = min !== undefined && max !== undefined && (max - min <= 100 || max <= 1);
  const step = max !== undefined && max <= 1 ? 0.05 : 1;
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => setText(value === undefined ? "" : String(value)), [value]);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <Field label={label} hint={hint}>
      {(a) =>
        slider ? (
          <div className="flex items-center gap-3">
            <input {...a} type="range" min={min} max={max} step={step} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 cursor-pointer accent-[var(--dash-nova)]" />
            <span className="w-12 shrink-0 text-center text-[12.5px] font-black tabular-nums text-ink">{percent ? `${fmtNum(Math.round((value ?? 0) * 100))}%` : fmtNum(value ?? min ?? 0)}</span>
          </div>
        ) : (
          <input
            {...a}
            inputMode="numeric"
            className={cn(inputCls, "max-w-40 tabular-nums")}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = toNumber(e.target.value);
              if (n !== null && Number.isFinite(n)) onChange(clamp(Math.round(n)));
            }}
            onBlur={() => setText(value === undefined ? "" : String(value))}
          />
        )
      }
    </Field>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
/** «YYYY-MM-DDTHH:mm» بتوقيت جهاز التاجر (حقل datetime-local لا يفهم المنطقة الزمنية). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DateTimeField({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: unknown) => void }) {
  const past = value && new Date(value).getTime() < Date.now();
  return (
    <Field label={label} hint={past ? "انتهى هذا الموعد: العدّاد لا يظهر حتى تختار موعداً قادماً" : hint} error={null}>
      {(a) => (
        <input
          {...a}
          type="datetime-local"
          className={cn(inputCls, "max-w-64")}
          value={value ? toLocalInput(value) : ""}
          onChange={(e) => {
            const d = new Date(e.target.value);
            if (!Number.isNaN(d.getTime())) onChange(d.toISOString());
          }}
        />
      )}
    </Field>
  );
}

// ─── أيقونات ومنتجات وأقسام ─────────────────────────────────────────────────

function IconPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: unknown) => void }) {
  const id = useId();
  return (
    <div>
      <p id={id} className="mb-1.5 text-[12.5px] font-bold text-ink">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex max-h-44 flex-wrap gap-1 overflow-y-auto rounded-xl border border-edge/10 bg-edge/[0.03] p-1.5">
        {ICON_NAMES.map((ic) => {
          const on = value === ic;
          return (
            <button
              key={ic}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={ICON_LABELS[ic] ?? ic}
              title={ICON_LABELS[ic] ?? ic}
              onClick={() => onChange(ic)}
              className={cn("grid size-10 place-items-center rounded-lg transition-colors", on ? "bg-nova text-white" : "text-ink-2 hover:bg-edge/[0.06] hover:text-ink")}
            >
              <Icon name={ic} className="size-[18px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProductPicker({ label, hint, value, onChange, products, max, min }: { label: string; hint?: string; value: string[]; onChange: (v: unknown) => void; products: FormCtx["products"]; max: number; min: number }) {
  const [q, setQ] = useState("");
  const byslug = useMemo(() => new Map(products.map((p) => [p.slug, p.name])), [products]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? products.filter((p) => p.name.toLowerCase().includes(t)) : products).slice(0, 80);
  }, [q, products]);
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : value.length < max ? [...value, slug] : value);
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p id={id} className="text-[12.5px] font-bold text-ink">
          {label}
        </p>
        <span className={cn("text-[11px] tabular-nums", value.length < min ? "font-bold text-warn" : "text-ink-3")}>
          {fmtNum(value.length)}/{fmtNum(max)}
        </span>
      </div>
      {hint ? <p className="-mt-1 mb-2 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
      {value.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-lg bg-nova/10 py-1 pe-1 ps-2.5 text-[12px] font-bold text-nova-2">
              {byslug.get(s) ?? "منتج محذوف"}
              <button type="button" onClick={() => toggle(s)} className="grid size-6 place-items-center rounded-md hover:bg-nova/15" aria-label={`إزالة ${byslug.get(s) ?? "المنتج"}`}>
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {products.length ? (
        <div className="rounded-xl border border-edge/10 bg-edge/[0.02]">
          <div className="relative border-b border-edge/[0.07]">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المنتج" aria-label="ابحث باسم المنتج" className="h-10 w-full bg-transparent pe-3 ps-9 text-[12.5px] text-ink outline-none placeholder:text-ink-3/80" />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {list.map((p) => {
              const on = value.includes(p.slug);
              return (
                <li key={p.slug}>
                  <label className={cn("flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] font-bold", on ? "text-ink" : "text-ink-2 hover:bg-edge/[0.04]", !on && value.length >= max && "cursor-not-allowed opacity-40")}>
                    <input type="checkbox" checked={on} disabled={!on && value.length >= max} onChange={() => toggle(p.slug)} className="size-4 accent-[var(--dash-nova)]" />
                    <span className="truncate">{p.name}</span>
                  </label>
                </li>
              );
            })}
            {!list.length ? <li className="p-3 text-center text-[12px] text-ink-3">لا منتج بهذا الاسم</li> : null}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-edge/15 p-3 text-[12px] text-ink-3">أضف منتجات أولاً من صفحة المنتجات.</p>
      )}
    </div>
  );
}

function CategoryChips({ label, hint, value, onChange, categories }: { label: string; hint?: string; value: string[]; onChange: (v: unknown) => void; categories: FormCtx["categories"] }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-1.5 text-[12.5px] font-bold text-ink">
        {label}
      </p>
      {categories.length ? (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const on = value.includes(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? value.filter((x) => x !== c.slug) : [...value, c.slug])}
                className={cn("min-h-9 rounded-full border px-3.5 text-[12px] font-bold transition-colors", on ? "border-nova/50 bg-nova/15 text-ink" : "border-edge/10 text-ink-2 hover:bg-edge/[0.05]")}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[12px] text-ink-3">لا أقسام في متجرك بعد.</p>
      )}
      {hint ? <p className="mt-1.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
    </div>
  );
}

// ─── صور ───────────────────────────────────────────────────────────────────

/** الملفات المختارة ثم تفريغ الحقل (ليعمل اختيار الملف نفسه مرة أخرى). */
function takeFiles(input: HTMLInputElement): File[] {
  const files = Array.from(input.files ?? []);
  input.value = "";
  return files;
}

/** معاينة صورة من مساحة المتجر فقط (رابط فارغ أو خارجي لا يُحمَّل). */
function Thumb({ url, className, style }: { url: string; className?: string; style?: React.CSSProperties }) {
  if (!url || !isHostedImage(url)) return <span className={cn("grid place-items-center bg-edge/[0.06] text-[11px] text-ink-3", className)}>لا معاينة</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={cn("object-cover", className)} style={style} />;
}

function UploadTile({ onFiles, busy, multiple, label, className }: { onFiles: (f: File[]) => void; busy: boolean; multiple?: boolean; label: string; className?: string }) {
  return (
    <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-edge/15 text-[12px] font-bold text-ink-2 transition-colors hover:border-nova/50 hover:text-ink focus-within:border-nova/60", busy && "pointer-events-none opacity-60", className)}>
      {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" strokeWidth={SW} aria-hidden="true" />}
      {busy ? "جارٍ الرفع…" : label}
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" multiple={multiple} className="sr-only" onChange={(e) => onFiles(takeFiles(e.target))} />
    </label>
  );
}

function ImageField({ label, hint, value, onChange, optional }: { label: string; hint?: string; value?: Img; onChange: (v: unknown) => void; optional: boolean }) {
  const { upload, busy } = useImageUpload();
  const id = useId();
  const has = Boolean(value?.url);
  const pick = async (files: File[]) => {
    const [url] = await upload(files, 1);
    if (url) onChange({ url, alt: value?.alt ?? "", focalX: 0.5, focalY: 0.5 });
  };
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-1.5 text-[12.5px] font-bold text-ink">
        {label}
        {optional ? <span className="ms-1 font-normal text-ink-3">(اختياري)</span> : null}
      </p>
      {!has || !value ? (
        <UploadTile onFiles={pick} busy={busy > 0} label="ارفع صورة" className="h-28 w-full" />
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            className="relative block aspect-video w-full cursor-crosshair overflow-hidden rounded-xl border border-edge/10"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onChange({ ...value, focalX: +((e.clientX - r.left) / r.width).toFixed(2), focalY: +((e.clientY - r.top) / r.height).toFixed(2) });
            }}
            aria-label="حدد أهم جزء في الصورة"
          >
            <Thumb url={value.url} className="size-full" style={{ objectPosition: `${value.focalX * 100}% ${value.focalY * 100}%` }} />
            <span aria-hidden="true" className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-nova/80 shadow" style={{ left: `${value.focalX * 100}%`, top: `${value.focalY * 100}%` }} />
          </button>
          <p className="text-[11.5px] leading-5 text-ink-3">اضغط على أهم جزء في الصورة ليبقى ظاهراً حين تُقص على الموبايل.</p>
          <Field label="وصف الصورة" hint="لمحركات البحث ولمن يستخدم قارئ الشاشة" optional>
            {(a) => <input {...a} dir="auto" maxLength={200} className={inputCls} value={value.alt ?? ""} onChange={(e) => onChange({ ...value, alt: e.target.value })} />}
          </Field>
          <div className="flex flex-wrap gap-2">
            <label className={cn("inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05]", busy && "pointer-events-none opacity-60")}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
              استبدل
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="sr-only" onChange={(e) => void pick(takeFiles(e.target))} />
            </label>
            {optional ? (
              <button type="button" onClick={() => onChange(undefined)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-bad/20 px-3 text-[12px] font-bold text-bad hover:bg-bad/10">
                <Trash2 className="size-4" aria-hidden="true" />
                احذف
              </button>
            ) : null}
          </div>
        </div>
      )}
      {hint ? <p className="mt-1.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
    </div>
  );
}

function ImagesField({ label, hint, value, onChange, max }: { label: string; hint?: string; value: Img[]; onChange: (v: unknown) => void; max: number }) {
  const { upload, busy } = useImageUpload();
  const id = useId();
  const imgs = value.filter((i) => i?.url);
  const move = (i: number, d: 1 | -1) => {
    const j = i + d;
    if (j < 0 || j >= imgs.length) return;
    const a = [...imgs];
    [a[i], a[j]] = [a[j]!, a[i]!];
    onChange(a);
  };
  return (
    <div role="group" aria-labelledby={id}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p id={id} className="text-[12.5px] font-bold text-ink">
          {label}
        </p>
        <span className="text-[11px] tabular-nums text-ink-3">
          {fmtNum(imgs.length)}/{fmtNum(max)}
        </span>
      </div>
      {hint ? <p className="-mt-1 mb-2 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {imgs.map((im, i) => (
          <div key={im.url + i} className="group relative aspect-square overflow-hidden rounded-xl border border-edge/10">
            <Thumb url={im.url} className="size-full" />
            {i === 0 ? <span className="absolute start-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">الأولى</span> : null}
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <span className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="قدّمها" className="grid size-8 place-items-center rounded-lg bg-black/60 text-white disabled:opacity-30">
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === imgs.length - 1} aria-label="أخّرها" className="grid size-8 place-items-center rounded-lg bg-black/60 text-white disabled:opacity-30">
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </button>
              </span>
              <button type="button" onClick={() => onChange(imgs.filter((_, j) => j !== i))} aria-label="احذف الصورة" className="grid size-8 place-items-center rounded-lg bg-black/60 text-white hover:bg-bad">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        {imgs.length < max ? (
          <UploadTile
            multiple
            busy={busy > 0}
            label={busy ? "" : "أضف صوراً"}
            className="aspect-square"
            onFiles={async (files) => {
              const urls = await upload(files, max - imgs.length);
              if (urls.length) onChange([...imgs, ...urls.map((url) => ({ url, alt: "", focalX: 0.5, focalY: 0.5 }))]);
            }}
          />
        ) : null}
      </div>
      {busy > 1 ? <p className="mt-1.5 text-[11.5px] text-ink-3">باقي {arCount(busy, NOUN.image)}…</p> : null}
    </div>
  );
}

/** صورة يُحفظ رابطها نصاً (أيقونة التبويب، صورة المشاركة). */
function UrlImageField({ label, hint, value, onChange, square }: { label: string; hint?: string; value: string; onChange: (v: string) => void; square?: boolean }) {
  const { upload, busy } = useImageUpload();
  const id = useId();
  const pick = async (files: File[]) => {
    const [url] = await upload(files, 1);
    if (url) onChange(url);
  };
  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-1.5 text-[12.5px] font-bold text-ink">
        {label} <span className="font-normal text-ink-3">(اختياري)</span>
      </p>
      <div className="flex items-center gap-3">
        {value ? <Thumb url={value} className={cn("shrink-0 rounded-xl border border-edge/10", square ? "size-16" : "aspect-[1.91/1] w-40")} /> : null}
        <div className="flex flex-wrap gap-2">
          <label className={cn("inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05]", busy && "pointer-events-none opacity-60")}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
            {value ? "استبدل" : "ارفع صورة"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(takeFiles(e.target))} />
          </label>
          {value ? (
            <button type="button" onClick={() => onChange("")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-bad/20 px-3 text-[12px] font-bold text-bad hover:bg-bad/10">
              <Trash2 className="size-4" aria-hidden="true" />
              احذف
            </button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="mt-1.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
    </div>
  );
}
