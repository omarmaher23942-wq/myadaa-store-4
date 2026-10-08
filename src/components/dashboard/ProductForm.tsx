"use client";

// ProductForm — لا prompt() ولا confirm(). كل الحوارات مضمّنة.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  X,
  Plus,
  Package,
  ArrowRight,
  Loader2,
  Shirt,
  Trash2,
  Percent,
  Check,
  Wand2,
} from "lucide-react";
import { UploadButton } from "@/lib/uploadthing-client";
import { saveProductAction } from "@/server/actions/products";
import { AiWriteButton } from "./AiWriteButton";
import { cn } from "@/lib/utils";

type ImageItem = { url: string; key?: string; alt?: string };

type VariantItem = {
  id?: string;
  optionValues: string[];
  price?: number | null;
  stock?: number | null;
  sku?: string | null;
  imageUrl?: string | null;
  isAvailable?: boolean;
};

type InitialData = {
  id?: string;
  name?: string;
  categoryId?: string | null;
  shortDescription?: string;
  description?: string;
  price?: number | string;
  compareAt?: number | string | null;
  cost?: number | string | null;
  sku?: string;
  trackStock?: boolean;
  stock?: number | null;
  images?: ImageItem[];
  attributes?: { label: string; value: string }[];
  optionNames?: string[];
  variants?: VariantItem[];
  tags?: string[];
  badges?: string[];
  status?: "active" | "draft" | "hidden";
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

const I =
  "w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 py-2.5 text-xs font-bold text-ink outline-none transition-colors focus:border-nova/60 focus:ring-2 focus:ring-nova/20";

const L = ({ t, h }: { t: string; h?: string }) => (
  <label className="mb-1.5 block text-xs font-bold text-ink">
    {t}
    {h ? <span className="ms-1 font-normal text-ink-3">({h})</span> : null}
  </label>
);

export function ProductForm({
  categories = [],
  initial,
}: {
  categories: { id: string; name: string }[];
  initial?: InitialData;
}) {
  const [f, setF] = useState(() => ({
    id: initial?.id,
    name: initial?.name || "",
    categoryId: initial?.categoryId || null,
    shortDescription: initial?.shortDescription || "",
    description: initial?.description || "",
    price: initial?.price ?? ("" as number | string),
    compareAt: initial?.compareAt ?? ("" as number | string),
    cost: initial?.cost ?? ("" as number | string),
    sku: initial?.sku || "",
    trackStock: initial?.trackStock ?? true,
    stock: initial?.stock ?? 20,
    images: Array.isArray(initial?.images) ? initial.images : [],
    attributes: Array.isArray(initial?.attributes) ? initial.attributes : [],
    optionNames: Array.isArray(initial?.optionNames) ? initial.optionNames : [],
    variants: Array.isArray(initial?.variants) ? initial.variants : [],
    tags: Array.isArray(initial?.tags) ? initial.tags : [],
    badges: Array.isArray(initial?.badges) ? initial.badges : [],
    status: initial?.status || ("active" as "active" | "draft" | "hidden"),
    isFeatured: initial?.isFeatured ?? false,
    seoTitle: initial?.seoTitle || "",
    seoDescription: initial?.seoDescription || "",
  }));

  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<
    "addVariant" | "uniformPrice" | null
  >(null);
  const router = useRouter();

  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  // ─── Attributes ─────────────────────────────────────────────────────────
  const addAttribute = () =>
    up("attributes", [...f.attributes, { label: "", value: "" }]);
  const updateAttribute = (i: number, k: "label" | "value", v: string) => {
    const next = [...f.attributes];
    if (!next[i]) return;
    next[i] = { ...next[i]!, [k]: v };
    up("attributes", next);
  };
  const removeAttribute = (i: number) =>
    up("attributes", f.attributes.filter((_, k) => k !== i));

  // ─── Variants ───────────────────────────────────────────────────────────
  const commitAddVariant = (label: string) => {
    const clean = label.trim();
    if (!clean) return;
    const newVar: VariantItem = {
      optionValues: [clean],
      price: Number(f.price) || 0,
      stock: 15,
      isAvailable: true,
    };
    up("variants", [...f.variants, newVar]);
    if (!f.optionNames.length) up("optionNames", ["الخيار"]);
    setDialog(null);
  };

  const removeVariant = (i: number) =>
    up("variants", f.variants.filter((_, k) => k !== i));

  const updateVariant = (i: number, patch: Partial<VariantItem>) => {
    const next = [...f.variants];
    if (!next[i]) return;
    next[i] = { ...next[i]!, ...patch };
    up("variants", next);
  };

  const commitUniformPrice = (price: number) => {
    up("price", price);
    up(
      "variants",
      f.variants.map((v) => ({ ...v, price }))
    );
    toast.success(`تم تعيين السعر ${price} ج.م لجميع الخيارات`);
    setDialog(null);
  };

  // ─── Submit ─────────────────────────────────────────────────────────────
  const submit = () =>
    start(async () => {
      if (!f.name.trim()) {
        toast.error("يرجى كتابة اسم المنتج");
        return;
      }
      const numPrice = Number(f.price);
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        toast.error("يرجى كتابة سعر صحيح");
        return;
      }
      const res = await saveProductAction({
        ...f,
        price: numPrice,
        compareAt: f.compareAt ? Number(f.compareAt) : null,
        cost: f.cost ? Number(f.cost) : null,
        stock: f.trackStock
          ? f.stock !== null
            ? Number(f.stock)
            : null
          : null,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("تم حفظ المنتج بنجاح");
        router.push("/dashboard/products");
        router.refresh();
      }
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mx-auto max-w-6xl space-y-6"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-edge/10 pb-4">
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden="true" />
          العودة للمنتجات
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-xs font-black text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          )}
          <span>{pending ? "جاري الحفظ…" : "حفظ المنتج"}</span>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Basics */}
          <section className="space-y-4 rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/5 pb-3">
              <h2 className="text-sm font-black text-ink">{initial?.id ? "تعديل المنتج" : "منتج جديد"}</h2>
              <AiWriteButton
                input={{
                  name: f.name,
                  priceEgp: Number(f.price) || undefined,
                  category: categories.find((c) => c.id === f.categoryId)?.name,
                  attributes: f.attributes,
                  description: f.description,
                }}
                current={{
                  shortDescription: f.shortDescription,
                  description: f.description,
                  seoTitle: f.seoTitle,
                  seoDescription: f.seoDescription,
                  tags: f.tags,
                }}
                onApply={(c) =>
                  setF((s) => ({
                    ...s,
                    shortDescription: c.shortDescription,
                    description: c.description,
                    seoTitle: c.seoTitle,
                    seoDescription: c.seoDescription,
                    tags: c.tags,
                  }))
                }
              />
            </div>

            <div>
              <L t="اسم المنتج" />
              <input
                className={I}
                value={f.name}
                onChange={(e) => up("name", e.target.value)}
                placeholder="مثال: فستان صيفي كتان"
                required
                maxLength={160}
              />
            </div>

            <div>
              <L t="سطر بيعي قصير" h="يظهر تحت الاسم في المتجر" />
              <input
                className={I}
                value={f.shortDescription}
                onChange={(e) => up("shortDescription", e.target.value)}
                placeholder="خامة قطن ممتازة ومريحة طوال اليوم"
                maxLength={160}
              />
            </div>

            <div>
              <L t="الوصف الكامل" />
              <textarea
                className={cn(I, "leading-relaxed")}
                rows={5}
                value={f.description}
                onChange={(e) => up("description", e.target.value)}
                placeholder="الخامات، المقاسات، الضمان…"
              />
            </div>
          </section>

          {/* Images */}
          <section className="space-y-3 rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
            <L t="صور المنتج" h="الصورة الأولى تظهر كأساسية" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {f.images.map((im, i) => (
                <div
                  key={`${im.url}-${i}`}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-edge/10 bg-edge/[0.03]"
                >
                  <Image src={im.url} alt="" fill sizes="160px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      up(
                        "images",
                        f.images.filter((_, k) => k !== i)
                      )
                    }
                    className="absolute end-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="حذف الصورة"
                  >
                    <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                  {i === 0 ? (
                    <span className="absolute bottom-1.5 start-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur">
                      رئيسية
                    </span>
                  ) : null}
                </div>
              ))}

              <div className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-edge/10 bg-edge/[0.02] p-2 transition-colors hover:border-nova/40">
                <UploadButton
                  endpoint="productImage"
                  onClientUploadComplete={(res) => {
                    const imgs = (res ?? [])
                      .map((r) => ({ url: r.ufsUrl ?? r.url, key: r.key }))
                      .filter((im) => Boolean(im.url));
                    if (imgs.length) {
                      up("images", [...f.images, ...imgs]);
                      toast.success("تم رفع الصور");
                    }
                  }}
                  onUploadError={(e) => {
                    toast.error(e?.message || "فشل الرفع");
                  }}
                />
              </div>
            </div>
          </section>

          {/* Variants */}
          <section className="space-y-3 rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
            <header className="flex items-center justify-between border-b border-edge/5 pb-3">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-black text-ink">
                  <Shirt className="size-4" strokeWidth={2} aria-hidden="true" />
                  المقاسات والألوان
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  حدد أسعار ومخزون كل خيار.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {f.variants.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setDialog("uniformPrice")}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-edge/10 bg-edge/[0.03] px-2.5 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06]"
                  >
                    <Wand2 className="size-3" strokeWidth={2.25} aria-hidden="true" />
                    سعر موحد
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDialog("addVariant")}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-edge/10 bg-edge/[0.03] px-2.5 text-[11px] font-bold text-ink transition-colors hover:bg-edge/[0.06]"
                >
                  <Plus className="size-3" strokeWidth={2.25} aria-hidden="true" />
                  إضافة
                </button>
              </div>
            </header>

            <ul className="space-y-2">
              {f.variants.map((v, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-edge/5 bg-edge/[0.02] p-2.5"
                >
                  <input
                    className="h-9 w-32 rounded-lg border border-edge/10 bg-edge/[0.03] px-2 text-xs font-bold text-ink"
                    placeholder="المقاس"
                    value={v.optionValues.join(" / ")}
                    onChange={(e) =>
                      updateVariant(i, { optionValues: [e.target.value] })
                    }
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-ink-3">السعر:</span>
                    <input
                      type="number"
                      dir="ltr"
                      className="h-9 w-24 rounded-lg border border-edge/10 bg-edge/[0.03] px-2 font-mono text-xs font-bold text-ink"
                      value={v.price ?? ""}
                      onChange={(e) =>
                        updateVariant(i, { price: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-ink-3">القطع:</span>
                    <input
                      type="number"
                      dir="ltr"
                      className="h-9 w-20 rounded-lg border border-edge/10 bg-edge/[0.03] px-2 font-mono text-xs font-bold text-ink"
                      value={v.stock ?? ""}
                      onChange={(e) =>
                        updateVariant(i, { stock: Number(e.target.value) })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    className="ms-auto grid size-9 place-items-center rounded-lg text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-500/10"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {f.variants.length === 0 ? (
              <p className="py-1 text-[11px] text-ink-3">
                منتج بسيط بدون مقاسات/ألوان.
              </p>
            ) : null}
          </section>

          {/* Attributes */}
          <section className="space-y-3 rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
            <header className="flex items-center justify-between border-b border-edge/5 pb-3">
              <div>
                <h3 className="text-sm font-black text-ink">المواصفات الفنية</h3>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  للإلكترونيات: الموديل، الضمان…
                </p>
              </div>
              <button
                type="button"
                onClick={addAttribute}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-edge/10 bg-edge/[0.03] px-2.5 text-[11px] font-bold text-ink transition-colors hover:bg-edge/[0.06]"
              >
                <Plus className="size-3" strokeWidth={2.25} aria-hidden="true" />
                مواصفة
              </button>
            </header>

            <ul className="space-y-2">
              {f.attributes.map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    className={cn(I, "flex-1")}
                    placeholder="الاسم (الضمان)"
                    value={a.label}
                    onChange={(e) => updateAttribute(i, "label", e.target.value)}
                  />
                  <input
                    className={cn(I, "flex-1")}
                    placeholder="القيمة (14 يوم)"
                    value={a.value}
                    onChange={(e) => updateAttribute(i, "value", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(i)}
                    className="grid size-10 place-items-center rounded-lg text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-500/10"
                    aria-label="حذف"
                  >
                    <X className="size-4" strokeWidth={2.25} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <section className="space-y-3.5 rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
            <div>
              <L t="سعر البيع (ج.م)" />
              <input
                type="number"
                min="0"
                step="any"
                className={cn(I, "font-mono")}
                value={f.price}
                onChange={(e) => up("price", e.target.value)}
                placeholder="250"
                required
              />
            </div>

            <div>
              <L t="السعر قبل الخصم" h="يظهر مشطوباً" />
              <input
                type="number"
                min="0"
                step="any"
                className={cn(I, "font-mono")}
                value={f.compareAt}
                onChange={(e) => up("compareAt", e.target.value)}
                placeholder="350"
              />
            </div>

            <div>
              <L t="سعر التكلفة" h="لحساب الربح" />
              <input
                type="number"
                min="0"
                step="any"
                className={cn(I, "font-mono")}
                value={f.cost}
                onChange={(e) => up("cost", e.target.value)}
                placeholder="150"
              />
            </div>

            <div>
              <L t="القسم" />
              <select
                className={I}
                value={f.categoryId ?? ""}
                onChange={(e) => up("categoryId", e.target.value || null)}
              >
                <option value="">بدون قسم</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {f.variants.length === 0 ? (
              <div>
                <L t="المخزون" />
                <input
                  type="number"
                  min="0"
                  className={cn(I, "font-mono")}
                  value={f.stock ?? ""}
                  onChange={(e) =>
                    up("stock", e.target.value === "" ? 0 : Number(e.target.value))
                  }
                />
              </div>
            ) : null}

            <div>
              <L t="حالة النشر" />
              <select
                className={I}
                value={f.status}
                onChange={(e) =>
                  up("status", e.target.value as "active" | "draft" | "hidden")
                }
              >
                <option value="active">منشور في المتجر</option>
                <option value="draft">مسودة</option>
                <option value="hidden">مخفي</option>
              </select>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
            <h3 className="text-sm font-black text-ink">تحسين محركات البحث</h3>
            <div>
              <L t="عنوان الميتا" />
              <input
                className={I}
                value={f.seoTitle}
                onChange={(e) => up("seoTitle", e.target.value)}
                maxLength={80}
              />
            </div>
            <div>
              <L t="وصف البحث" />
              <textarea
                className={I}
                rows={3}
                value={f.seoDescription}
                onChange={(e) => up("seoDescription", e.target.value)}
                maxLength={300}
              />
            </div>
          </section>
        </aside>
      </div>

      {/* Dialogs */}
      {dialog === "addVariant" ? (
        <AddVariantDialog
          onCancel={() => setDialog(null)}
          onConfirm={commitAddVariant}
        />
      ) : null}
      {dialog === "uniformPrice" ? (
        <UniformPriceDialog
          initial={String(f.price || 250)}
          onCancel={() => setDialog(null)}
          onConfirm={commitUniformPrice}
        />
      ) : null}
    </form>
  );
}

// ─── Dialog: Add Variant ────────────────────────────────────────────────────
function AddVariantDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: (label: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-edge/10 bg-space-2 p-6 shadow-2xl"
      >
        <h3 className="text-lg font-black text-ink">إضافة خيار / مقاس</h3>
        <p className="mt-2 text-xs text-ink-3">
          مثال: أحمر، أسود، M، L، XL، 42.
        </p>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(label);
          }}
          className="mt-4 h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-xs font-bold text-ink outline-none focus:ring-2 focus:ring-nova/40"
          placeholder="اسم الخيار"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-edge/10 bg-edge/[0.03] px-4 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.06]"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onConfirm(label)}
            disabled={!label.trim()}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-nova px-4 text-xs font-black text-white transition-colors hover:bg-nova disabled:opacity-50"
          >
            <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            إضافة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog: Uniform Price ─────────────────────────────────────────────────
function UniformPriceDialog({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: string;
  onConfirm: (price: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const n = Number(value);
  const valid = Number.isFinite(n) && n >= 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-edge/10 bg-space-2 p-6 shadow-2xl"
      >
        <h3 className="flex items-center gap-2 text-lg font-black text-ink">
          <Percent className="size-5 text-nova-2" strokeWidth={2} aria-hidden="true" />
          تطبيق سعر موحّد
        </h3>
        <p className="mt-2 text-xs text-ink-3">
          سيطبَّق على جميع الخيارات والمقاسات.
        </p>
        <input
          autoFocus
          type="number"
          min={0}
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) onConfirm(n);
          }}
          className="mt-4 h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-center font-mono text-lg font-black text-ink outline-none focus:ring-2 focus:ring-nova/40"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-edge/10 bg-edge/[0.03] px-4 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.06]"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm(n)}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-nova px-4 text-xs font-black text-white transition-colors hover:bg-nova disabled:opacity-50"
          >
            <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            تطبيق
          </button>
        </div>
      </div>
    </div>
  );
}