"use client";

// ContentEditor.tsx — محرر محتوى احترافي مباشر (بديل StudioEditor).
//
// الفلسفة:
//  - لا iframe. لا templates. كل حقل يُعدَّل مباشرة في Blueprint.
//  - شجرة على اليسار (الأقسام، الهوية، الألوان، الفوتر، SEO...).
//  - المحرر على اليمين يعرض حقول العنصر المختار عبر SchemaForm.
//  - زر "معاينة المتجر" يفتح تبويب منفصل (لا split view مزعج).
//  - حفظ تلقائي محلي (localStorage) + زر نشر صريح.
//  - Undo/Redo كامل (⌘Z / ⌘Y).
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Save,
  Undo2,
  Redo2,
  ExternalLink,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Copy,
  ChevronDown,
  ChevronUp,
  Palette,
  Type,
  LayoutTemplate,
  Sparkles,
  Search,
  FileText,
  Layers,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useDraft } from "@/editor/useDraft";
import { SchemaForm, emptyOf, type FormCtx } from "@/editor/SchemaForm";
import {
  blueprintSchema,
  sectionSchema,
  brandSchema,
  themeSchema,
  headerSchema,
  footerSchema,
  conversionSchema,
  seoSchema,
  productPageSchema,
  paymentsSchema,
  shippingSchema,
  checkoutSchema,
  orderMessagesSchema,
  invoiceSchema,
  policyPageSchema,
  type StoreBlueprint,
  type Section,
} from "@/blueprint/schema";
import { SECTION_META } from "@/blueprint/registry-meta";
import { saveBlueprintAction } from "@/server/actions/blueprint";
import { storeUrl, cn } from "@/lib/utils";

const SW = 1.75;

type Item =
  | { kind: "sections" }
  | { kind: "section"; id: string }
  | { kind: "brand" }
  | { kind: "theme" }
  | { kind: "layout" }
  | { kind: "conversion" }
  | { kind: "productPage" }
  | { kind: "payments" }
  | { kind: "shipping" }
  | { kind: "checkout" }
  | { kind: "orderMessages" }
  | { kind: "invoice" }
  | { kind: "pages" }
  | { kind: "seo" };

const TOP_GROUPS = [
  {
    label: "الهوية والألوان",
    items: [
      { kind: "brand" as const, label: "العلامة التجارية", icon: Type },
      { kind: "theme" as const, label: "الألوان والخطوط", icon: Palette },
      { kind: "layout" as const, label: "الهيدر والفوتر", icon: LayoutTemplate },
    ],
  },
  {
    label: "المحتوى",
    items: [
      { kind: "sections" as const, label: "أقسام الصفحة الرئيسية", icon: Layers },
      { kind: "pages" as const, label: "صفحات المتجر", icon: FileText },
    ],
  },
  {
    label: "التحويل والدفع",
    items: [
      { kind: "conversion" as const, label: "محرك المبيعات", icon: Sparkles },
      { kind: "productPage" as const, label: "صفحة المنتج", icon: LayoutTemplate },
      { kind: "payments" as const, label: "طرق الدفع", icon: Sparkles },
      { kind: "shipping" as const, label: "الشحن", icon: Sparkles },
      { kind: "checkout" as const, label: "إتمام الطلب", icon: LayoutTemplate },
      { kind: "invoice" as const, label: "الفاتورة", icon: FileText },
    ],
  },
  {
    label: "متقدم",
    items: [
      { kind: "orderMessages" as const, label: "رسائل الطلبات", icon: FileText },
      { kind: "seo" as const, label: "SEO", icon: Search },
    ],
  },
];

export function ContentEditor({
  initial,
  storeId,
  subdomain,
  categories,
  products,
}: {
  initial: StoreBlueprint;
  storeId: string;
  subdomain: string;
  categories: { slug: string; name: string }[];
  products: { slug: string; name: string }[];
}) {
  const { draft, setDraft, undo, redo, reset, canUndo, canRedo, dirty } =
    useDraft(initial, storeId);
  const [item, setItem] = useState<Item>({ kind: "sections" });
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  const ctx: FormCtx = useMemo(
    () => ({
      categories: categories ?? [],
      products: products ?? [],
      pages: (draft.pages ?? []).map((p) => ({ slug: p.slug, title: p.title })),
      sections: (draft.home ?? []).map((s) => ({
        id: s.id,
        label: SECTION_META[s.type]?.label ?? s.type,
      })),
    }),
    [categories, products, draft.pages, draft.home]
  );

  const currentSection =
    item.kind === "section"
      ? draft.home.find((s) => s.id === item.id) ?? null
      : null;

  const currentSectionSchema = currentSection
    ? (sectionSchema.options as unknown as z.ZodObject<z.ZodRawShape>[]).find(
        (o) => (o._def.shape().type as z.ZodLiteral<string>).value === currentSection.type
      ) ?? null
    : null;

  const save = () =>
    start(async () => {
      const v = blueprintSchema.safeParse(draft);
      if (!v.success) {
        const first = v.error.issues[0];
        toast.error(
          first ? `${first.path.join(".")}: ${first.message}` : "بيانات غير صالحة"
        );
        return;
      }
      const r = await saveBlueprintAction(v.data, "نشر من محرر المحتوى");
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("تم النشر بنجاح");
      reset(v.data);
    });

  const addSection = (type: Section["type"]) => {
    const id = `${type}_${Date.now().toString(36)}`;
    const opt = (sectionSchema.options as unknown as z.ZodObject<z.ZodRawShape>[]).find(
      (o) => (o._def.shape().type as z.ZodLiteral<string>).value === type
    );
    if (!opt) return;
    const base = emptyOf(opt) as Section;
    const s = sectionSchema.parse({ ...base, id, type });
    setDraft((d) => ({ ...d, home: [...(d.home ?? []), s] }), false);
    setItem({ kind: "section", id });
    setAddOpen(false);
  };

  const removeSection = (id: string) => {
    setDraft((d) => ({ ...d, home: (d.home ?? []).filter((s) => s.id !== id) }), false);
    if (item.kind === "section" && item.id === id) setItem({ kind: "sections" });
  };

  const moveSection = (id: string, dir: 1 | -1) => {
    setDraft((d) => {
      const arr = [...(d.home ?? [])];
      const i = arr.findIndex((s) => s.id === id);
      if (i < 0) return d;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return { ...d, home: arr };
    }, false);
  };

  const duplicateSection = (id: string) => {
    setDraft((d) => {
      const arr = [...(d.home ?? [])];
      const i = arr.findIndex((s) => s.id === id);
      if (i < 0) return d;
      const copy = JSON.parse(JSON.stringify(arr[i])) as Section;
      copy.id = `${copy.type}_${Date.now().toString(36)}`;
      arr.splice(i + 1, 0, copy);
      return { ...d, home: arr };
    }, false);
  };

  const toggleSection = (id: string) => {
    setDraft((d) => ({
      ...d,
      home: (d.home ?? []).map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }), true);
  };

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4">
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge/10 bg-space-2/95 p-3 shadow-lg backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-nova to-aurora text-white shadow-md">
            <Palette className="size-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-sm font-black text-ink">محرر المحتوى</h1>
            <p className="text-[10.5px] text-ink-3">
              عدّل أي نص أو صورة أو قسم — التغييرات تُحفظ مباشرة في Blueprint
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="تراجع"
            title="تراجع (⌘Z)"
            className="grid size-9 place-items-center rounded-lg border border-edge/10 bg-edge/[0.03] text-ink-2 transition-colors hover:bg-edge/[0.06] disabled:opacity-30"
          >
            <Undo2 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="إعادة"
            title="إعادة (⌘Y)"
            className="grid size-9 place-items-center rounded-lg border border-edge/10 bg-edge/[0.03] text-ink-2 transition-colors hover:bg-edge/[0.06] disabled:opacity-30"
          >
            <Redo2 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
          </button>

          <a
            href={`${storeUrl(subdomain)}/?preview=owner`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-edge/10 bg-edge/[0.03] px-3 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] hover:text-ink"
          >
            <ExternalLink className="size-3.5" strokeWidth={SW} aria-hidden="true" />
            معاينة
          </a>

          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-l from-nova to-nova-2 px-4 text-xs font-black text-white shadow-md transition-all hover:brightness-105 disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Save className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            )}
            {pending ? "جارٍ النشر…" : dirty ? "نشر التغييرات" : "لا تغييرات"}
          </button>
        </div>
      </header>

      {/* ═══ Two columns ═══ */}
      <div className="grid flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Left: navigation */}
        <aside className="flex flex-col gap-2 rounded-2xl border border-edge/10 bg-edge/[0.02] p-2">
          {TOP_GROUPS.map((g) => (
            <div key={g.label} className="space-y-0.5">
              <p className="px-2 pb-1 pt-3 text-[10px] font-black uppercase tracking-wider text-ink-3/70">
                {g.label}
              </p>
              {g.items.map((it) => {
                const Icon = it.icon;
                const active =
                  (it.kind === "sections" && item.kind === "sections") ||
                  (it.kind === "sections" && item.kind === "section") ||
                  (item.kind === it.kind && item.kind !== "sections");
                return (
                  <button
                    key={it.kind}
                    type="button"
                    onClick={() => setItem({ kind: it.kind } as Item)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[12px] font-bold transition-colors",
                      active
                        ? "bg-nova/15 text-white"
                        : "text-ink-2/70 hover:bg-edge/[0.04] hover:text-ink"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        active ? "text-nova-2" : "text-ink-3"
                      )}
                      strokeWidth={SW}
                      aria-hidden="true"
                    />
                    <span className="truncate">{it.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Right: editor */}
        <main className="min-w-0 rounded-2xl border border-edge/10 bg-edge/[0.02] p-5">
          {/* Sections list */}
          {item.kind === "sections" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-edge/5 pb-3">
                <div>
                  <h2 className="text-sm font-black text-ink">أقسام الصفحة الرئيسية</h2>
                  <p className="mt-0.5 text-[10.5px] text-ink-3">
                    {draft.home.length} قسم — رتّب، أخفِ، أو احذف بحرية
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-l from-nova to-nova-2 px-3 text-xs font-black text-white shadow-md transition-all hover:brightness-105"
                >
                  <Plus className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                  إضافة قسم
                </button>
              </div>

              <ul className="space-y-1.5">
                {draft.home.map((s, i) => (
                  <li
                    key={s.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-xl border border-edge/5 bg-edge/[0.02] p-2.5",
                      !s.enabled && "opacity-40"
                    )}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-nova/10 font-mono text-[10px] font-black text-nova-2">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItem({ kind: "section", id: s.id })}
                      className="min-w-0 flex-1 truncate text-start text-[12px] font-bold text-ink hover:text-nova-2"
                    >
                      {SECTION_META[s.type]?.label ?? s.type}
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconBtn onClick={() => moveSection(s.id, -1)} label="لأعلى">
                        <ArrowUp className="size-3" strokeWidth={SW} aria-hidden="true" />
                      </IconBtn>
                      <IconBtn onClick={() => moveSection(s.id, 1)} label="لأسفل">
                        <ArrowDown className="size-3" strokeWidth={SW} aria-hidden="true" />
                      </IconBtn>
                      <IconBtn
                        onClick={() => toggleSection(s.id)}
                        label={s.enabled ? "إخفاء" : "إظهار"}
                      >
                        {s.enabled ? (
                          <Eye className="size-3" strokeWidth={SW} aria-hidden="true" />
                        ) : (
                          <EyeOff className="size-3" strokeWidth={SW} aria-hidden="true" />
                        )}
                      </IconBtn>
                      <IconBtn onClick={() => duplicateSection(s.id)} label="تكرار">
                        <Copy className="size-3" strokeWidth={SW} aria-hidden="true" />
                      </IconBtn>
                      <IconBtn
                        onClick={() => removeSection(s.id)}
                        label="حذف"
                        danger
                      >
                        <Trash2 className="size-3" strokeWidth={SW} aria-hidden="true" />
                      </IconBtn>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Section edit */}
          {item.kind === "section" && currentSection && currentSectionSchema ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setItem({ kind: "sections" })}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-nova-2 hover:underline"
              >
                <ArrowRight className="size-3" strokeWidth={2.5} aria-hidden="true" />
                كل الأقسام
              </button>
              <h2 className="text-sm font-black text-ink">
                {SECTION_META[currentSection.type]?.label ?? currentSection.type}
              </h2>
              <SchemaForm
                schema={currentSectionSchema}
                value={currentSection}
                onChange={(nv) =>
                  setDraft((d) => ({
                    ...d,
                    home: d.home.map((s) =>
                      s.id === currentSection.id ? (nv as Section) : s
                    ),
                  }), true)
                }
                ctx={ctx}
              />
            </div>
          ) : null}

          {/* Brand */}
          {item.kind === "brand" ? (
            <Section title="العلامة التجارية" hint="اسم المتجر، الوصف، الشعار">
              <SchemaForm
                schema={brandSchema as unknown as import("zod").ZodTypeAny}
                value={draft.brand}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, brand: nv as StoreBlueprint["brand"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Theme */}
          {item.kind === "theme" ? (
            <Section title="الألوان والخطوط" hint="لوحة الألوان، الخطوط، الحواف">
              <SchemaForm
                schema={themeSchema as unknown as import("zod").ZodTypeAny}
                value={draft.theme}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, theme: nv as StoreBlueprint["theme"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Layout */}
          {item.kind === "layout" ? (
            <div className="space-y-6">
              <Section title="الهيدر" hint="شريط التنقل العلوي">
                <SchemaForm
                  schema={headerSchema as unknown as import("zod").ZodTypeAny}
                  value={draft.header}
                  onChange={(nv) =>
                    setDraft((d) => ({ ...d, header: nv as StoreBlueprint["header"] }), true)
                  }
                  ctx={ctx}
                />
              </Section>
              <Section title="الفوتر" hint="أسفل الصفحة">
                <SchemaForm
                  schema={footerSchema as unknown as import("zod").ZodTypeAny}
                  value={draft.footer}
                  onChange={(nv) =>
                    setDraft((d) => ({ ...d, footer: nv as StoreBlueprint["footer"] }), true)
                  }
                  ctx={ctx}
                />
              </Section>
            </div>
          ) : null}

          {/* Conversion */}
          {item.kind === "conversion" ? (
            <Section title="محرك المبيعات" hint="كل السبل التي تُسرِّع البيع">
              <SchemaForm
                schema={conversionSchema as unknown as import("zod").ZodTypeAny}
                value={draft.conversion}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, conversion: nv as StoreBlueprint["conversion"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Product Page */}
          {item.kind === "productPage" ? (
            <Section title="صفحة المنتج" hint="كيف تظهر تفاصيل المنتج">
              <SchemaForm
                schema={productPageSchema as unknown as import("zod").ZodTypeAny}
                value={draft.productPage}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, productPage: nv as StoreBlueprint["productPage"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Payments */}
          {item.kind === "payments" ? (
            <Section title="طرق الدفع" hint="فودافون كاش، إنستاباي، الدفع عند الاستلام">
              <SchemaForm
                schema={paymentsSchema as unknown as import("zod").ZodTypeAny}
                value={draft.payments}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, payments: nv as StoreBlueprint["payments"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Shipping */}
          {item.kind === "shipping" ? (
            <Section title="الشحن" hint="الرسوم ومدة التوصيل العامة">
              <SchemaForm
                schema={shippingSchema as unknown as import("zod").ZodTypeAny}
                value={draft.shipping}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, shipping: nv as StoreBlueprint["shipping"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Checkout */}
          {item.kind === "checkout" ? (
            <Section title="إتمام الطلب" hint="حقول الاستمارة والرسائل">
              <SchemaForm
                schema={checkoutSchema as unknown as import("zod").ZodTypeAny}
                value={draft.checkout}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, checkout: nv as StoreBlueprint["checkout"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Order Messages */}
          {item.kind === "orderMessages" ? (
            <Section title="رسائل الطلبات" hint="القوالب التي تُرسل للعميل عند تغيّر الحالة">
              <SchemaForm
                schema={orderMessagesSchema as unknown as import("zod").ZodTypeAny}
                value={draft.orderMessages}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, orderMessages: nv as StoreBlueprint["orderMessages"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Invoice */}
          {item.kind === "invoice" ? (
            <Section title="الفاتورة" hint="التنسيق عند الطباعة">
              <SchemaForm
                schema={invoiceSchema as unknown as import("zod").ZodTypeAny}
                value={draft.invoice}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, invoice: nv as StoreBlueprint["invoice"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}

          {/* Pages */}
          {item.kind === "pages" ? (
            <Section title="صفحات المتجر" hint="من نحن، الشحن، الإرجاع، الخصوصية، الشروط">
              <SchemaForm
                schema={
                  policyPageSchema.array() as unknown as import("zod").ZodTypeAny
                }
                value={draft.pages}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, pages: nv as StoreBlueprint["pages"] }), true)
                }
                ctx={ctx}
                name="pages"
              />
            </Section>
          ) : null}

          {/* SEO */}
          {item.kind === "seo" ? (
            <Section title="SEO" hint="العنوان والوصف في محركات البحث">
              <SchemaForm
                schema={seoSchema as unknown as import("zod").ZodTypeAny}
                value={draft.seo}
                onChange={(nv) =>
                  setDraft((d) => ({ ...d, seo: nv as StoreBlueprint["seo"] }), true)
                }
                ctx={ctx}
              />
            </Section>
          ) : null}
        </main>
      </div>

      {/* ═══ Add Section Dialog ═══ */}
      <AnimatePresence>
        {addOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setAddOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl overflow-hidden rounded-2xl border border-edge/15 bg-space-2 p-5 shadow-2xl"
            >
              <h3 className="mb-4 text-sm font-black text-ink">أضف قسم جديد</h3>
              <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {(Object.keys(SECTION_META) as Section["type"][]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addSection(t)}
                    className="rounded-xl border border-edge/10 bg-edge/[0.02] p-3 text-start transition-colors hover:border-nova/50 hover:bg-edge/[0.05]"
                  >
                    <p className="text-[12px] font-black text-ink">
                      {SECTION_META[t].label}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[10.5px] text-ink-3">
                      {SECTION_META[t].description}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="border-b border-edge/5 pb-3">
        <h2 className="text-sm font-black text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-[10.5px] text-ink-3">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function IconBtn({
  onClick,
  label,
  children,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-6 place-items-center rounded-md transition-colors",
        danger
          ? "text-rose-600 dark:text-rose-400 hover:bg-rose-500/15"
          : "text-ink-3 hover:bg-edge/[0.06] hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

import type { z } from "zod";