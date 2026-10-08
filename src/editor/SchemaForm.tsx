"use client";

// SchemaForm — تحديثات:
// - Color Presets مضمّنة بجانب حقل الألوان (Hex).
// - Focal Point محفوظ ومحدَّث (موجود).
// - Zero emoji (تم بالفعل).
import { z } from "zod";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  Copy,
} from "lucide-react";
import { UploadButton } from "@/lib/uploadthing-client";
import { Icon } from "@/components/storefront/Icon";
import { FIELD_LABELS, ENUM_LABELS, ICONS } from "./field-meta";
import { cn } from "@/lib/utils";

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
  name?: string;
  ctx: FormCtx;
  depth?: number;
};

const I =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[#6f86ff]/30";

// Presets مناسبة للثيمات Cosmic.
const COLOR_PRESETS = [
  "#6f86ff",
  "#8fa8ff",
  "#a78bfa",
  "#f472b6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#0f172a",
  "#eaf0ff",
  "#ffffff",
];

const lbl = (n?: string) =>
  (n && FIELD_LABELS[n]?.label) ||
  (n ?? "").replace(/([A-Z])/g, " $1").replace(/_/g, " ");

const Label = ({
  name,
  children,
}: {
  name?: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold text-[#c3cdf0]">
      {lbl(name)}
      {name && FIELD_LABELS[name]?.hint ? (
        <span className="ms-1 font-normal text-[#8d97c4]">
          · {FIELD_LABELS[name].hint}
        </span>
      ) : null}
    </span>
    {children}
  </label>
);

function unwrap(s: z.ZodTypeAny): {
  inner: z.ZodTypeAny;
  optional: boolean;
  def?: unknown;
} {
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
  const { inner, def } = unwrap(s);
  if (def !== undefined) return def;
  if (inner instanceof z.ZodString) return "";
  if (inner instanceof z.ZodNumber) return inner.minValue ?? 0;
  if (inner instanceof z.ZodBoolean) return false;
  if (inner instanceof z.ZodEnum) return inner.options[0];
  if (inner instanceof z.ZodLiteral) return inner.value;
  if (inner instanceof z.ZodArray) return [];
  if (inner instanceof z.ZodObject)
    return Object.fromEntries(
      Object.entries(inner.shape).map(([k, v]) => [k, emptyOf(v as z.ZodTypeAny)])
    );
  if (inner instanceof z.ZodDiscriminatedUnion) return emptyOf(inner.options[0]);
  if (inner instanceof z.ZodUnion) return emptyOf(inner.options[0]);
  return undefined;
}

const isImage = (o: z.ZodObject<z.ZodRawShape>) =>
  "url" in o.shape && "focalX" in o.shape;

const isCta = (o: z.ZodObject<z.ZodRawShape>) =>
  "label" in o.shape && "target" in o.shape;

export function SchemaForm({
  schema,
  value,
  onChange,
  name,
  ctx,
  depth = 0,
}: P) {
  const { inner, optional } = unwrap(schema);
  const v = value;

  if (name === "icon" && inner instanceof z.ZodString) {
    return (
      <Label name={name}>
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-2">
          {ICONS.map((ic) => (
            <button
              type="button"
              key={ic}
              onClick={() => onChange(ic)}
              className={cn(
                "grid size-8 place-items-center rounded-md transition-colors hover:bg-white/10",
                v === ic && "bg-[#6f86ff] text-white hover:bg-[#6f86ff]"
              )}
              aria-label={ic}
            >
              <Icon name={ic} className="size-4" />
            </button>
          ))}
        </div>
      </Label>
    );
  }

  if (name === "couponCode" && inner instanceof z.ZodString) {
    return (
      <Label name={name}>
        <input
          className={I + " font-mono uppercase"}
          value={(v as string) ?? ""}
          onChange={(e) => onChange(e.target.value.toUpperCase() || undefined)}
        />
      </Label>
    );
  }

  if (name === "endsAt" && inner instanceof z.ZodString) {
    return (
      <Label name={name}>
        <input
          type="datetime-local"
          className={I}
          value={v ? new Date(v as string).toISOString().slice(0, 16) : ""}
          onChange={(e) => onChange(new Date(e.target.value).toISOString())}
        />
      </Label>
    );
  }

  if (
    (name === "body" || name === "description") &&
    inner instanceof z.ZodString
  ) {
    return (
      <Label name={name}>
        <textarea
          className={I + " leading-7"}
          rows={8}
          dir="auto"
          value={(v as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </Label>
    );
  }

  if (
    (name === "spotlightProductSlug" ||
      name === "productSlugs" ||
      name === "slugs") &&
    ctx.products.length
  ) {
    const multi = inner instanceof z.ZodArray;
    return (
      <Label name={name}>
        <select
          multiple={multi}
          className={cn(I, multi && "h-36")}
          value={(v as string | string[]) ?? (multi ? [] : "")}
          onChange={(e) =>
            onChange(
              multi
                ? Array.from(e.target.selectedOptions).map((o) => o.value)
                : e.target.value || undefined
            )
          }
        >
          {!multi ? <option value="">اختر منتجًا</option> : null}
          {ctx.products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </Label>
    );
  }

  if (name === "categorySlugs") {
    return (
      <Label name={name}>
        <div className="flex flex-wrap gap-1">
          {ctx.categories.map((c) => {
            const on = ((v as string[]) ?? []).includes(c.slug);
            return (
              <button
                type="button"
                key={c.slug}
                onClick={() =>
                  onChange(
                    on
                      ? (v as string[]).filter((x) => x !== c.slug)
                      : [...((v as string[]) ?? []), c.slug]
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                  on
                    ? "border-[#6f86ff] bg-[#6f86ff]/20 text-white"
                    : "border-white/10 text-[#c3cdf0] hover:bg-white/5"
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </Label>
    );
  }

  if (inner instanceof z.ZodString) {
    const checks = inner._def.checks as { kind: string; regex?: RegExp; value?: number }[];
    const isHex = checks.some(
      (c) => c.kind === "regex" && c.regex && String(c.regex).includes("0-9a-fA-F")
    );
    const isUrl = checks.some((c) => c.kind === "url");
    const maxCheck = checks.find((c) => c.kind === "max");
    const max = maxCheck?.value ?? inner.maxLength ?? 0;

    if (isHex) {
      return (
        <Label name={name}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(v as string) ?? "#000000"}
                onChange={(e) => onChange(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                aria-label="اختر لوناً"
              />
              <input
                className={I + " font-mono"}
                dir="ltr"
                value={(v as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange(c)}
                  className={cn(
                    "size-6 rounded-md border transition-transform hover:scale-110",
                    v === c
                      ? "border-white ring-2 ring-[#6f86ff]/40"
                      : "border-white/20"
                  )}
                  style={{ background: c }}
                  aria-label={c}
                  title={c}
                />
              ))}
            </div>
          </div>
        </Label>
      );
    }

    if (isUrl) {
      return (
        <Label name={name}>
          <input
            className={I}
            dir="ltr"
            placeholder="https://"
            value={(v as string) ?? ""}
            onChange={(e) =>
              onChange(e.target.value || (optional ? undefined : ""))
            }
          />
        </Label>
      );
    }

    if (max > 150) {
      return (
        <Label name={name}>
          <textarea
            className={I}
            rows={3}
            dir="auto"
            value={(v as string) ?? ""}
            onChange={(e) =>
              onChange(e.target.value || (optional ? undefined : ""))
            }
          />
          {max > 0 ? (
            <span className="mt-1 block text-end text-[10px] text-[#8d97c4]">
              {((v as string) ?? "").length}/{max}
            </span>
          ) : null}
        </Label>
      );
    }

    return (
      <Label name={name}>
        <input
          className={I}
          dir="auto"
          value={(v as string) ?? ""}
          onChange={(e) =>
            onChange(e.target.value || (optional ? undefined : ""))
          }
          maxLength={max || undefined}
        />
      </Label>
    );
  }

  if (inner instanceof z.ZodNumber) {
    const min = inner.minValue ?? undefined;
    const max = inner.maxValue ?? undefined;
    const slider =
      (min !== undefined && max !== undefined && max - min <= 100) ||
      (max !== undefined && max <= 1);
    return (
      <Label name={name}>
        <div className="flex items-center gap-3">
          {slider ? (
            <input
              type="range"
              min={min}
              max={max}
              step={max !== undefined && max <= 1 ? 0.05 : 1}
              value={(v as number) ?? min}
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1 accent-[#6f86ff]"
            />
          ) : null}
          <input
            type="number"
            min={min}
            max={max}
            step={max !== undefined && max <= 1 ? 0.05 : 1}
            className={cn(I, slider && "w-20")}
            value={(v as number) ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? undefined : Number(e.target.value))
            }
          />
        </div>
      </Label>
    );
  }

  if (inner instanceof z.ZodBoolean) {
    return (
      <label className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm font-bold text-[#c3cdf0]">{lbl(name)}</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!v}
          onClick={() => onChange(!v)}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            v ? "bg-[#6f86ff]" : "bg-white/10"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
              v ? "start-[22px]" : "start-0.5"
            )}
          />
        </button>
      </label>
    );
  }

  if (inner instanceof z.ZodEnum) {
    const opts = inner.options as string[];
    return (
      <Label name={name}>
        {opts.length <= 5 ? (
          <div className="flex flex-wrap gap-1 rounded-lg bg-white/5 p-1">
            {opts.map((o) => (
              <button
                type="button"
                key={o}
                onClick={() => onChange(o)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  v === o ? "bg-[#6f86ff] text-white" : "text-[#c3cdf0]"
                )}
              >
                {ENUM_LABELS[o] ?? o}
              </button>
            ))}
          </div>
        ) : (
          <select
            className={I}
            value={(v as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          >
            {opts.map((o) => (
              <option key={o} value={o}>
                {ENUM_LABELS[o] ?? o}
              </option>
            ))}
          </select>
        )}
      </Label>
    );
  }

  if (inner instanceof z.ZodLiteral) return null;

  if (inner instanceof z.ZodUnion) {
    const lits = inner.options
      .filter((o: z.ZodTypeAny) => o instanceof z.ZodLiteral)
      .map((o: z.ZodLiteral<unknown>) => o.value);
    if (lits.length) {
      return (
        <Label name={name}>
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            {lits.map((l: unknown) => (
              <button
                type="button"
                key={String(l)}
                onClick={() => onChange(l)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-xs font-bold transition-colors",
                  v === l ? "bg-[#6f86ff] text-white" : "text-[#c3cdf0]"
                )}
              >
                {String(l)}
              </button>
            ))}
          </div>
        </Label>
      );
    }
  }

  if (inner instanceof z.ZodDiscriminatedUnion) {
    const disc = inner.discriminator as string;
    const opts = inner.options as z.ZodObject<z.ZodRawShape>[];
    const cur =
      (v as Record<string, unknown>)?.[disc] ??
      (opts[0]!._def.shape()[disc] as z.ZodLiteral<unknown>).value;
    const opt = opts.find(
      (o) =>
        (o._def.shape()[disc] as z.ZodLiteral<unknown>).value === cur
    ) ?? opts[0]!;
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
        <Label name={name}>
          <select
            className={I}
            value={String(cur)}
            onChange={(e) => {
              const next = opts.find(
                (o) =>
                  (o._def.shape()[disc] as z.ZodLiteral<unknown>).value ===
                  e.target.value
              );
              onChange({
                ...(emptyOf(next ?? opts[0]!) as object),
                [disc]: e.target.value,
              });
            }}
          >
            {opts.map((o) => {
              const val = (o._def.shape()[disc] as z.ZodLiteral<unknown>).value;
              return (
                <option key={String(val)} value={String(val)}>
                  {ENUM_LABELS[String(val)] ?? String(val)}
                </option>
              );
            })}
          </select>
        </Label>
        <div className="mt-2 space-y-2">
          {Object.entries(opt.shape)
            .filter(([k]) => k !== disc)
            .map(([k, sub]) => {
              if (k === "slug" && cur === "category") {
                return (
                  <Label key={k} name="category">
                    <select
                      className={I}
                      value={(v as Record<string, unknown>)?.slug as string ?? ""}
                      onChange={(e) =>
                        onChange({ ...(v as object), slug: e.target.value })
                      }
                    >
                      <option value="">اختر قسمًا</option>
                      {ctx.categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Label>
                );
              }
              if (k === "slug" && cur === "product") {
                return (
                  <Label key={k} name="product">
                    <select
                      className={I}
                      value={(v as Record<string, unknown>)?.slug as string ?? ""}
                      onChange={(e) =>
                        onChange({ ...(v as object), slug: e.target.value })
                      }
                    >
                      <option value="">اختر منتجًا</option>
                      {ctx.products.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Label>
                );
              }
              if (k === "slug" && cur === "page") {
                return (
                  <Label key={k} name="page">
                    <select
                      className={I}
                      value={(v as Record<string, unknown>)?.slug as string ?? ""}
                      onChange={(e) =>
                        onChange({ ...(v as object), slug: e.target.value })
                      }
                    >
                      {(ctx.pages ?? []).map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </Label>
                );
              }
              if (k === "sectionId") {
                return (
                  <Label key={k} name="section">
                    <select
                      className={I}
                      value={
                        ((v as Record<string, unknown>)?.sectionId as string) ?? ""
                      }
                      onChange={(e) =>
                        onChange({ ...(v as object), sectionId: e.target.value })
                      }
                    >
                      {(ctx.sections ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Label>
                );
              }
              return (
                <SchemaForm
                  key={k}
                  name={k}
                  schema={sub as z.ZodTypeAny}
                  value={(v as Record<string, unknown>)?.[k]}
                  onChange={(nv) =>
                    onChange({ ...(v as object), [k]: nv })
                  }
                  ctx={ctx}
                  depth={depth + 1}
                />
              );
            })}
        </div>
      </div>
    );
  }

  if (inner instanceof z.ZodObject) {
    if (isImage(inner)) {
      return (
        <Label name={name}>
          <ImageField value={v as never} onChange={onChange} optional={optional} />
        </Label>
      );
    }
    const entries = Object.entries(inner.shape).filter(
      ([k]) => !["id", "type", "schemaVersion"].includes(k)
    );
    const content = (
      <div className="space-y-3">
        {entries.map(([k, sub]) => (
          <SchemaForm
            key={k}
            name={k}
            schema={sub as z.ZodTypeAny}
            value={(v as Record<string, unknown>)?.[k]}
            onChange={(nv) =>
              onChange({ ...((v as object) ?? {}), [k]: nv })
            }
            ctx={ctx}
            depth={depth + 1}
          />
        ))}
      </div>
    );
    if (depth === 0) return content;
    if (optional && v === undefined) {
      return (
        <div className="flex items-center justify-between rounded-lg border border-dashed border-white/10 p-2 text-sm">
          <span className="font-bold text-[#c3cdf0]">{lbl(name)}</span>
          <button
            type="button"
            onClick={() => onChange(emptyOf(inner))}
            className="rounded bg-[#6f86ff] px-2 py-1 text-xs font-bold text-white"
          >
            + إضافة
          </button>
        </div>
      );
    }
    return (
      <Collapsible
        title={lbl(name)}
        onRemove={optional ? () => onChange(undefined) : undefined}
        defaultOpen={isCta(inner)}
      >
        {content}
      </Collapsible>
    );
  }

  if (inner instanceof z.ZodArray) {
    const arr = (v as unknown[]) ?? [];
    const el = inner.element as z.ZodTypeAny;
    const max = inner._def.maxLength?.value ?? 99;
    const { inner: elInner } = unwrap(el);
    const isImgArr = elInner instanceof z.ZodObject && isImage(elInner);
    const isStrArr = elInner instanceof z.ZodString;

    if (isStrArr) {
      return (
        <Label name={name}>
          <input
            className={I}
            placeholder="مفصولة بفاصلة"
            value={arr.join("، ")}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split(/[،,]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </Label>
      );
    }

    if (isImgArr) {
      return (
        <Label name={name}>
          <div className="flex flex-wrap gap-2">
            {arr.map((im: unknown, i) => {
              const img = im as { url: string };
              return (
                <div
                  key={img.url + i}
                  className="relative size-20"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("i", String(i))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const from = Number(e.dataTransfer.getData("i"));
                    const a = [...arr];
                    const [m] = a.splice(from, 1);
                    if (m) a.splice(i, 0, m);
                    onChange(a);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-full rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      onChange(arr.filter((_, j) => j !== i))
                    }
                    className="absolute -end-1 -top-1 grid size-6 place-items-center rounded-full bg-rose-500 text-white"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-3" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            {arr.length < max ? (
              <UploadButton
                endpoint="brandAsset"
                onClientUploadComplete={(r) =>
                  onChange([
                    ...arr,
                    {
                      url: r[0]?.ufsUrl ?? r[0]!.url,
                      alt: "",
                      focalX: 0.5,
                      focalY: 0.5,
                    },
                  ])
                }
                content={{ button: <Plus className="size-5" /> }}
                appearance={{
                  button:
                    "size-20 rounded-lg border-2 border-dashed border-white/15 text-[#8d97c4] hover:border-[#6f86ff]/50",
                }}
              />
            ) : null}
          </div>
        </Label>
      );
    }

    return (
      <div>
        <span className="mb-1 block text-xs font-bold text-[#c3cdf0]">
          {lbl(name)}{" "}
          <span className="font-normal text-[#8d97c4]">
            ({arr.length}/{max})
          </span>
        </span>
        <div className="space-y-2">
          {arr.map((item, i) => (
            <Collapsible
              key={i}
              title={summarize(item, i)}
              onRemove={() => onChange(arr.filter((_, j) => j !== i))}
              onMove={(d) => {
                const j = i + d;
                if (j < 0 || j >= arr.length) return;
                const a = [...arr];
                [a[i], a[j]] = [a[j]!, a[i]!];
                onChange(a);
              }}
              onDuplicate={
                arr.length < max
                  ? () =>
                      onChange([
                        ...arr.slice(0, i + 1),
                        JSON.parse(JSON.stringify(item)),
                        ...arr.slice(i + 1),
                      ])
                  : undefined
              }
            >
              <SchemaForm
                schema={el}
                value={item}
                onChange={(nv) =>
                  onChange(arr.map((x, j) => (j === i ? nv : x)))
                }
                ctx={ctx}
                depth={depth + 1}
              />
            </Collapsible>
          ))}
        </div>
        {arr.length < max ? (
          <button
            type="button"
            onClick={() => onChange([...arr, emptyOf(el)])}
            className="mt-2 w-full rounded-lg border-2 border-dashed border-white/15 py-2 text-xs font-bold text-[#8d97c4] transition-colors hover:border-[#6f86ff]/50 hover:text-white"
          >
            + إضافة عنصر
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}

function summarize(item: unknown, i: number): string {
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    for (const k of ["title", "text", "name", "q", "label", "headline", "value", "kind"]) {
      if (typeof o[k] === "string" && o[k]) return String(o[k]).slice(0, 40);
    }
  }
  return `عنصر ${i + 1}`;
}

function Collapsible({
  title,
  children,
  onRemove,
  onMove,
  onDuplicate,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  onRemove?: () => void;
  onMove?: (d: 1 | -1) => void;
  onDuplicate?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-1 p-2">
        {onMove ? (
          <span className="text-[#8d97c4]">
            <GripVertical className="size-4" strokeWidth={2.25} aria-hidden="true" />
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2 text-start text-sm font-bold text-white"
        >
          {open ? (
            <ChevronUp className="size-4" strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" strokeWidth={2.25} aria-hidden="true" />
          )}
          {title}
        </button>
        {onMove ? (
          <>
            <button
              type="button"
              onClick={() => onMove(-1)}
              className="grid size-8 place-items-center rounded text-[#8d97c4] transition-colors hover:bg-white/5 hover:text-white"
              aria-label="أعلى"
            >
              <ChevronUp className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              className="grid size-8 place-items-center rounded text-[#8d97c4] transition-colors hover:bg-white/5 hover:text-white"
              aria-label="أسفل"
            >
              <ChevronDown className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            </button>
          </>
        ) : null}
        {onDuplicate ? (
          <button
            type="button"
            onClick={onDuplicate}
            className="grid size-8 place-items-center rounded text-[#8d97c4] transition-colors hover:bg-white/5 hover:text-white"
            aria-label="تكرار"
          >
            <Copy className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="grid size-8 place-items-center rounded text-rose-400 transition-colors hover:bg-rose-500/10"
            aria-label="حذف"
          >
            <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {open ? <div className="border-t border-white/10 p-3">{children}</div> : null}
    </div>
  );
}

function ImageField({
  value,
  onChange,
  optional,
}: {
  value?: { url: string; alt: string; focalX: number; focalY: number };
  onChange: (v: unknown) => void;
  optional: boolean;
}) {
  if (!value) {
    return (
      <UploadButton
        endpoint="brandAsset"
        onClientUploadComplete={(r) =>
          onChange({
            url: r[0]?.ufsUrl ?? r[0]!.url,
            alt: "",
            focalX: 0.5,
            focalY: 0.5,
          })
        }
        content={{ button: "رفع صورة" }}
        appearance={{
          button:
            "w-full rounded-lg border-2 border-dashed border-white/15 py-6 text-sm text-[#8d97c4] transition-colors hover:border-[#6f86ff]/50",
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-video cursor-crosshair overflow-hidden rounded-lg"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onChange({
            ...value,
            focalX: +((e.clientX - r.left) / r.width).toFixed(2),
            focalY: +((e.clientY - r.top) / r.height).toFixed(2),
          });
        }}
        title="اضغط لتحديد نقطة التركيز"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.url} alt="" className="size-full object-cover" />
        <span
          className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#6f86ff]/70 shadow"
          style={{
            left: `${value.focalX * 100}%`,
            top: `${value.focalY * 100}%`,
          }}
        />
      </div>
      <input
        className={I}
        placeholder="وصف الصورة (يساعد في جوجل)"
        value={value.alt}
        onChange={(e) => onChange({ ...value, alt: e.target.value })}
      />
      <div className="flex gap-2 text-xs">
        <UploadButton
          endpoint="brandAsset"
          onClientUploadComplete={(r) =>
            onChange({
              ...value,
              url: r[0]?.ufsUrl ?? r[0]!.url,
            })
          }
          content={{ button: "تغيير" }}
          appearance={{
            button:
              "rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-[#c3cdf0] hover:bg-white/5",
          }}
        />
        {optional ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10"
          >
            إزالة
          </button>
        ) : null}
      </div>
    </div>
  );
}