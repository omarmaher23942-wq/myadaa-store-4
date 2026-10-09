"use client";

// ProductEditor — إضافة منتج وتعديله. كل حقل مربوط بعنوانه وحدّه الحقيقي (نفس حدود الخادم)، والأخطاء تظهر تحت حقلها
// ويُنتقل إليه. معاينة حية للربح والخصم ونتيجة البحث، وتتبع المخزون اختياري، وصور بترتيب وصورة رئيسية، وصورة لكل لون.
// شريط حفظ يظهر مع أي تعديل (و Ctrl+S)، وتنبيه قبل مغادرة الصفحة بتعديلات غير محفوظة. بعد إضافة منتج جديد تنتقل
// صفحته إلى وضع التعديل ويبقى التاجر فيها.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Copy, ExternalLink, Eye, Loader2, Plus, RotateCcw, Save, ShoppingBag, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, storeUrl } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { slugify } from "@/lib/arabic";
import { deleteProductAction, duplicateProductAction, saveProductAction } from "@/server/actions/products";
import { AiWriteButton } from "../AiWriteButton";
import { VariantMatrix } from "../VariantMatrix";
import { requestPulse } from "../DashboardPulse";
import { ConfirmDialog } from "../ui/DashDialog";
import { ChipsInput, Field, inputCls, Section, Switch } from "./parts";
import { ProductImages, type ProductImage } from "./ProductImages";
import { ColorImages } from "./ColorImages";

import { FIELD_ORDER, LIMITS, toNumber, validateProduct as validate, type EditorProduct, type Errors, type ProductStats, type Status } from "./model";

const STATUS: { key: Status; label: string; hint: string }[] = [
  { key: "active", label: "منشور", hint: "يظهر في متجرك ويمكن طلبه." },
  { key: "draft", label: "مسودة", hint: "لم يكتمل بعد، ولا يراه العملاء." },
  { key: "hidden", label: "مخفي", hint: "أوقفت عرضه مؤقتاً (موسمي أو متوقف)، ويبقى بكل بياناته." },
];

export function ProductEditor({
  initial,
  categories,
  subdomain,
  featuredBadge,
  stats,
}: {
  initial: EditorProduct;
  categories: { id: string; name: string }[];
  subdomain: string;
  featuredBadge: string;
  stats?: ProductStats;
}) {
  const router = useRouter();
  const [f, setF] = useState<EditorProduct>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, startSave] = useTransition();
  const [dialog, setDialog] = useState<null | { kind: "delete" } | { kind: "leave"; href: string }>(null);
  const [busy, setBusy] = useState<null | "duplicate" | "delete">(null);
  const savedRef = useRef(JSON.stringify(initial));
  const [savedJson, setSavedJson] = useState(savedRef.current);
  const isNew = !f.id;

  const json = JSON.stringify(f);
  const dirty = json !== savedJson;

  const up = useCallback(<K extends keyof EditorProduct>(k: K, v: EditorProduct[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => (k in e ? { ...e, [k]: undefined } : e));
  }, []);

  // ─── الحساب الحي ──────────────────────────────────────────────────────────
  const price = toNumber(f.price);
  const compareAt = toNumber(f.compareAt);
  const cost = toNumber(f.cost);
  const discount = price && compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null;
  const profit = price && cost !== null && !Number.isNaN(cost) && price > 0 ? price - cost : null;
  const margin = profit !== null && price ? Math.round((profit / price) * 100) : null;
  const variantStock = f.variants.reduce((a, v) => a + (v.isAvailable === false ? 0 : (v.stock ?? 0)), 0);
  const slug = f.slug ?? (slugify(f.name) || "item");
  const productUrl = storeUrl(subdomain, `/p/${encodeURIComponent(slug)}`);
  const category = categories.find((c) => c.id === f.categoryId)?.name;

  // ─── الحفظ ────────────────────────────────────────────────────────────────
  const focusField = (k: keyof Errors) => {
    const el = document.querySelector<HTMLElement>(`[data-field="${k}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLElement>("input,textarea,select,button")?.focus({ preventScroll: true });
  };

  const save = useCallback(() => {
    const e = validate(f);
    if (Object.values(e).some(Boolean)) {
      setErrors(e);
      const first = FIELD_ORDER.find((k) => e[k]);
      if (first) {
        toast.error(e[first]!);
        focusField(first);
      }
      return;
    }
    const snapshot = JSON.stringify(f);
    startSave(async () => {
      const r = await saveProductAction({
        id: f.id,
        name: f.name.trim(),
        categoryId: f.categoryId,
        shortDescription: f.shortDescription,
        description: f.description,
        price: toNumber(f.price),
        compareAt: toNumber(f.compareAt),
        cost: toNumber(f.cost),
        sku: f.sku,
        trackStock: f.trackStock,
        stock: f.trackStock && !f.variants.length ? toNumber(f.stock) : null,
        images: f.images,
        attributes: f.attributes,
        optionNames: f.optionNames,
        variants: f.variants.map((v) => ({
          ...v,
          price: typeof v.price === "number" && Number.isFinite(v.price) && v.price > 0 ? v.price : null,
          stock: f.trackStock ? (Number.isInteger(v.stock) && v.stock! >= 0 ? v.stock : 0) : null,
        })),
        tags: f.tags,
        badges: f.badges,
        status: f.status,
        isFeatured: f.isFeatured,
        seoTitle: f.seoTitle,
        seoDescription: f.seoDescription,
      }).catch(() => ({ ok: false as const, error: "انقطع الاتصال ولم يُحفظ شيء. حاول مرة أخرى", field: undefined }));
      if (!r.ok) {
        if (r.field && FIELD_ORDER.includes(r.field as keyof Errors)) {
          setErrors((x) => ({ ...x, [r.field!]: r.error }));
          focusField(r.field as keyof Errors);
        }
        toast.error(r.error);
        return;
      }
      savedRef.current = snapshot;
      setSavedJson(snapshot);
      requestPulse();
      if (!f.id) {
        const next = { ...f, id: r.id, slug: r.slug };
        const nextJson = JSON.stringify(next);
        savedRef.current = nextJson;
        setSavedJson(nextJson);
        setF(next);
        toast.success(f.status === "active" ? "أُضيف المنتج وصار في متجرك" : "حُفظ المنتج");
        router.replace(`/dashboard/products/${r.id}`, { scroll: false });
      } else {
        toast.success("حُفظت التعديلات");
        router.refresh();
      }
    });
  }, [f, router]);

  // Ctrl/⌘+S للحفظ من أي حقل.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, saving]);

  // تنبيه قبل المغادرة بتعديلات غير محفوظة: إغلاق التبويب أو تحديثه، وأي رابط داخل اللوحة.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setDialog({ kind: "leave", href: url.pathname + url.search + url.hash });
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const discard = () => {
    const back = JSON.parse(savedRef.current) as EditorProduct;
    setF(back);
    setErrors({});
  };

  async function duplicate() {
    if (dirty) return void toast.error("احفظ تعديلاتك أولاً ثم انسخ المنتج");
    setBusy("duplicate");
    const r = await duplicateProductAction(f.id!);
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success("نُسخ المنتج كمسودة. عدّل ما يختلف ثم انشره");
    router.push(`/dashboard/products/${r.id}`);
  }

  async function remove(): Promise<boolean> {
    setBusy("delete");
    const r = await deleteProductAction(f.id!);
    setBusy(null);
    if (!r.ok) {
      toast.error(r.error ?? "تعذر الحذف");
      return false;
    }
    savedRef.current = json;
    setSavedJson(json);
    requestPulse();
    toast.success(`حُذف «${f.name}»`);
    router.replace("/dashboard/products");
    return true;
  }

  // صورة لون حُذفت من صور المنتج لا تبقى معلّقة على تركيباته.
  const setImages = (images: ProductImage[]) => {
    const urls = new Set(images.map((i) => i.url));
    setF((s) => ({
      ...s,
      images,
      variants: s.variants.some((v) => v.imageUrl && !urls.has(v.imageUrl)) ? s.variants.map((v) => (v.imageUrl && !urls.has(v.imageUrl) ? { ...v, imageUrl: null } : v)) : s.variants,
    }));
  };

  const seoTitle = f.seoTitle.trim() || f.name.trim() || "اسم المنتج";
  const seoDesc = f.seoDescription.trim() || f.shortDescription.trim() || f.description.trim().slice(0, 160) || "وصف المنتج يظهر هنا في نتائج البحث.";

  const statusChip = useMemo(() => STATUS.find((s) => s.key === initialStatus(savedJson)), [savedJson]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
      className="mx-auto max-w-6xl space-y-4"
    >
      {/* الرأس */}
      <header className="space-y-3">
        <Link href="/dashboard/products" className="inline-flex min-h-10 items-center gap-1.5 text-[12.5px] font-bold text-ink-3 transition-colors hover:text-ink">
          <ArrowRight className="size-4" aria-hidden="true" />
          المنتجات
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-ink">{isNew ? "منتج جديد" : initialName(savedJson) || "منتج"}</h1>
            {!isNew && statusChip ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-black", statusChip.key === "active" ? "bg-ok/12 text-ok" : statusChip.key === "hidden" ? "bg-warn/12 text-warn" : "bg-edge/[0.07] text-ink-3")}>
                  {statusChip.label}
                </span>
                {stats ? <span>أُضيف {new Date(stats.createdAt).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })}</span> : null}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isNew && initialStatus(savedJson) === "active" ? (
              <a href={productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink">
                <ExternalLink className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">عرض في المتجر</span>
                <span className="sr-only sm:hidden">عرض في المتجر</span>
              </a>
            ) : null}
            {!isNew ? (
              <>
                <button type="button" onClick={duplicate} disabled={busy !== null} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink disabled:opacity-50">
                  {busy === "duplicate" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  <span className="hidden sm:inline">نسخ</span>
                  <span className="sr-only sm:hidden">نسخ المنتج</span>
                </button>
                <button type="button" onClick={() => setDialog({ kind: "delete" })} disabled={busy !== null} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-bad/20 px-3.5 text-[12.5px] font-bold text-bad transition-colors hover:bg-bad/10 disabled:opacity-50">
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">حذف</span>
                  <span className="sr-only sm:hidden">حذف المنتج</span>
                </button>
              </>
            ) : null}
            <button
              type="submit"
              disabled={saving || (!dirty && !isNew)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md transition-shadow hover:shadow-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
              {isNew ? "أضف المنتج" : dirty ? "احفظ" : "محفوظ"}
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4">
          <Section
            title="الأساسيات"
            hint="الاسم كما يبحث عنه العميل، وسطر يقنعه، ووصف يجيب أسئلته."
            action={
              <AiWriteButton
                input={{ name: f.name, priceEgp: price && !Number.isNaN(price) ? price : undefined, category, attributes: f.attributes, description: f.description }}
                current={{ shortDescription: f.shortDescription, description: f.description, seoTitle: f.seoTitle, seoDescription: f.seoDescription, tags: f.tags }}
                onApply={(c) =>
                  setF((s) => ({
                    ...s,
                    shortDescription: c.shortDescription.slice(0, LIMITS.shortDescription),
                    description: c.description.slice(0, LIMITS.description),
                    seoTitle: c.seoTitle.slice(0, LIMITS.seoTitle),
                    seoDescription: c.seoDescription.slice(0, LIMITS.seoDescription),
                    tags: [...new Set(c.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20),
                  }))
                }
              />
            }
          >
            <div data-field="name">
              <Field label="اسم المنتج" error={errors.name} count={f.name.length} max={LIMITS.name}>
                {(p) => <input {...p} className={inputCls} value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="مثال: فستان كتان صيفي" maxLength={LIMITS.name} autoFocus={isNew} />}
              </Field>
            </div>
            <div data-field="shortDescription">
              <Field label="سطر بيعي" optional hint="يظهر تحت الاسم في صفحة المنتج." error={errors.shortDescription} count={f.shortDescription.length} max={LIMITS.shortDescription}>
                {(p) => <input {...p} className={inputCls} value={f.shortDescription} onChange={(e) => up("shortDescription", e.target.value)} placeholder="خامة قطن مريحة طول اليوم" maxLength={LIMITS.shortDescription} />}
              </Field>
            </div>
            <div data-field="description">
              <Field label="الوصف" optional hint="الخامة والمقاسات والعناية وما في العلبة. فقرات قصيرة أو نقاط." error={errors.description} count={f.description.length} max={LIMITS.description}>
                {(p) => (
                  <textarea {...p} className={cn(inputCls, "min-h-36 py-3 leading-7")} rows={6} value={f.description} onChange={(e) => up("description", e.target.value)} maxLength={LIMITS.description} />
                )}
              </Field>
            </div>
          </Section>

          <Section title="الصور" hint="صور واضحة على خلفية بسيطة تبيع أكثر. حتى 20 صورة، وتُضغط تلقائياً قبل الرفع.">
            <ProductImages value={f.images} onChange={setImages} name={f.name} />
          </Section>

          <Section title="المقاسات والألوان" hint="للمنتج الذي له مقاسات أو ألوان: اكتب القيم وتتولد كل التركيبات بكمياتها وأسعارها.">
            <VariantMatrix
              optionNames={f.optionNames}
              variants={f.variants}
              basePrice={price && !Number.isNaN(price) ? price : 0}
              trackStock={f.trackStock}
              onChange={(optionNames, variants) => setF((s) => ({ ...s, optionNames, variants }))}
            />
            <ColorImages optionNames={f.optionNames} variants={f.variants} images={f.images} onChange={(variants) => up("variants", variants)} />
          </Section>

          <Section
            title="المواصفات"
            hint="جدول يظهر في صفحة المنتج: الخامة، الموديل، الضمان، بلد الصنع…"
            action={
              f.attributes.length < 30 ? (
                <button type="button" onClick={() => up("attributes", [...f.attributes, { label: "", value: "" }])} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5 hover:text-ink">
                  <Plus className="size-4" aria-hidden="true" />
                  مواصفة
                </button>
              ) : null
            }
          >
            {f.attributes.length ? (
              <ul className="space-y-2">
                {f.attributes.map((a, i) => (
                  <li key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
                    <input
                      aria-label={`اسم المواصفة ${i + 1}`}
                      className={inputCls}
                      placeholder="الخامة"
                      value={a.label}
                      maxLength={40}
                      onChange={(e) => up("attributes", f.attributes.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))}
                    />
                    <input
                      aria-label={`قيمة المواصفة ${i + 1}`}
                      className={inputCls}
                      placeholder="قطن 100%"
                      value={a.value}
                      maxLength={120}
                      onChange={(e) => up("attributes", f.attributes.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))}
                    />
                    <button type="button" onClick={() => up("attributes", f.attributes.filter((_, k) => k !== i))} className="grid size-11 place-items-center rounded-xl text-ink-3 hover:bg-bad/10 hover:text-bad" aria-label={`حذف المواصفة ${i + 1}`}>
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-ink-3">لا مواصفات. الصفوف الفارغة لا تُحفظ.</p>
            )}
          </Section>

          <Section title="الظهور في جوجل" hint="ما يراه الناس في نتائج البحث. اتركه فارغاً ليُؤخذ من الاسم والسطر البيعي.">
            <div className="rounded-xl border border-edge/[0.07] bg-edge/[0.02] p-3.5" aria-label="معاينة نتيجة البحث">
              <p className="truncate text-[11.5px] text-ink-3" dir="ltr">
                {storeUrl(subdomain, `/p/${slug}`).replace(/^https?:\/\//, "")}
              </p>
              <p className="mt-1 line-clamp-1 text-[15px] font-bold text-[#4f7cff]">{seoTitle}</p>
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-6 text-ink-2">{seoDesc}</p>
            </div>
            <div data-field="seoTitle">
              <Field label="عنوان البحث" optional error={errors.seoTitle} count={f.seoTitle.length} max={LIMITS.seoTitle}>
                {(p) => <input {...p} className={inputCls} value={f.seoTitle} onChange={(e) => up("seoTitle", e.target.value)} placeholder={f.name || "اسم المنتج"} maxLength={LIMITS.seoTitle} />}
              </Field>
            </div>
            <div data-field="seoDescription">
              <Field label="وصف البحث" optional error={errors.seoDescription} count={f.seoDescription.length} max={LIMITS.seoDescription}>
                {(p) => (
                  <textarea {...p} className={cn(inputCls, "py-3 leading-6")} rows={3} value={f.seoDescription} onChange={(e) => up("seoDescription", e.target.value)} maxLength={LIMITS.seoDescription} />
                )}
              </Field>
            </div>
            {isNew ? <p className="text-[11.5px] text-ink-3">رابط المنتج يُثبَّت عند أول حفظ ولا يتغير بعدها حتى لو غيّرت الاسم، فلا تنكسر روابطه المنشورة.</p> : null}
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="الظهور في المتجر">
            <div role="radiogroup" aria-label="حالة المنتج" className="grid gap-2">
              {STATUS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={f.status === s.key}
                  onClick={() => up("status", s.key)}
                  className={cn(
                    "rounded-xl border p-3 text-start transition-colors",
                    f.status === s.key ? "border-nova/50 bg-nova/[0.08]" : "border-edge/10 hover:bg-edge/[0.03]"
                  )}
                >
                  <span className="flex items-center gap-2 text-[13px] font-black text-ink">
                    <span className={cn("grid size-4 place-items-center rounded-full border-2", f.status === s.key ? "border-nova" : "border-edge/25")}>
                      {f.status === s.key ? <span className="size-2 rounded-full bg-nova" /> : null}
                    </span>
                    {s.label}
                  </span>
                  <span className="mt-0.5 block ps-6 text-[11.5px] leading-5 text-ink-3">{s.hint}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-edge/[0.06] pt-4">
              <Switch checked={f.isFeatured} onChange={(v) => up("isFeatured", v)} label="منتج مميز" hint={`يظهر في أقسام «المميزة» بالرئيسية، وعلى بطاقته شارة «${featuredBadge}».`} />
            </div>
          </Section>

          <Section title="السعر">
            <div data-field="price">
              <Field label="سعر البيع (ج.م)" error={errors.price}>
                {(p) => <input {...p} className={cn(inputCls, "text-[15px] tabular-nums")} inputMode="decimal" dir="ltr" value={f.price} onChange={(e) => up("price", e.target.value)} placeholder="0" />}
              </Field>
            </div>
            <div data-field="compareAt">
              <Field label="السعر قبل الخصم" optional error={errors.compareAt} hint={discount ? `يظهر مشطوباً، وعلى المنتج «خصم ${fmtNum(discount)}%».` : "يظهر مشطوباً بجانب سعر البيع."}>
                {(p) => <input {...p} className={cn(inputCls, "tabular-nums")} inputMode="decimal" dir="ltr" value={f.compareAt} onChange={(e) => up("compareAt", e.target.value)} placeholder="—" />}
              </Field>
            </div>
            <div data-field="cost">
              <Field label="سعر التكلفة" optional error={errors.cost} hint="لا يراه العملاء. منه نحسب ربحك في كل طلب.">
                {(p) => <input {...p} className={cn(inputCls, "tabular-nums")} inputMode="decimal" dir="ltr" value={f.cost} onChange={(e) => up("cost", e.target.value)} placeholder="—" />}
              </Field>
            </div>
            {profit !== null && price ? (
              <div className={cn("rounded-xl p-3 text-[12.5px] leading-6", profit > 0 ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad")} aria-live="polite">
                {profit > 0 ? (
                  <>
                    ربحك <b className="tabular-nums">{formatEgp(Math.round(profit * 100))}</b> في القطعة (هامش {fmtNum(margin!)}%)
                    {f.variants.some((v) => v.price !== null && v.price !== undefined && v.price !== price) ? <span className="block text-[11.5px] opacity-80">حسب سعر المنتج؛ التركيبات بسعر مختلف يختلف ربحها.</span> : null}
                  </>
                ) : (
                  <>تبيع بخسارة {formatEgp(Math.round(-profit * 100))} في القطعة. راجع السعر أو التكلفة.</>
                )}
              </div>
            ) : null}
          </Section>

          <Section title="المخزون">
            <Switch
              checked={f.trackStock}
              onChange={(v) => up("trackStock", v)}
              label="تتبع الكمية"
              hint={f.trackStock ? "تُخصم الكمية مع كل طلب، ويظهر المنتج «نفد» عند الصفر." : "متاح دائماً: لا عدّ ولا نفاد (للمنتجات حسب الطلب أو الرقمية)."}
            />
            {f.trackStock ? (
              f.variants.length ? (
                <p className="rounded-xl bg-edge/[0.03] p-3 text-[12.5px] text-ink-2">
                  الكمية من المقاسات والألوان: <b className="tabular-nums text-ink">{arCount(variantStock, NOUN.piece)}</b>
                </p>
              ) : (
                <div data-field="stock">
                  <Field label="الكمية المتاحة" error={errors.stock}>
                    {(p) => <input {...p} className={cn(inputCls, "tabular-nums")} inputMode="numeric" dir="ltr" value={f.stock} onChange={(e) => up("stock", e.target.value)} placeholder="0" />}
                  </Field>
                </div>
              )
            ) : null}
            <div data-field="sku">
              <Field label="كود المنتج (SKU)" optional hint="للبحث السريع وفواتيرك. لا يظهر للعملاء." error={errors.sku}>
                {(p) => <input {...p} className={cn(inputCls, "font-mono")} dir="ltr" value={f.sku} onChange={(e) => up("sku", e.target.value)} maxLength={LIMITS.sku} />}
              </Field>
            </div>
          </Section>

          <Section title="التنظيم">
            <div data-field="categoryId">
              <Field label="القسم" error={errors.categoryId} hint={categories.length ? undefined : "لا أقسام بعد. أنشئها من صفحة «الأقسام»."}>
                {(p) => (
                  <select {...p} className={cn(inputCls, "bg-space-2")} value={f.categoryId ?? ""} onChange={(e) => up("categoryId", e.target.value || null)}>
                    <option value="">بلا قسم</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Field label="كلمات البحث" optional hint="كلمات يكتبها العملاء للوصول إليه، بالعربي والفرانكو. افصل بينها بفاصلة.">
              {(p) => <ChipsInput id={p.id} describedBy={p["aria-describedby"]} value={f.tags} onChange={(v) => up("tags", v)} placeholder="فستان صيفي، fostan" max={20} maxLen={40} />}
            </Field>
            <Field label="شارات صفحة المنتج" optional hint="حقائق قصيرة تظهر فوق السعر، مثل: قطن 100%، صناعة مصرية. لا تكتب ما لا يصح.">
              {(p) => <ChipsInput id={p.id} describedBy={p["aria-describedby"]} value={f.badges} onChange={(v) => up("badges", v)} placeholder="قطن 100%" max={6} maxLen={30} />}
            </Field>
          </Section>

          {stats ? (
            <Section title="أداء المنتج">
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Stat icon={Eye} label="مشاهدة" value={fmtNum(stats.views)} />
                <Stat icon={ShoppingBag} label="قطعة بيعت" value={fmtNum(stats.sold)} />
                <Stat icon={Star} label={stats.ratingCount ? arCount(stats.ratingCount, NOUN.review) : "لا تقييمات"} value={stats.ratingAvg ? stats.ratingAvg.toFixed(1) : "—"} />
              </dl>
            </Section>
          ) : null}
        </aside>
      </div>

      {/* شريط الحفظ: يظهر مع أي تعديل غير محفوظ، فوق شريط التنقل على الموبايل. */}
      {dirty || saving ? (
        <div data-savebar className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 md:bottom-4">
          <div className="dash-card flex items-center justify-between gap-3 border-nova/30 p-2.5 ps-4 shadow-2xl shadow-black/20">
            <p className="text-[12.5px] font-bold text-ink-2">{saving ? "نحفظ…" : isNew ? "منتج جديد لم يُضف بعد" : "تعديلات غير محفوظة"}</p>
            <div className="flex items-center gap-2">
              {!isNew ? (
                <button type="button" onClick={discard} disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold text-ink-3 hover:bg-edge/5 hover:text-ink">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  تراجع
                </button>
              ) : null}
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                {isNew ? "أضف المنتج" : "احفظ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onClose={() => setDialog(null)}
        title={`حذف «${f.name}»؟`}
        description="يختفي من متجرك ومن القوائم فوراً. الطلبات السابقة تبقى كما هي بأسمائها وأسعارها."
        confirmLabel="احذف المنتج"
        tone="danger"
        onConfirm={remove}
      />
      <ConfirmDialog
        open={dialog?.kind === "leave"}
        onClose={() => setDialog(null)}
        title="تغادر دون حفظ؟"
        description="تعديلاتك على هذا المنتج لم تُحفظ بعد وستضيع."
        confirmLabel="غادر دون حفظ"
        tone="danger"
        onConfirm={async () => {
          const href = dialog?.kind === "leave" ? dialog.href : "/dashboard/products";
          savedRef.current = json;
          setSavedJson(json);
          router.push(href);
          return true;
        }}
      />
    </form>
  );
}

function initialStatus(json: string): Status {
  try {
    return (JSON.parse(json) as EditorProduct).status;
  } catch {
    return "draft";
  }
}

function initialName(json: string): string {
  try {
    return (JSON.parse(json) as EditorProduct).name;
  } catch {
    return "";
  }
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-edge/[0.03] p-2.5">
      <Icon className="mx-auto size-4 text-ink-3" aria-hidden="true" />
      <dd className="mt-1 text-[16px] font-black tabular-nums text-ink">{value}</dd>
      <dt className="text-[11px] text-ink-3">{label}</dt>
    </div>
  );
}
