"use client";

// VariantMatrix — المقاسات والألوان كما يفكر فيها التاجر: يكتب الخيارات (اللون: أسود، كحلي / المقاس: S، M، L)،
// فتتولد كل التركيبات تلقائياً. مع خيارين تظهر مصفوفة (لون × مقاس) لكتابة المخزون في خانة واحدة لكل تركيبة،
// ومع أي عدد تظهر قائمة لكل تركيبة بسعرها ومخزونها وكودها وتوفرها. وأدوات جماعية للسعر والمخزون وفروق الأسعار.
// كل تركيبة موجودة تحتفظ بمعرّفها، فلا تنكسر سلات العملاء ولا الطلبات القديمة عند الحفظ.
import { useMemo, useState } from "react";
import { Plus, X, Grid3x3, List, Wand2, Shirt, Palette, Ruler, Layers, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { colorFromName, isColorOption } from "@/lib/color-names";

export type Variant = {
  id?: string;
  optionValues: string[];
  price?: number | null;
  stock?: number | null;
  sku?: string | null;
  imageUrl?: string | null;
  isAvailable?: boolean;
};

type Option = { name: string; values: string[] };

const NAME_PRESETS = [
  { name: "المقاس", icon: Ruler },
  { name: "اللون", icon: Palette },
  { name: "الخامة", icon: Layers },
  { name: "الموديل", icon: Shirt },
];

const VALUE_PRESETS: Record<string, { label: string; values: string[] }[]> = {
  size: [
    { label: "S → XXL", values: ["S", "M", "L", "XL", "XXL"] },
    { label: "36 → 46", values: ["36", "38", "40", "42", "44", "46"] },
    { label: "أحذية 37 → 45", values: ["37", "38", "39", "40", "41", "42", "43", "44", "45"] },
    { label: "فري سايز", values: ["فري سايز"] },
  ],
  color: [{ label: "ألوان أساسية", values: ["أسود", "أبيض", "كحلي", "بيج", "رمادي"] }],
};

const keyOf = (vals: string[]) => vals.join("\u0001");

function optionsFrom(names: string[], variants: Variant[]): Option[] {
  return names.map((name, i) => ({
    name,
    values: Array.from(new Set(variants.map((v) => v.optionValues[i]).filter((x): x is string => Boolean(x)))),
  }));
}

function combos(options: Option[]): string[][] {
  const live = options.filter((o) => o.values.length);
  if (!live.length) return [];
  return live.reduce<string[][]>((acc, o) => acc.flatMap((a) => o.values.map((v) => [...a, v])), [[]]);
}

export function VariantMatrix({
  optionNames,
  variants,
  basePrice,
  trackStock = true,
  onChange,
}: {
  optionNames: string[];
  variants: Variant[];
  /** سعر المنتج بالجنيه: التركيبة بلا سعر خاص تأخذه. */
  basePrice: number;
  /** بلا تتبع مخزون تختفي خانات الكمية (كل تركيبة متاحة ما لم يُخفها التاجر). */
  trackStock?: boolean;
  onChange: (optionNames: string[], variants: Variant[]) => void;
}) {
  const [options, setOptions] = useState<Option[]>(() => optionsFrom(optionNames, variants));
  const [view, setView] = useState<"matrix" | "list">("matrix");
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [bulkStock, setBulkStock] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");

  const byKey = useMemo(() => new Map(variants.map((v) => [keyOf(v.optionValues), v])), [variants]);

  /** يعيد توليد التركيبات من الخيارات، محتفظاً ببيانات أي تركيبة موجودة (ومعرّفها). */
  const apply = (next: Option[]) => {
    setOptions(next);
    const live = next.filter((o) => o.name.trim() && o.values.length);
    const rows = combos(live).map((vals) => {
      const old = byKey.get(keyOf(vals));
      return old ?? { optionValues: vals, price: null, stock: null, isAvailable: true };
    });
    onChange(
      live.map((o) => o.name.trim()),
      rows
    );
  };

  const patch = (vals: string[], p: Partial<Variant>) => {
    const k = keyOf(vals);
    onChange(
      options.filter((o) => o.name.trim() && o.values.length).map((o) => o.name.trim()),
      variants.map((v) => (keyOf(v.optionValues) === k ? { ...v, ...p } : v))
    );
  };

  const addValue = (oi: number, raw: string) => {
    const vals = raw
      .split(/[,،\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!vals.length) return;
    const next = options.map((o, i) => (i === oi ? { ...o, values: Array.from(new Set([...o.values, ...vals])) } : o));
    setDraft((d) => ({ ...d, [oi]: "" }));
    apply(next);
  };

  const live = options.filter((o) => o.name.trim() && o.values.length);
  const total = variants.reduce((a, v) => a + (v.isAvailable === false ? 0 : v.stock ?? 0), 0);
  const matrix = trackStock && live.length === 2 && view === "matrix";
  const priceOf = (v: Variant | undefined) => (v?.price ?? null) === null ? basePrice : Number(v!.price);

  return (
    <div className="space-y-4">
      {/* الخيارات */}
      <div className="space-y-3">
        {options.map((o, oi) => {
          const color = isColorOption(o.name);
          const kind = color ? "color" : /مقاس|size/i.test(o.name) ? "size" : "";
          return (
            <div key={oi} className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-3.5">
              <div className="flex items-center gap-2">
                <input
                  value={o.name}
                  onChange={(e) => apply(options.map((x, i) => (i === oi ? { ...x, name: e.target.value } : x)))}
                  placeholder="اسم الخيار (مثل: المقاس)"
                  list="variant-option-names"
                  maxLength={30}
                  className="h-10 w-40 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[12.5px] font-black text-ink outline-none focus:border-nova/60"
                />
                <span className="text-[11px] text-ink-3">{o.values.length ? `${fmtNum(o.values.length)} ${o.values.length === 1 ? "قيمة" : o.values.length === 2 ? "قيمتان" : o.values.length <= 10 ? "قيم" : "قيمة"}` : "أضف القيم"}</span>
                <button
                  type="button"
                  onClick={() => apply(options.filter((_, i) => i !== oi))}
                  className="ms-auto grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-bad/10 hover:text-bad"
                  aria-label={`حذف خيار ${o.name}`}
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {o.values.map((val) => {
                  const hex = color ? colorFromName(val) : null;
                  return (
                    <span key={val} className="inline-flex items-center gap-1.5 rounded-full border border-edge/10 bg-edge/[0.04] py-1 pe-1 ps-2.5 text-[12px] font-bold text-ink">
                      {color ? <span className="size-3.5 rounded-full ring-1 ring-edge/20" style={{ background: hex ?? "transparent" }} /> : null}
                      {val}
                      <button
                        type="button"
                        onClick={() => apply(options.map((x, i) => (i === oi ? { ...x, values: x.values.filter((y) => y !== val) } : x)))}
                        className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-edge/10 hover:text-ink"
                        aria-label={`حذف ${val}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  );
                })}
                <input
                  value={draft[oi] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/[,،]$/.test(v)) addValue(oi, v);
                    else setDraft((d) => ({ ...d, [oi]: v }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addValue(oi, draft[oi] ?? "");
                    } else if (e.key === "Backspace" && !(draft[oi] ?? "") && o.values.length) {
                      apply(options.map((x, i) => (i === oi ? { ...x, values: x.values.slice(0, -1) } : x)));
                    }
                  }}
                  onBlur={() => addValue(oi, draft[oi] ?? "")}
                  placeholder={color ? "اكتب لوناً ثم Enter" : "اكتب قيمة ثم Enter"}
                  className="h-8 min-w-36 flex-1 bg-transparent px-1 text-[12.5px] font-bold text-ink outline-none placeholder:text-ink-3/70"
                />
              </div>

              {(VALUE_PRESETS[kind] ?? []).length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {VALUE_PRESETS[kind]!.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => apply(options.map((x, i) => (i === oi ? { ...x, values: Array.from(new Set([...x.values, ...p.values])) } : x)))}
                      className="rounded-lg bg-nova/10 px-2 py-1 text-[11px] font-bold text-nova-2 hover:bg-nova/20"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {options.length < 3 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {NAME_PRESETS.filter((p) => !options.some((o) => o.name.trim() === p.name)).map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => setOptions([...options, { name, values: [] }])}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-edge/20 px-3 text-[12px] font-bold text-ink-2 hover:border-nova/50 hover:text-ink"
              >
                <Plus className="size-3.5" /> <Icon className="size-3.5" /> {name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOptions([...options, { name: "", values: [] }])}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-edge/20 px-3 text-[12px] font-bold text-ink-3 hover:text-ink"
            >
              <Plus className="size-3.5" /> خيار آخر
            </button>
          </div>
        ) : null}
        <datalist id="variant-option-names">
          {["المقاس", "اللون", "الخامة", "الموديل", "السعة", "الوزن", "الطول"].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      {variants.length ? (
        <>
          {/* أدوات جماعية */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-edge/[0.03] p-2.5 text-[12px]">
            <span className="flex items-center gap-1.5 px-1 font-black text-ink">
              <Wand2 className="size-3.5 text-nova" /> للكل:
            </span>
            <span className="flex items-center gap-1">
              <input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="السعر" dir="ltr" inputMode="decimal" className="h-8 w-20 rounded-lg border border-edge/10 bg-edge/[0.04] px-2 font-mono text-[12px] font-bold text-ink outline-none placeholder:font-sans" />
              <button type="button" disabled={!bulkPrice} onClick={() => (onChange(live.map((o) => o.name.trim()), variants.map((v) => ({ ...v, price: Number(bulkPrice) }))), setBulkPrice(""))} className="h-8 rounded-lg bg-nova/15 px-2.5 font-bold text-nova-2 disabled:opacity-40">
                طبّق
              </button>
            </span>
            {trackStock ? <span className="flex items-center gap-1">
              <input value={bulkStock} onChange={(e) => setBulkStock(e.target.value.replace(/\D/g, ""))} placeholder="المخزون" dir="ltr" inputMode="numeric" className="h-8 w-20 rounded-lg border border-edge/10 bg-edge/[0.04] px-2 font-mono text-[12px] font-bold text-ink outline-none placeholder:font-sans" />
              <button type="button" disabled={!bulkStock} onClick={() => (onChange(live.map((o) => o.name.trim()), variants.map((v) => ({ ...v, stock: Number(bulkStock) }))), setBulkStock(""))} className="h-8 rounded-lg bg-nova/15 px-2.5 font-bold text-nova-2 disabled:opacity-40">
                طبّق
              </button>
            </span> : null}
            <span className="ms-auto flex items-center gap-2 text-ink-3">
              <b className="text-ink tabular-nums">{fmtNum(variants.length)}</b> تركيبة
              {trackStock ? (
                <>
                  {" "}· <b className="text-ink tabular-nums">{fmtNum(total)}</b> قطعة
                </>
              ) : null}
            </span>
            {trackStock && live.length === 2 ? (
              <span className="flex rounded-lg border border-edge/10 p-0.5">
                <button type="button" onClick={() => setView("matrix")} aria-pressed={view === "matrix"} className={cn("grid size-7 place-items-center rounded-md", view === "matrix" ? "bg-nova text-white" : "text-ink-3")} aria-label="عرض المصفوفة">
                  <Grid3x3 className="size-3.5" />
                </button>
                <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={cn("grid size-7 place-items-center rounded-md", view === "list" ? "bg-nova text-white" : "text-ink-3")} aria-label="عرض القائمة">
                  <List className="size-3.5" />
                </button>
              </span>
            ) : null}
          </div>

          {matrix ? (
            <Matrix rows={live[0]!} cols={live[1]!} byKey={byKey} onStock={(vals, stock) => patch(vals, { stock })} />
          ) : null}

          {/* القائمة: سعر ومخزون وكود وتوفر لكل تركيبة. في وضع المصفوفة تبقى لفروق الأسعار. */}
          <div className="overflow-hidden rounded-2xl border border-edge/10">
            {matrix ? <p className="border-b border-edge/10 bg-edge/[0.03] px-3 py-2 text-[11.5px] font-bold text-ink-2">الأسعار والأكواد (اترك السعر فارغاً ليأخذ سعر المنتج)</p> : null}
            <ul className="max-h-[420px] divide-y divide-edge/5 overflow-y-auto">
              {variants.map((v) => {
                const k = keyOf(v.optionValues);
                const off = v.isAvailable === false;
                return (
                  <li key={k} className={cn("flex flex-wrap items-center gap-2 px-3 py-2.5", off && "opacity-55")}>
                    <span className="flex min-w-36 flex-1 flex-wrap items-center gap-1">
                      {v.optionValues.map((val, i) => {
                        const hex = isColorOption(live[i]?.name ?? "") ? colorFromName(val) : null;
                        return (
                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-edge/[0.05] px-1.5 py-0.5 text-[12px] font-bold text-ink">
                            {hex ? <span className="size-3 rounded-full ring-1 ring-edge/20" style={{ background: hex }} /> : null}
                            {val}
                          </span>
                        );
                      })}
                    </span>
                    <label className="flex items-center gap-1 text-[11px] text-ink-3">
                      سعر
                      <input
                        value={v.price ?? ""}
                        onChange={(e) => patch(v.optionValues, { price: e.target.value === "" ? null : Number(e.target.value.replace(/[^\d.]/g, "")) })}
                        placeholder={String(basePrice || "")}
                        dir="ltr"
                        inputMode="decimal"
                        className="h-8 w-20 rounded-lg border border-edge/10 bg-edge/[0.03] px-2 font-mono text-[12px] font-bold text-ink outline-none focus:border-nova/60"
                      />
                    </label>
                    {!matrix && trackStock ? (
                      <label className="flex items-center gap-1 text-[11px] text-ink-3">
                        مخزون
                        <input
                          value={v.stock ?? ""}
                          onChange={(e) => patch(v.optionValues, { stock: e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")) })}
                          dir="ltr"
                          inputMode="numeric"
                          className={cn("h-8 w-16 rounded-lg border bg-edge/[0.03] px-2 font-mono text-[12px] font-bold text-ink outline-none focus:border-nova/60", (v.stock ?? 0) === 0 ? "border-warn/50" : "border-edge/10")}
                        />
                      </label>
                    ) : null}
                    <input
                      value={v.sku ?? ""}
                      onChange={(e) => patch(v.optionValues, { sku: e.target.value.slice(0, 40) || null })}
                      placeholder="الكود (اختياري)"
                      dir="ltr"
                      className="h-8 w-28 rounded-lg border border-edge/10 bg-edge/[0.03] px-2 font-mono text-[11.5px] text-ink outline-none placeholder:font-sans focus:border-nova/60"
                    />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!off}
                      onClick={() => patch(v.optionValues, { isAvailable: off })}
                      className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold", off ? "bg-edge/[0.06] text-ink-3" : "bg-ok/12 text-ok")}
                    >
                      {off ? <X className="size-3" /> : <Check className="size-3" />} {off ? "مخفي" : "متاح"}
                    </button>
                    {priceOf(v) !== basePrice ? <span className="text-[10.5px] font-bold text-nova-2">{priceOf(v) > basePrice ? "+" : ""}{fmtNum(priceOf(v) - basePrice)} ج</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
          {trackStock && variants.some((v) => (v.stock ?? 0) === 0 && v.isAvailable !== false) ? (
            <p className="flex items-center gap-1.5 text-[11.5px] text-warn">
              <AlertCircle className="size-3.5" /> تركيبات بمخزون صفر تظهر للعميل «نفد».
            </p>
          ) : null}
        </>
      ) : options.length ? (
        <p className="text-[11.5px] text-ink-3">أضف قيم الخيارات لتتولد التركيبات تلقائياً.</p>
      ) : (
        <p className="text-[11.5px] text-ink-3">منتج بسيط بدون مقاسات أو ألوان. أضف خياراً إن كان له مقاسات أو ألوان.</p>
      )}
    </div>
  );
}

/** مصفوفة خيارين: الصفوف قيم الخيار الأول والأعمدة قيم الثاني، وفي كل خانة مخزون التركيبة. */
function Matrix({ rows, cols, byKey, onStock }: { rows: Option; cols: Option; byKey: Map<string, Variant>; onStock: (vals: string[], stock: number | null) => void }) {
  const rowColor = isColorOption(rows.name);
  const colColor = isColorOption(cols.name);
  return (
    <div className="overflow-x-auto rounded-2xl border border-edge/10">
      <table className="w-full min-w-max border-collapse text-[12px]">
        <thead>
          <tr className="bg-edge/[0.04]">
            <th className="sticky start-0 z-10 bg-space px-3 py-2 text-start text-[11px] font-black text-ink-3">
              {rows.name} \ {cols.name}
            </th>
            {cols.values.map((c) => (
              <th key={c} className="px-2 py-2 text-center font-black text-ink">
                <span className="inline-flex items-center gap-1">
                  {colColor && colorFromName(c) ? <span className="size-3 rounded-full ring-1 ring-edge/20" style={{ background: colorFromName(c)! }} /> : null}
                  {c}
                </span>
              </th>
            ))}
            <th className="px-3 py-2 text-center text-[11px] font-black text-ink-3">المجموع</th>
          </tr>
        </thead>
        <tbody>
          {rows.values.map((r) => {
            const sum = cols.values.reduce((a, c) => a + (byKey.get(keyOf([r, c]))?.stock ?? 0), 0);
            return (
              <tr key={r} className="border-t border-edge/5">
                <th className="sticky start-0 z-10 bg-space px-3 py-1.5 text-start font-black text-ink">
                  <span className="inline-flex items-center gap-1.5">
                    {rowColor && colorFromName(r) ? <span className="size-3.5 rounded-full ring-1 ring-edge/20" style={{ background: colorFromName(r)! }} /> : null}
                    {r}
                  </span>
                </th>
                {cols.values.map((c) => {
                  const v = byKey.get(keyOf([r, c]));
                  const stock = v?.stock ?? 0;
                  return (
                    <td key={c} className="px-1.5 py-1.5 text-center">
                      <input
                        value={v && v.stock !== null && v.stock !== undefined ? String(v.stock) : ""}
                        disabled={!v}
                        placeholder="0"
                        onChange={(e) => onStock([r, c], e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")) || 0)}
                        onFocus={(e) => e.currentTarget.select()}
                        dir="ltr"
                        inputMode="numeric"
                        aria-label={`مخزون ${r} ${c}`}
                        className={cn(
                          "h-9 w-14 rounded-lg border text-center font-mono text-[12.5px] font-bold outline-none focus:border-nova/60 focus:ring-2 focus:ring-nova/20",
                          stock === 0 ? "border-warn/40 bg-warn/5 text-warn placeholder:text-warn/60" : "border-edge/10 bg-edge/[0.03] text-ink"
                        )}
                      />
                    </td>
                  );
                })}
                <td className="px-3 text-center font-mono font-black text-ink-2">{fmtNum(sum)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
