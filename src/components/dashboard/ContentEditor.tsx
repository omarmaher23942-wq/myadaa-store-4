"use client";

// ContentEditor — محرر محتوى المتجر: أقسام الصفحة الرئيسية (ترتيب، إظهار وإخفاء، تكرار، حذف، إضافة) ونصوص العلامة
// والهيدر والفوتر وصفحة المنتج وصفحات المتجر والظهور في البحث.
// - مسودة على جهاز التاجر (useDraft) مع تراجع وإعادة، تُستعاد بعد إغلاق الصفحة إن لم يتغير المتجر من مكان آخر.
// - النشر يرسل ما تغيّر فقط (diffBlueprint) فوق النسخة الحالية في الخادم: ما حُفظ من الشحن أو الإعدادات أو التصميم بعد
//   فتح المحرر يبقى كما هو.
// - خطأ التحقق يظهر بالعربية بمكانه (describeIssue)، وينتقل المحرر إلى القسم المعني.
// الشحن والدفع والفاتورة والسياسات لها صفحاتها؛ هنا روابط إليها فقط. (إعدادات «إتمام الطلب» و«رسائل الطلبات» في الـ Blueprint
// لا يقرؤها المتجر ولا صفحة الطلب حالياً، فلا تُعرض هنا كي لا يعدّل التاجر ما لا أثر له.)
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { z } from "zod";
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
  Palette,
  Type,
  LayoutTemplate,
  Sparkles,
  Search,
  FileText,
  Layers,
  Loader2,
  ShoppingBag,
  Truck,
  CreditCard,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useDraft } from "@/editor/useDraft";
import { SchemaForm, emptyOf, type FormCtx } from "@/editor/SchemaForm";
import { ENUM_LABELS } from "@/editor/field-meta";
import {
  blueprintSchema,
  sectionSchema,
  brandSchema,
  headerSchema,
  footerSchema,
  conversionSchema,
  seoSchema,
  productPageSchema,
  type StoreBlueprint,
  type Section,
} from "@/blueprint/schema";
import { SECTION_META } from "@/blueprint/registry-meta";
import { describeIssue, type IssueTarget } from "@/blueprint/issues";
import { saveBlueprintChangesAction } from "@/server/actions/blueprint";
import { diffBlueprint } from "@/lib/blueprint-patch";
import { arCount, NOUN } from "@/lib/format";
import { storeUrl, cn } from "@/lib/utils";
import { DashDialog } from "./ui/DashDialog";
import { ADDABLE_SECTIONS, SECTION_FIELDS } from "@/editor/editable";
import { ThemePanel } from "./content/ThemePanel";
import { PagesPanel } from "./content/PagesPanel";

const SW = 1.75;
const MAX_SECTIONS = 24;

type PanelKind = "sections" | "brand" | "theme" | "layout" | "conversion" | "productPage" | "pages" | "seo";
type Item = { kind: PanelKind } | { kind: "section"; id: string };

const GROUPS: { label: string; items: { kind: PanelKind; label: string; icon: typeof Type }[] }[] = [
  {
    label: "الصفحة الرئيسية",
    items: [{ kind: "sections", label: "أقسام الصفحة الرئيسية", icon: Layers }],
  },
  {
    label: "الهوية",
    items: [
      { kind: "brand", label: "العلامة التجارية", icon: Type },
      { kind: "theme", label: "الألوان والخطوط", icon: Palette },
      { kind: "layout", label: "الهيدر والفوتر", icon: LayoutTemplate },
    ],
  },
  {
    label: "البيع",
    items: [
      { kind: "productPage", label: "صفحة المنتج", icon: ShoppingBag },
      { kind: "conversion", label: "محرك المبيعات", icon: Sparkles },
    ],
  },
  {
    label: "الصفحات والبحث",
    items: [
      { kind: "pages", label: "صفحات المتجر", icon: FileText },
      { kind: "seo", label: "الظهور في البحث", icon: Search },
    ],
  },
];

/** إعدادات لها صفحاتها الخاصة (تعديلها من هناك يُراجع ويُتحقق منه بشكل أدق). */
const ELSEWHERE = [
  { href: "/dashboard/design", label: "تصميم المتجر والحركة", icon: Wand2 },
  { href: "/dashboard/shipping", label: "الشحن والمحافظات", icon: Truck },
  { href: "/dashboard/settings?tab=payments", label: "الدفع والتواصل", icon: CreditCard },
  { href: "/dashboard/policies", label: "السياسات والضمان", icon: ShieldCheck },
];

const PANEL_OF: Record<string, PanelKind> = {
  home: "sections",
  brand: "brand",
  theme: "theme",
  header: "layout",
  footer: "layout",
  conversion: "conversion",
  productPage: "productPage",
  pages: "pages",
  seo: "seo",
};

function itemFor(t: IssueTarget): Item | null {
  if (t.sectionId) return { kind: "section", id: t.sectionId };
  const k = t.top ? PANEL_OF[t.top] : undefined;
  return k ? { kind: k } : null;
}

const SECTION_OPTIONS = sectionSchema.options as unknown as z.ZodObject<z.ZodRawShape>[];
const schemaOf = (type: string) => SECTION_OPTIONS.find((o) => (o.shape.type as z.ZodLiteral<string>).value === type) ?? null;

/** سطر يميّز القسم في القائمة: عنوانه، أو رسائل شريط الإعلان، أو مصدر منتجاته. */
export function sectionSummary(s: Section): string {
  const r = s as unknown as Record<string, unknown>;
  for (const k of ["headline", "title"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (s.type === "announcement") return s.messages.map((m) => m.text.trim()).filter(Boolean).join(" · ");
  if (s.type === "product_grid") return ENUM_LABELS[s.source.type] ?? "";
  return "";
}

/** لماذا لا يظهر القسم في المتجر الآن (إن كان لا يظهر)، بلغة التاجر. */
export function sectionNote(s: Section, ctx: FormCtx): string | null {
  if (!SECTION_FIELDS[s.type]) return "هذا النوع لا يظهر في متجرك. احذفه أو استبدله بقسم آخر.";
  switch (s.type) {
    case "announcement":
      return s.messages.some((m) => m.text.trim()) ? null : "لا يظهر: أضف رسالة واحدة على الأقل";
    case "categories":
      return ctx.categories.length < 2 ? "لا يظهر قبل وجود قسمين في متجرك" : null;
    case "trust_badges":
      return s.items.length < 2 ? "لا يظهر بأقل من شارتين" : null;
    case "faq":
      return s.items.some((q) => q.q.trim() && q.a.trim()) ? null : "لا يظهر: أضف سؤالاً بإجابته";
    case "testimonials":
      return s.includeVerifiedReviews || s.items.some((it) => it.screenshot?.url) ? null : "لا يظهر: أضف لقطة أو فعّل تقييمات المشترين";
    case "countdown_offer":
      return Date.parse(s.endsAt) > Date.now() ? null : "لا يظهر: موعد انتهاء العرض مضى، اختر موعداً قادماً";
    case "bundle":
      return s.productSlugs.length < 2 ? "لا يظهر: اختر منتجين على الأقل" : null;
    case "video":
      return /youtube\.com\/watch|youtu\.be\/|vimeo\.com\//.test(s.videoUrl ?? "") ? null : "لا يظهر: ضع رابط فيديو من YouTube أو Vimeo";
    case "product_grid":
      if (s.source.type === "manual" && !s.source.slugs.length) return "لا يظهر: اختر المنتجات";
      if (s.source.type === "category" && !s.source.slug) return "لا يظهر: اختر القسم";
      return null;
    case "hero":
      return s.headline.trim() ? null : "اكتب العنوان الرئيسي";
    default:
      return null;
  }
}

export function ContentEditor({
  initial,
  storeId,
  subdomain,
  categories,
  products,
  fonts,
}: {
  initial: StoreBlueprint;
  storeId: string;
  subdomain: string;
  categories: { slug: string; name: string }[];
  products: { slug: string; name: string }[];
  /** الخطوط المحمّلة في هذا المتجر (lib/fonts.ts). */
  fonts: readonly string[];
}) {
  const { draft, base, setDraft, undo, redo, reset, discard, restored, canUndo, canRedo, dirty } = useDraft(initial, storeId);
  const [item, setItem] = useState<Item>({ kind: "sections" });
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  const ctx: FormCtx = useMemo(
    () => ({
      categories: categories ?? [],
      products: products ?? [],
      pages: (draft.pages ?? []).map((p) => ({ slug: p.slug, title: p.title })),
      sections: (draft.home ?? []).map((s) => ({ id: s.id, label: SECTION_META[s.type]?.label ?? s.type })),
    }),
    [categories, products, draft.pages, draft.home]
  );

  const currentSection = item.kind === "section" ? (draft.home.find((s) => s.id === item.id) ?? null) : null;
  const currentSectionSchema = currentSection ? schemaOf(currentSection.type) : null;

  const open = (next: Item) => {
    setItem(next);
    // على الموبايل اللوحة تحت قائمة التنقل: انقل التاجر إليها.
    requestAnimationFrame(() => {
      if (panelRef.current && panelRef.current.getBoundingClientRect().top < 0) panelRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };

  const save = () =>
    start(async () => {
      const v = blueprintSchema.safeParse(draft);
      if (!v.success) {
        const { text, target } = describeIssue(v.error.issues[0]!, draft);
        toast.error(text);
        const to = itemFor(target);
        if (to) open(to);
        return;
      }
      // الفرق بين نسخة الفتح والمسودة كما هي (لا بعد ملء القيم الافتراضية، كي لا يُرسل جزء لم يلمسه التاجر).
      const changes = diffBlueprint(base as unknown as Record<string, unknown>, draft as unknown as Record<string, unknown>);
      if (!changes.length) return void reset(base);
      const r = await saveBlueprintChangesAction(changes, "نشر من محرر المحتوى").catch(() => ({ ok: false as const, error: "انقطع الاتصال، حاول مرة أخرى" }));
      if (!r.ok) return void toast.error(r.error);
      toast.success("نُشرت التغييرات في متجرك");
      reset(r.data!.blueprint);
    });

  const saveRef = useRef(save);
  saveRef.current = save;
  const canSave = dirty && !pending;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canSave) saveRef.current();
      }
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [canSave]);

  const addSection = (type: Section["type"]) => {
    const opt = schemaOf(type);
    if (!opt) return;
    const id = `${type}_${Date.now().toString(36)}`;
    // قسم جديد قد ينقصه نص مطلوب (العنوان مثلاً): يُضاف كما هو ويُفتح ليكمله التاجر، والنشر يتحقق منه.
    const raw = { ...(emptyOf(opt) as Record<string, unknown>), id, type };
    const parsed = sectionSchema.safeParse(raw);
    const s = (parsed.success ? parsed.data : raw) as Section;
    setDraft((d) => ({ ...d, home: [...(d.home ?? []), s] }));
    setAddOpen(false);
    open({ kind: "section", id });
  };

  const removeSection = (id: string) => {
    const removed = draft.home.find((s) => s.id === id);
    setDraft((d) => ({ ...d, home: (d.home ?? []).filter((s) => s.id !== id) }));
    if (item.kind === "section" && item.id === id) setItem({ kind: "sections" });
    if (removed) toast(`حُذف قسم «${SECTION_META[removed.type]?.label ?? removed.type}» من المسودة`, { action: { label: "تراجع", onClick: undo } });
  };

  const moveSection = (id: string, dir: 1 | -1) =>
    setDraft((d) => {
      const arr = [...(d.home ?? [])];
      const i = arr.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return { ...d, home: arr };
    });

  const duplicateSection = (id: string) =>
    setDraft((d) => {
      const arr = [...(d.home ?? [])];
      const i = arr.findIndex((s) => s.id === id);
      if (i < 0 || arr.length >= MAX_SECTIONS) return d;
      const copy = JSON.parse(JSON.stringify(arr[i])) as Section;
      copy.id = `${copy.type}_${Date.now().toString(36)}`;
      arr.splice(i + 1, 0, copy);
      return { ...d, home: arr };
    });

  const toggleSection = (id: string) =>
    setDraft((d) => ({ ...d, home: (d.home ?? []).map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)) }));

  const panel = <K extends keyof StoreBlueprint>(key: K, schema: unknown) => (
    <SchemaForm
      path={key}
      schema={schema as z.ZodTypeAny}
      value={draft[key]}
      onChange={(nv) => setDraft((d) => ({ ...d, [key]: nv as StoreBlueprint[K] }), true)}
      ctx={ctx}
    />
  );

  const hiddenCount = draft.home.filter((s) => !s.enabled).length;
  const isActive = (k: PanelKind) => item.kind === k || (k === "sections" && item.kind === "section");

  return (
    <div className="flex flex-col gap-4">
      {/* ═══ الشريط العلوي ═══ */}
      <header className="sticky top-[4.5rem] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge/10 bg-space-2/95 p-3 shadow-lg backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-nova to-aurora text-white shadow-md">
            <Palette className="size-5" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-ink">محرر المحتوى</h1>
            <p className="text-[11.5px] text-ink-3" aria-live="polite">
              {pending ? "جارٍ النشر…" : dirty ? "تعديلات غير منشورة، محفوظة على جهازك" : "كل شيء منشور"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label="تراجع" title="تراجع (Ctrl+Z)" className="grid size-10 place-items-center rounded-xl border border-edge/10 text-ink-2 transition-colors hover:bg-edge/[0.06] disabled:opacity-30">
            <Undo2 className="size-4" strokeWidth={SW} aria-hidden="true" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label="إعادة" title="إعادة (Ctrl+Y)" className="grid size-10 place-items-center rounded-xl border border-edge/10 text-ink-2 transition-colors hover:bg-edge/[0.06] disabled:opacity-30">
            <Redo2 className="size-4" strokeWidth={SW} aria-hidden="true" />
          </button>
          <a
            href={`${storeUrl(subdomain)}/?preview=owner`}
            target="_blank"
            rel="noopener noreferrer"
            title={dirty ? "المتجر يعرض آخر نسخة منشورة" : undefined}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] hover:text-ink"
          >
            <ExternalLink className="size-4" strokeWidth={SW} aria-hidden="true" />
            المتجر
          </a>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            title="Ctrl+S"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-4 text-[12px] font-black text-white shadow-md transition-all hover:brightness-105 disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.5} aria-hidden="true" /> : <Save className="size-4" strokeWidth={2.5} aria-hidden="true" />}
            {pending ? "جارٍ النشر…" : dirty ? "انشر التغييرات" : "لا تغييرات"}
          </button>
        </div>
      </header>

      {restored ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-nova/25 bg-nova/[0.06] p-3 ps-4 text-[12.5px] text-ink-2">
          <span>
            {restored === "moved"
              ? "استعدنا تعديلات لم تنشرها من زيارتك السابقة، فوق آخر نسخة من متجرك (تغيّر من صفحة أخرى بعدها). راجعها قبل النشر."
              : "استعدنا تعديلات لم تنشرها من زيارتك السابقة."}
          </span>
          <button type="button" onClick={discard} className="inline-flex min-h-10 items-center rounded-xl px-3 font-bold text-ink-3 hover:bg-edge/5 hover:text-ink">
            تجاهلها
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ═══ التنقل: شريط أفقي على الموبايل، وقائمة جانبية على الشاشات الكبيرة ═══ */}
        <nav aria-label="أجزاء المحتوى" className="min-w-0 lg:self-start">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:rounded-2xl lg:border lg:border-edge/10 lg:bg-edge/[0.02] lg:p-2">
            {GROUPS.map((g) => (
              <div key={g.label} className="contents lg:block lg:space-y-0.5">
                <p className="hidden px-2 pb-1 pt-3 text-[10.5px] font-black text-ink-3 first:pt-1 lg:block">{g.label}</p>
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const active = isActive(it.kind);
                  return (
                    <button
                      key={it.kind}
                      type="button"
                      onClick={() => open({ kind: it.kind })}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border px-3 text-start text-[12.5px] font-bold transition-colors lg:w-full lg:border-transparent",
                        active ? "border-nova/30 bg-nova/15 text-ink" : "border-edge/10 text-ink-2 hover:bg-edge/[0.04] hover:text-ink"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-nova-2" : "text-ink-3")} strokeWidth={SW} aria-hidden="true" />
                      <span className="truncate">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 hidden rounded-2xl border border-edge/10 p-2 lg:block">
            <p className="px-2 pb-1 pt-1 text-[10.5px] font-black text-ink-3">في صفحاتها الخاصة</p>
            {ELSEWHERE.map((l) => (
              <Link key={l.href} href={l.href} className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-[12.5px] font-bold text-ink-2 hover:bg-edge/[0.04] hover:text-ink">
                <l.icon className="size-4 shrink-0 text-ink-3" strokeWidth={SW} aria-hidden="true" />
                {l.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* ═══ اللوحة ═══ */}
        <main ref={panelRef} className="min-w-0 scroll-mt-40 rounded-2xl border border-edge/10 bg-edge/[0.02] p-4 sm:p-5">
          {item.kind === "sections" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/[0.06] pb-3">
                <div>
                  <h2 className="text-sm font-black text-ink">أقسام الصفحة الرئيسية</h2>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">
                    {arCount(draft.home.length, NOUN.category)}
                    {hiddenCount ? `، المخفي منها: ${arCount(hiddenCount, NOUN.category)}` : ""}. اضغط القسم لتعديل نصوصه وصوره.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  disabled={draft.home.length >= MAX_SECTIONS}
                  title={draft.home.length >= MAX_SECTIONS ? `الحد ${MAX_SECTIONS} قسماً` : undefined}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-3.5 text-[12px] font-black text-white shadow-md transition-all hover:brightness-105 disabled:opacity-40"
                >
                  <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
                  أضف قسماً
                </button>
              </div>

              <ol className="space-y-2">
                {draft.home.map((s, i) => {
                  const label = SECTION_META[s.type]?.label ?? s.type;
                  const note = sectionNote(s, ctx);
                  const summary = note ?? sectionSummary(s);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-edge/[0.07] bg-edge/[0.02] p-2.5 sm:flex-nowrap">
                      <button type="button" onClick={() => open({ kind: "section", id: s.id })} className="flex min-h-10 min-w-[11rem] flex-1 items-center gap-2.5 text-start">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-nova/10 text-[11px] font-black tabular-nums text-nova-2">{i + 1}</span>
                        <span className={cn("min-w-0", !s.enabled && "opacity-50")}>
                          <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                            <span className="truncate">{label}</span>
                            {!s.enabled ? <span className="shrink-0 rounded-full bg-edge/[0.08] px-2 py-0.5 text-[10.5px] font-bold text-ink-3">مخفي</span> : null}
                          </span>
                          {summary ? <span className={cn("block truncate text-[11.5px]", note ? "font-bold text-warn" : "text-ink-3")}>{summary}</span> : null}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 ms-auto">
                        <IconBtn onClick={() => moveSection(s.id, -1)} label={`حرّك «${label}» لأعلى`} disabled={i === 0}>
                          <ArrowUp className="size-4" strokeWidth={SW} aria-hidden="true" />
                        </IconBtn>
                        <IconBtn onClick={() => moveSection(s.id, 1)} label={`حرّك «${label}» لأسفل`} disabled={i === draft.home.length - 1}>
                          <ArrowDown className="size-4" strokeWidth={SW} aria-hidden="true" />
                        </IconBtn>
                        <IconBtn onClick={() => toggleSection(s.id)} label={s.enabled ? `أخفِ «${label}»` : `أظهر «${label}»`}>
                          {s.enabled ? <Eye className="size-4" strokeWidth={SW} aria-hidden="true" /> : <EyeOff className="size-4" strokeWidth={SW} aria-hidden="true" />}
                        </IconBtn>
                        <IconBtn onClick={() => duplicateSection(s.id)} label={`كرّر «${label}»`} disabled={draft.home.length >= MAX_SECTIONS}>
                          <Copy className="size-4" strokeWidth={SW} aria-hidden="true" />
                        </IconBtn>
                        <IconBtn onClick={() => removeSection(s.id)} label={`احذف «${label}»`} danger disabled={draft.home.length <= 1}>
                          <Trash2 className="size-4" strokeWidth={SW} aria-hidden="true" />
                        </IconBtn>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {item.kind === "section" && currentSection && currentSectionSchema ? (
            <div className="space-y-3">
              <button type="button" onClick={() => open({ kind: "sections" })} className="inline-flex min-h-9 items-center gap-1 rounded-lg text-[12px] font-bold text-nova-2 hover:underline">
                <ArrowRight className="size-4" strokeWidth={2.25} aria-hidden="true" />
                كل الأقسام
              </button>
              <div className="border-b border-edge/[0.06] pb-3">
                <h2 className="text-sm font-black text-ink">{SECTION_META[currentSection.type]?.label ?? currentSection.type}</h2>
                <p className="mt-0.5 text-[11.5px] text-ink-3">{SECTION_META[currentSection.type]?.description}</p>
              </div>
              {sectionNote(currentSection, ctx) ? (
                <p className="flex items-start gap-1.5 rounded-xl border border-warn/25 bg-warn/[0.07] p-3 text-[12px] font-bold leading-6 text-ink-2">{sectionNote(currentSection, ctx)}</p>
              ) : null}
              {SECTION_FIELDS[currentSection.type] ? (
                <SchemaForm
                  path={`section:${currentSection.type}`}
                  schema={currentSectionSchema}
                  value={currentSection}
                  onChange={(nv) => setDraft((d) => ({ ...d, home: d.home.map((s) => (s.id === currentSection.id ? (nv as Section) : s)) }), true)}
                  ctx={ctx}
                />
              ) : (
                <button type="button" onClick={() => removeSection(currentSection.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-bad/20 px-3.5 text-[12px] font-bold text-bad hover:bg-bad/10">
                  <Trash2 className="size-4" aria-hidden="true" />
                  احذف القسم
                </button>
              )}
            </div>
          ) : null}
          {item.kind === "section" && !currentSection ? (
            <p className="text-[12.5px] text-ink-3">
              هذا القسم لم يعد موجوداً.{" "}
              <button type="button" onClick={() => open({ kind: "sections" })} className="font-bold text-nova-2 hover:underline">
                عُد إلى الأقسام
              </button>
            </p>
          ) : null}

          {item.kind === "brand" ? <Panel title="العلامة التجارية" hint="اسم المتجر ووصفه وشعاره">{panel("brand", brandSchema)}</Panel> : null}
          {item.kind === "theme" ? (
            <Panel title="الألوان والخطوط" hint="شكل البطاقات والأزرار والحركة من «تصميم المتجر»">
              <ThemePanel value={draft.theme} fonts={fonts} onChange={(t) => setDraft((d) => ({ ...d, theme: t }), true)} />
            </Panel>
          ) : null}
          {item.kind === "layout" ? (
            <div className="space-y-8">
              <Panel title="الهيدر" hint="الشريط العلوي وروابط التنقل">{panel("header", headerSchema)}</Panel>
              <Panel title="الفوتر" hint="أسفل كل صفحة">{panel("footer", footerSchema)}</Panel>
            </div>
          ) : null}
          {item.kind === "conversion" ? <Panel title="محرك المبيعات" hint="العروض والعدّادات والتنبيهات التي تساعد الزائر على الشراء">{panel("conversion", conversionSchema)}</Panel> : null}
          {item.kind === "productPage" ? <Panel title="صفحة المنتج" hint="ما يظهر في صفحة كل منتج وترتيبه">{panel("productPage", productPageSchema)}</Panel> : null}
          {item.kind === "pages" ? (
            <Panel title="صفحات المتجر" hint="مدة الاستبدال وشروط الشحن نفسها تُضبط من «السياسات والضمان»، وتكتب صفحاتها تلقائياً">
              <PagesPanel bp={draft} storeBase={storeUrl(subdomain)} onChange={(pages) => setDraft((d) => ({ ...d, pages }), true)} />
            </Panel>
          ) : null}
          {item.kind === "seo" ? <Panel title="الظهور في البحث" hint="العنوان والوصف اللذان يظهران في Google وعند مشاركة رابط المتجر">{panel("seo", seoSchema)}</Panel> : null}
        </main>
      </div>

      {/* روابط الإعدادات الأخرى على الموبايل (على الشاشات الكبيرة في القائمة الجانبية). */}
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        {ELSEWHERE.map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.04]">
            <l.icon className="size-4 shrink-0 text-ink-3" strokeWidth={SW} aria-hidden="true" />
            <span className="truncate">{l.label}</span>
          </Link>
        ))}
      </div>

      <DashDialog open={addOpen} onClose={() => setAddOpen(false)} title="أضف قسماً" description="يُضاف في آخر الصفحة الرئيسية، ثم تحرّكه لمكانه." className="md:max-w-3xl">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {ADDABLE_SECTIONS.map((t) => (
            <button key={t} type="button" onClick={() => addSection(t)} className="rounded-xl border border-edge/10 bg-edge/[0.02] p-3 text-start transition-colors hover:border-nova/50 hover:bg-edge/[0.05]">
              <p className="text-[12.5px] font-black text-ink">{SECTION_META[t].label}</p>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-5 text-ink-3">{SECTION_META[t].description}</p>
            </button>
          ))}
        </div>
      </DashDialog>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="border-b border-edge/[0.06] pb-3">
        <h2 className="text-sm font-black text-ink">{title}</h2>
        {hint ? <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function IconBtn({ onClick, label, children, danger, disabled }: { onClick: () => void; label: string; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-25",
        danger ? "text-bad hover:bg-bad/10" : "text-ink-3 hover:bg-edge/[0.06] hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
