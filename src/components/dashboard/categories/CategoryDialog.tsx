"use client";

// CategoryDialog — إضافة قسم أو تعديله: الاسم (يُنشأ منه الرابط مرة واحدة ولا يتغير بعدها)، ووصف قصير يظهر أعلى صفحة
// القسم، وصورة غلاف تظهر في أقسام الرئيسية (بدونها تُستخدم صورة أول منتج منشور فيه)، والظهور في المتجر.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_DESCRIPTION_MAX, CATEGORY_NAME_MAX } from "@/lib/catalog-limits";
import { useUploadThing } from "@/lib/uploadthing-client";
import { saveCategoryAction } from "@/server/actions/categories";
import type { CategoryRow } from "@/server/repos/categories-list";
import { DashDialog } from "../ui/DashDialog";
import { Field, inputCls, Switch } from "../product/parts";

type Draft = { name: string; description: string; imageUrl: string | null; isVisible: boolean };

export function CategoryDialog({
  category,
  open,
  onClose,
  onSaved,
}: {
  category: CategoryRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (name: string, isNew: boolean) => void;
}) {
  const [d, setD] = useState<Draft>({ name: "", description: "", imageUrl: null, isVisible: true });
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setD(category ? { name: category.name, description: category.description, imageUrl: category.imageUrl, isVisible: category.isVisible } : { name: "", description: "", imageUrl: null, isVisible: true });
    setError(null);
  }, [open, category]);

  const { startUpload } = useUploadThing("productImage", {
    onUploadError: (e) => {
      toast.error(/[\u0600-\u06FF]/.test(e?.message ?? "") ? e.message : "تعذر رفع الصورة. حاول مرة أخرى");
    },
  });

  async function upload(file: File) {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return void toast.error("اختر صورة JPG أو PNG أو WebP");
    setUploading(true);
    const small = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true }).catch(() => file);
    const res = await startUpload([new File([small], file.name, { type: small.type || file.type })]).catch(() => undefined);
    setUploading(false);
    const url = res?.[0]?.ufsUrl;
    if (url) setD((x) => ({ ...x, imageUrl: url }));
  }

  async function save() {
    if (!d.name.trim()) return setError({ field: "name", text: "اكتب اسم القسم" });
    setSaving(true);
    const r = await saveCategoryAction({ id: category?.id, ...d }).catch(() => ({ ok: false as const, error: "انقطع الاتصال، حاول مرة أخرى", field: undefined }));
    setSaving(false);
    if (!r.ok) {
      setError({ field: r.field, text: r.error });
      if (!r.field) toast.error(r.error);
      return;
    }
    onSaved(d.name.trim(), !category);
  }

  return (
    <DashDialog
      open={open}
      onClose={() => !saving && onClose()}
      title={category ? `تعديل «${category.name}»` : "قسم جديد"}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
            إلغاء
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || uploading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {category ? "احفظ" : "أضف القسم"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <Field label="اسم القسم" error={error?.field === "name" ? error.text : null} count={d.name.length} max={CATEGORY_NAME_MAX} hint={category ? undefined : "قصير وواضح كما يبحث العميل: فساتين، أحذية رجالي، عروض."}>
          {(p) => (
            <input
              {...p}
              className={inputCls}
              value={d.name}
              maxLength={CATEGORY_NAME_MAX}
              autoFocus
              onChange={(e) => {
                setD({ ...d, name: e.target.value });
                if (error?.field === "name") setError(null);
              }}
            />
          )}
        </Field>
        <Field label="وصف قصير" optional error={error?.field === "description" ? error.text : null} count={d.description.length} max={CATEGORY_DESCRIPTION_MAX} hint="يظهر أعلى صفحة القسم وفي نتائج البحث.">
          {(p) => <textarea {...p} className={`${inputCls} py-3 leading-6`} rows={2} value={d.description} maxLength={CATEGORY_DESCRIPTION_MAX} onChange={(e) => setD({ ...d, description: e.target.value })} />}
        </Field>

        <div>
          <p className="mb-1.5 text-[12.5px] font-bold text-ink">
            صورة الغلاف <span className="font-normal text-ink-3">(اختياري)</span>
          </p>
          <div className="flex items-center gap-3">
            <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-edge/10 bg-edge/[0.04] text-ink-3">
              {uploading ? (
                <Loader2 className="size-5 animate-spin text-nova-2" aria-hidden="true" />
              ) : d.imageUrl ? (
                <Image src={d.imageUrl} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <ImagePlus className="size-6" strokeWidth={1.75} aria-hidden="true" />
              )}
            </span>
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5 hover:text-ink disabled:opacity-50">
                  <ImagePlus className="size-4" aria-hidden="true" />
                  {d.imageUrl ? "غيّر الصورة" : "ارفع صورة"}
                </button>
                {d.imageUrl ? (
                  <button type="button" onClick={() => setD({ ...d, imageUrl: null })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold text-bad hover:bg-bad/10">
                    <Trash2 className="size-4" aria-hidden="true" />
                    إزالة
                  </button>
                ) : null}
              </div>
              <p className="text-[11.5px] leading-5 text-ink-3">تظهر في أقسام الرئيسية. بدونها نعرض صورة أول منتج منشور في القسم.</p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </div>

        <div className="border-t border-edge/[0.06] pt-4">
          <Switch
            checked={d.isVisible}
            onChange={(v) => setD({ ...d, isVisible: v })}
            label="ظاهر في المتجر"
            hint={d.isVisible ? "في قائمة المتجر وأقسام الرئيسية، ولصفحته رابط." : "مخفي من القائمة والرئيسية ورابطه لا يعمل. منتجاته تبقى ظاهرة في المتجر."}
          />
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </DashDialog>
  );
}
