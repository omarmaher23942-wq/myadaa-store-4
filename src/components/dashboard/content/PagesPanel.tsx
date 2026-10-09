"use client";

// PagesPanel — صفحات المتجر النصية. كل صفحة إما «تلقائية» (تُكتب من سياساتك وبيانات متجرك وتتحدث معها: الشحن،
// الاستبدال، الخصوصية، الشروط، التواصل، من نحن) أو «نسختك» التي تكتبها بنفسك (تبدأ من النص التلقائي).
// صفحات الشحن والاستبدال والخصوصية والشروط لا تُخفى: التزام أمام العميل ورابطها في الفوتر دائماً.
// التخزين: سجل في bp.pages؛ نصه الفارغ يعني «النسخة التلقائية بإعداداتك» (resolvePolicyPage).
import { useId, useState } from "react";
import { ExternalLink, FileText, PenLine, RotateCcw } from "lucide-react";
import type { StoreBlueprint } from "@/blueprint/schema";
import { generatePolicyPage, type PolicySlug } from "@/blueprint/policy-pages";
import { Field, Switch, inputCls } from "../product/parts";
import { cn } from "@/lib/utils";

type Page = StoreBlueprint["pages"][number];

const ORDER: PolicySlug[] = ["about", "contact", "faq", "shipping", "returns", "privacy", "terms"];
const DEFAULT_TITLE: Record<PolicySlug, string> = {
  about: "من نحن",
  contact: "تواصل معنا",
  faq: "الأسئلة الشائعة",
  shipping: "الشحن والتوصيل",
  returns: "الاستبدال والاسترجاع",
  privacy: "سياسة الخصوصية",
  terms: "الشروط والأحكام",
};
const LEGAL = new Set<PolicySlug>(["shipping", "returns", "privacy", "terms"]);
const BODY_MAX = 12000;

export function PagesPanel({ bp, onChange, storeBase }: { bp: StoreBlueprint; onChange: (pages: Page[]) => void; storeBase: string }) {
  const [open, setOpen] = useState<PolicySlug | null>(null);
  const own = (slug: PolicySlug) => bp.pages.find((p) => p.slug === slug);
  const put = (slug: PolicySlug, patch: Partial<Page> | null) => {
    const cur = own(slug);
    const gen = generatePolicyPage(bp, slug);
    if (patch === null) return onChange(bp.pages.filter((p) => p.slug !== slug));
    const next: Page = { slug, title: cur?.title || gen?.title || DEFAULT_TITLE[slug], body: cur?.body ?? "", enabled: cur?.enabled ?? true, showInFooter: cur?.showInFooter ?? true, ...patch };
    // سجل مطابق للافتراضي (تلقائية، ظاهرة، في الفوتر) لا داعي له.
    if (!next.body.trim() && next.enabled && next.showInFooter && gen) return onChange(bp.pages.filter((p) => p.slug !== slug));
    onChange(cur ? bp.pages.map((p) => (p.slug === slug ? next : p)) : [...bp.pages, next]);
  };

  return (
    <ul className="space-y-2.5">
      {ORDER.map((slug) => {
        const o = own(slug);
        const gen = generatePolicyPage(bp, slug);
        const custom = Boolean(o?.body.trim());
        const exists = custom || Boolean(gen);
        const visible = exists && (o ? o.enabled : true);
        const title = (custom ? o!.title : gen?.title) || DEFAULT_TITLE[slug];
        const isOpen = open === slug;
        return (
          <li key={slug} className="rounded-xl border border-edge/10 bg-edge/[0.02]">
            <div className="flex flex-wrap items-center gap-2 p-2.5 ps-3.5">
              <FileText className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink">{title}</p>
                <p className="text-[11.5px] text-ink-3">
                  {!exists ? "غير موجودة" : !visible ? "مخفية" : custom ? "نسختك المكتوبة" : "تلقائية من سياساتك وبيانات متجرك"}
                </p>
              </div>
              {visible ? (
                <a href={`${storeBase}/pages/${slug}`} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-edge/[0.06] hover:text-ink" aria-label={`افتح «${title}» في المتجر`} title="افتحها في المتجر">
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              ) : null}
              <button type="button" onClick={() => setOpen(isOpen ? null : slug)} aria-expanded={isOpen} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink">
                <PenLine className="size-4" aria-hidden="true" />
                {exists ? "عدّل" : "أنشئها"}
              </button>
            </div>
            {isOpen ? (
              <div className="space-y-4 border-t border-edge/[0.07] p-3.5">
                {!LEGAL.has(slug) && exists ? <Switch label="ظاهرة في المتجر" checked={visible} onChange={(v) => put(slug, { enabled: v })} /> : null}
                {!LEGAL.has(slug) && visible ? <Switch label="رابطها في الفوتر" checked={o ? o.showInFooter : true} onChange={(v) => put(slug, { showInFooter: v })} /> : null}
                {LEGAL.has(slug) ? <p className="text-[11.5px] leading-5 text-ink-3">صفحة التزام أمام العميل: تظهر دائماً ورابطها في الفوتر.</p> : null}

                {custom ? (
                  <PageEditor
                    page={o!}
                    fallbackTitle={gen?.title ?? DEFAULT_TITLE[slug]}
                    legal={LEGAL.has(slug)}
                    onChange={(patch) => put(slug, patch)}
                    onReset={gen ? () => put(slug, { body: "", title: gen.title }) : null}
                  />
                ) : gen ? (
                  <div className="space-y-2">
                    <p className="text-[12px] leading-6 text-ink-2">
                      تُكتب تلقائياً وتتحدث وحدها كلما غيّرت {LEGAL.has(slug) ? "سياساتك من «السياسات والضمان»" : "بيانات متجرك"}.
                    </p>
                    <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-edge/[0.04] p-3 font-[inherit] text-[12px] leading-6 text-ink-2">{gen.body}</pre>
                    <button type="button" onClick={() => put(slug, { title: gen.title, body: gen.body, enabled: true })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink">
                      <PenLine className="size-4" aria-hidden="true" />
                      اكتب نسختك بدءاً من هذا النص
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => put(slug, { title: DEFAULT_TITLE[slug], body: `## ${DEFAULT_TITLE[slug]}\n`, enabled: true })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-nova px-4 text-[12px] font-black text-white">
                    <PenLine className="size-4" aria-hidden="true" />
                    أنشئ الصفحة
                  </button>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function PageEditor({ page, fallbackTitle, legal, onChange, onReset }: { page: Page; fallbackTitle: string; legal: boolean; onChange: (p: Partial<Page>) => void; onReset: (() => void) | null }) {
  const bodyId = useId();
  return (
    <div className="space-y-3">
      {legal ? (
        <p className="rounded-lg border border-warn/25 bg-warn/[0.07] p-2.5 text-[12px] leading-6 text-ink-2">
          نسختك لا تتحدث مع «السياسات والضمان». إن غيّرت مدة الاسترجاع أو الشحن لاحقاً فحدّث هذا النص بنفسك، أو عُد للنسخة التلقائية.
        </p>
      ) : null}
      <Field label="العنوان" count={page.title.length} max={80}>
        {(a) => <input {...a} dir="auto" maxLength={80} className={inputCls} value={page.title} onChange={(e) => onChange({ title: e.target.value })} onBlur={() => !page.title.trim() && onChange({ title: fallbackTitle })} />}
      </Field>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label htmlFor={bodyId} className="text-[12.5px] font-bold text-ink">
            النص
          </label>
          <span className={cn("text-[11px] tabular-nums text-ink-3", page.body.length > BODY_MAX * 0.9 && "font-bold text-warn")}>
            {page.body.length}/{BODY_MAX}
          </span>
        </div>
        <textarea id={bodyId} dir="auto" rows={14} maxLength={BODY_MAX} className={cn(inputCls, "py-2.5 font-normal leading-7")} value={page.body} onChange={(e) => onChange({ body: e.target.value })} />
        <p className="mt-1.5 text-[11.5px] leading-5 text-ink-3">
          «## » في أول السطر لعنوان فرعي، و«- » لعنصر في قائمة، و**نص** للتغميق.
          {legal ? " يُعرض نصك كما هو حرفياً." : " أي جملة تدّعي سياسة غير مفعّلة في متجرك تُحذف تلقائياً عند العرض."}
        </p>
      </div>
      {onReset ? (
        <button type="button" onClick={onReset} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink">
          <RotateCcw className="size-4" aria-hidden="true" />
          عُد للنسخة التلقائية
        </button>
      ) : null}
    </div>
  );
}
