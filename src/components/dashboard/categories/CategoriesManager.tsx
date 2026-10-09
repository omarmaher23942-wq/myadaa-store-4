"use client";

// CategoriesManager — أقسام المتجر: ترتيبها هنا هو ترتيبها في قائمة المتجر وأقسام الرئيسية (سحب على الكمبيوتر وأسهم على
// الموبايل، ويُحفظ فوراً)، وإظهار وإخفاء بضغطة، وعدد منتجات كل قسم برابط يفتحها، وإضافة وتعديل في نافذة بصورة
// ووصف، وحذف بتأكيد يوضح ما يحدث لمنتجات القسم.
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Edit3, ExternalLink, Eye, EyeOff, FolderOpen, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, storeUrl } from "@/lib/utils";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { isHostedImage } from "@/lib/media-hosts";
import { deleteCategoryAction, reorderCategoriesAction, setCategoryVisibilityAction } from "@/server/actions/categories";
import type { CategoryRow } from "@/server/repos/categories-list";
import { ConfirmDialog } from "../ui/DashDialog";
import { CategoryDialog } from "./CategoryDialog";

export function CategoriesManager({ rows, subdomain }: { rows: CategoryRow[]; subdomain: string }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [drag, setDrag] = useState<number | null>(null);
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  useEffect(() => setList(rows), [rows]);

  async function persist(next: CategoryRow[], prev: CategoryRow[]) {
    setList(next);
    const r = await reorderCategoriesAction(next.map((c) => c.id)).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    if (!r.ok) {
      setList(prev);
      toast.error(`لم يُحفظ الترتيب: ${r.error}`);
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    void persist(next, list);
  };

  async function toggle(c: CategoryRow) {
    const prev = list;
    setList(list.map((x) => (x.id === c.id ? { ...x, isVisible: !c.isVisible } : x)));
    const r = await setCategoryVisibilityAction(c.id, !c.isVisible).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    if (!r.ok) {
      setList(prev);
      return void toast.error(r.error);
    }
    toast.success(c.isVisible ? `أُخفي «${c.name}» من متجرك` : `«${c.name}» ظاهر في متجرك`);
  }

  const hiddenCount = list.filter((c) => !c.isVisible).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">الأقسام</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {list.length
              ? `${arCount(list.length, NOUN.category)}${hiddenCount ? `، منها ${fmtNum(hiddenCount)} مخفي` : ""}. ترتيبها هنا هو ترتيبها في قائمة متجرك.`
              : "قسّم منتجاتك ليجد العميل ما يريد أسرع."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md transition-shadow hover:shadow-lg"
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
          قسم جديد
        </button>
      </header>

      {list.length ? (
        <ol className="dash-card divide-y divide-edge/[0.06] overflow-hidden" aria-label="الأقسام بترتيبها في المتجر">
          {list.map((c, i) => (
            <li
              key={c.id}
              draggable
              onDragStart={(e) => {
                setDrag(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => drag !== null && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag !== null) move(drag, i);
                setDrag(null);
              }}
              onDragEnd={() => setDrag(null)}
              className={cn("flex items-center gap-3 p-3 transition-colors sm:p-3.5", drag === i ? "opacity-40" : "hover:bg-edge/[0.025]")}
            >
              <span className="hidden cursor-grab text-ink-3 active:cursor-grabbing md:block" aria-hidden="true">
                <GripVertical className="size-4" />
              </span>
              <span className="flex flex-col md:hidden">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`رفع «${c.name}»`} className="grid h-6 w-8 place-items-center rounded-md text-ink-3 hover:bg-edge/5 disabled:opacity-25">
                  <ChevronUp className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label={`إنزال «${c.name}»`} className="grid h-6 w-8 place-items-center rounded-md text-ink-3 hover:bg-edge/5 disabled:opacity-25">
                  <ChevronDown className="size-4" aria-hidden="true" />
                </button>
              </span>

              <span className={cn("relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-edge/10 bg-edge/[0.04] text-ink-3", !c.isVisible && "opacity-50")}>
                {c.cover && isHostedImage(c.cover) ? <Image src={c.cover} alt="" fill sizes="48px" className="object-cover" /> : <FolderOpen className="size-5" strokeWidth={1.75} aria-hidden="true" />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setEditing(c)} className="line-clamp-2 text-start text-[13.5px] font-black text-ink hover:text-nova-2">
                    {c.name}
                  </button>
                  {!c.isVisible ? <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[10.5px] font-black text-warn">مخفي</span> : null}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-3">
                  {c.products ? (
                    <Link href={`/dashboard/products?category=${c.id}`} className="font-bold text-ink-2 hover:text-nova-2">
                      <span className="whitespace-nowrap">{arCount(c.products, NOUN.product)}</span>
                      {c.active !== c.products ? <span className="whitespace-nowrap font-normal text-ink-3"> · {fmtNum(c.active)} منشور</span> : null}
                    </Link>
                  ) : (
                    <span>لا منتجات بعد</span>
                  )}
                  {c.description ? <span className="hidden sm:inline"> · {c.description}</span> : null}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={c.isVisible}
                  onClick={() => toggle(c)}
                  aria-label={c.isVisible ? `إخفاء «${c.name}» من المتجر` : `إظهار «${c.name}» في المتجر`}
                  title={c.isVisible ? "ظاهر في المتجر" : "مخفي من المتجر"}
                  className={cn("grid size-9 place-items-center rounded-lg border transition-colors", c.isVisible ? "border-edge/10 text-ink-2 hover:bg-edge/5" : "border-warn/30 bg-warn/10 text-warn")}
                >
                  {c.isVisible ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                </button>
                {c.isVisible ? (
                  <a href={storeUrl(subdomain, `/c/${encodeURIComponent(c.slug)}`)} target="_blank" rel="noopener noreferrer" aria-label={`عرض «${c.name}» في المتجر`} title="عرض في المتجر" className="hidden size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5 sm:grid">
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="hidden size-9 sm:block" aria-hidden="true" />
                )}
                <button type="button" onClick={() => setEditing(c)} aria-label={`تعديل «${c.name}»`} title="تعديل" className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5">
                  <Edit3 className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setDeleting(c)} aria-label={`حذف «${c.name}»`} title="حذف" className="grid size-9 place-items-center rounded-lg border border-bad/20 text-bad transition-colors hover:bg-bad/10">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="dash-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-nova/12 text-nova-2">
            <FolderOpen className="size-7" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="text-[15px] font-black text-ink">لا أقسام بعد</p>
          <p className="max-w-md text-[12.5px] leading-6 text-ink-3">الأقسام تظهر في قائمة متجرك وفي الرئيسية، مثل «فساتين» و«أحذية» و«عروض». أنشئ قسماً ثم اختره من صفحة كل منتج.</p>
          <button type="button" onClick={() => setEditing("new")} className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md">
            <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
            أنشئ أول قسم
          </button>
        </div>
      )}

      {list.length > 1 ? <p className="hidden text-[11.5px] text-ink-3 md:block">اسحب الأقسام لترتيبها؛ يُحفظ الترتيب فوراً.</p> : null}

      <CategoryDialog
        category={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={(name, isNew) => {
          setEditing(null);
          toast.success(isNew ? `أُضيف قسم «${name}»` : "حُفظ القسم");
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`حذف قسم «${deleting?.name ?? ""}»؟`}
        description={
          deleting?.products
            ? `${arCount(deleting.products, NOUN.product)} في هذا القسم ستبقى في متجرك بلا قسم، وتنقلها لقسم آخر من صفحة المنتجات. ورابط القسم يتوقف.`
            : "القسم فارغ، ويتوقف رابطه في المتجر."
        }
        confirmLabel="احذف القسم"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return true;
          const r = await deleteCategoryAction(deleting.id).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          setList(list.filter((x) => x.id !== deleting.id));
          toast.success(`حُذف قسم «${deleting.name}»`);
          router.refresh();
          return true;
        }}
      />
    </div>
  );
}
