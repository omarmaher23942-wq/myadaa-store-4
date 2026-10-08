"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FolderTree, Trash2, Edit3 } from "lucide-react";
import { saveCategoryAction, deleteCategoryAction } from "@/server/actions/products";

type C = { id?: string; name: string; description: string; imageUrl: string; isVisible: boolean };

export function CategoriesManager({ rows = [] }: { rows: C[] }) {
  const [edit, setEdit] = useState<C | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (!edit?.name.trim()) {
        toast.error("اكتب اسم القسم أولاً");
        return;
      }
      const r = await saveCategoryAction(edit);
      if (r?.error) toast.error(r.error);
      else {
        toast.success("تم حفظ القسم بنجاح");
        setEdit(null);
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]" dir="rtl">
      {/* قائمة الأقسام */}
      <div className="rounded-2xl border border-edge/10 bg-space-2 shadow-xs divide-y divide-edge/5">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4 hover:bg-edge/[0.05] transition-colors">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-edge/[0.06] text-ink-2 border border-edge/10">
                <FolderTree className="size-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-ink">
                  {c.name} {!c.isVisible && <span className="text-[10px] text-ink-3 font-normal">(مخفي)</span>}
                </p>
                {c.description && (
                  <p className="text-[11px] text-ink-3 mt-0.5">{c.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEdit(c)}
                className="rounded-lg border border-edge/10 bg-space-2 px-2.5 py-1 text-[11px] font-bold text-ink-2 hover:bg-edge/[0.05] transition-colors shadow-xs"
              >
                تعديل
              </button>
              <button
                type="button"
                onClick={() => confirm("هل أنت متأكد من حذف هذا القسم؟") && start(() => deleteCategoryAction(c.id!))}
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100 transition-colors"
              >
                حذف
              </button>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="p-12 text-center text-xs text-ink-3 font-medium">
            لا توجد أقسام مسجلة بعد، ابدأ بإنشاء أول قسم لمتجرك
          </p>
        )}
      </div>

      {/* نموذج إضافة وتعديل قسم */}
      <div className="rounded-2xl border border-edge/10 bg-space-2 p-5 shadow-xs space-y-3.5 h-fit">
        <h2 className="text-xs font-black text-ink border-b border-edge/10 pb-2.5">
          {edit?.id ? "تعديل القسم" : "+ إضافة قسم جديد"}
        </h2>

        <div>
          <label className="block text-xs font-bold text-ink-2 mb-1">اسم القسم *</label>
          <input
            className="w-full rounded-xl border border-edge/10 bg-space-2 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-nova"
            placeholder="مثال: فساتين / أحذية / مستلزمات منزل"
            value={edit?.name ?? ""}
            onChange={(e) =>
              setEdit({
                ...(edit ?? { name: "", description: "", imageUrl: "", isVisible: true }),
                name: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-ink-2 mb-1">وصف القسم (اختياري)</label>
          <input
            className="w-full rounded-xl border border-edge/10 bg-space-2 px-3 py-2 text-xs font-bold text-ink outline-none focus:border-nova"
            placeholder="وصف ترويجي قصير..."
            value={edit?.description ?? ""}
            onChange={(e) =>
              setEdit({
                ...(edit ?? { name: "", description: "", imageUrl: "", isVisible: true }),
                description: e.target.value,
              })
            }
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            disabled={!edit?.name || pending}
            onClick={save}
            className="flex-1 rounded-xl bg-nova py-2.5 text-xs font-black text-white hover:bg-nova-deep disabled:opacity-40 transition-colors shadow-xs"
          >
            {pending ? "جاري الحفظ..." : "حفظ القسم"}
          </button>
          {edit && (
            <button
              type="button"
              onClick={() => setEdit(null)}
              className="rounded-xl border border-edge/10 px-3 py-2.5 text-xs text-ink-2 hover:bg-edge/[0.05] transition-colors"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>
    </div>
  );
}