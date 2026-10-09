"use client";

// ProductsList — قائمة المنتجات: جدول على الشاشات الكبيرة وبطاقات على الموبايل، بالسعر والهامش والمخزون (ومنه ما نفد
// من المقاسات والألوان) والمبيعات، وإجراءات لكل منتج (تعديل، نسخ، عرض في المتجر، حذف) وإجراءات جماعية بنوافذ تأكيد.
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Edit3, ExternalLink, EyeOff, FolderInput, Loader2, Package, Percent, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, storeUrl } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { bulkUpdateProductsAction, deleteProductAction, duplicateProductAction, type BulkUpdateProductsOp } from "@/server/actions/products";
import type { ProductRow } from "@/server/repos/products-list";
import { requestPulse } from "../DashboardPulse";
import { ConfirmDialog, DashDialog } from "../ui/DashDialog";

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  active: { label: "منشور", cls: "bg-ok/12 text-ok" },
  draft: { label: "مسودة", cls: "bg-edge/[0.07] text-ink-3" },
  hidden: { label: "مخفي", cls: "bg-warn/12 text-warn" },
};

function StockCell({ p }: { p: ProductRow }) {
  if (!p.trackStock) return <span className="text-[12px] text-ink-3">متاح دائماً</span>;
  const n = p.stock ?? 0;
  return (
    <span className="flex flex-col">
      <span className={cn("text-[12.5px] font-black tabular-nums", n <= 0 ? "text-bad" : n <= 3 ? "text-warn" : "text-ink")}>
        {n <= 0 ? "نفد" : arCount(n, NOUN.piece)}
      </span>
      {p.variants > 0 ? (
        <span className={cn("text-[11px]", p.variantsOut > 0 && n > 0 ? "font-bold text-warn" : "text-ink-3")}>
          {p.variantsOut > 0 && n > 0 ? `نفد ${fmtNum(p.variantsOut)} من ${fmtNum(p.variants)} تركيبة` : `${fmtNum(p.variants)} تركيبة`}
        </span>
      ) : null}
    </span>
  );
}

function Margin({ p }: { p: ProductRow }) {
  if (p.costPiasters === null) return <span className="text-[11.5px] text-ink-3">بلا تكلفة</span>;
  const profit = p.pricePiasters - p.costPiasters;
  const pct = p.pricePiasters > 0 ? Math.round((profit / p.pricePiasters) * 100) : 0;
  return (
    <span className="flex flex-col">
      <span className={cn("text-[12.5px] font-black tabular-nums", profit >= 0 ? "text-ok" : "text-bad")}>{formatEgp(profit)}</span>
      <span className="text-[11px] text-ink-3">هامش {fmtNum(pct)}%</span>
    </span>
  );
}

function Thumb({ p, size = "size-12" }: { p: ProductRow; size?: string }) {
  const [broken, setBroken] = useState(false);
  return p.image && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.image} alt="" loading="lazy" onError={() => setBroken(true)} className={cn(size, "shrink-0 rounded-xl border border-edge/10 object-cover")} />
  ) : (
    <span className={cn(size, "grid shrink-0 place-items-center rounded-xl border border-dashed border-edge/15 text-ink-3")} title="بلا صورة">
      <Package className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}

type Dialog = { kind: "delete"; id: string; name: string } | { kind: "bulkDelete" } | { kind: "price" } | { kind: "category" } | null;

export function ProductsList({
  rows,
  categories,
  subdomain,
}: {
  rows: ProductRow[];
  categories: { id: string; name: string }[];
  subdomain: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => setSelected(new Set()), [rows]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allChecked = rows.length > 0 && selected.size === rows.length;

  const done = (msg: string) => {
    toast.success(msg);
    setSelected(new Set());
    requestPulse();
    router.refresh();
  };

  async function bulk(op: BulkUpdateProductsOp, msg: string): Promise<boolean> {
    const r = await bulkUpdateProductsAction([...selected], op);
    if (!r.ok) {
      toast.error(r.error ?? "تعذرت العملية");
      return false;
    }
    done(msg);
    return true;
  }

  const duplicate = (p: ProductRow) =>
    start(async () => {
      setBusyId(p.id);
      const r = await duplicateProductAction(p.id);
      setBusyId(null);
      if (!r.ok) return void toast.error(r.error ?? "تعذر النسخ");
      done(`نُسخ «${p.name}» كمسودة`);
    });

  const view = (p: ProductRow) => storeUrl(subdomain, `/p/${encodeURIComponent(p.slug)}`);
  const count = arCount(selected.size, NOUN.product);

  // في الجدول يُحجز مكان «عرض في المتجر» لغير المنشور حتى تصطف الأزرار عمودياً.
  const actions = (p: ProductRow, keepSlots = false) => (
    <>
      <Link href={`/dashboard/products/${p.id}`} aria-label={`تعديل ${p.name}`} title="تعديل" className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink">
        <Edit3 className="size-4" aria-hidden="true" />
      </Link>
      <button type="button" onClick={() => duplicate(p)} disabled={pending} aria-label={`نسخ ${p.name}`} title="نسخ كمسودة" className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink disabled:opacity-50">
        {busyId === p.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      </button>
      {p.status === "active" ? (
        <a href={view(p)} target="_blank" rel="noopener noreferrer" aria-label={`عرض ${p.name} في المتجر`} title="عرض في المتجر" className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5 hover:text-ink">
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      ) : keepSlots ? (
        <span className="size-9" aria-hidden="true" />
      ) : null}
      <button type="button" onClick={() => setDialog({ kind: "delete", id: p.id, name: p.name })} aria-label={`حذف ${p.name}`} title="حذف" className="grid size-9 place-items-center rounded-lg border border-bad/20 text-bad transition-colors hover:bg-bad/10">
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </>
  );

  return (
    <>
      <div className="dash-card hidden overflow-hidden md:block">
        <table className="w-full text-[12.5px]">
          <caption className="sr-only">المنتجات</caption>
          <thead className="border-b border-edge/[0.07] text-[11.5px] text-ink-3">
            <tr>
              <th scope="col" className="w-11 p-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                  aria-label="تحديد كل منتجات الصفحة"
                  className="size-4 accent-[var(--dash-nova)]"
                />
              </th>
              <th scope="col" className="p-3 text-start font-bold">المنتج</th>
              <th scope="col" className="p-3 text-end font-bold">السعر</th>
              <th scope="col" className="hidden p-3 text-end font-bold lg:table-cell">الربح في القطعة</th>
              <th scope="col" className="p-3 text-start font-bold">المخزون</th>
              <th scope="col" className="hidden p-3 text-end font-bold lg:table-cell" title="قطع مبيعة في الطلبات غير الملغاة">المُباع</th>
              <th scope="col" className="w-48 p-3">
                <span className="sr-only">إجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/[0.05]">
            {rows.map((p) => {
              const checked = selected.has(p.id);
              const st = STATUS_CHIP[p.status] ?? STATUS_CHIP.draft!;
              return (
                <tr key={p.id} className={cn("transition-colors", checked ? "bg-nova/[0.06]" : "hover:bg-edge/[0.025]")}>
                  <td className="p-3">
                    <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} aria-label={`تحديد ${p.name}`} className="size-4 accent-[var(--dash-nova)]" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Thumb p={p} />
                      <div className="min-w-0">
                        <Link href={`/dashboard/products/${p.id}`} className="block max-w-[22rem] truncate font-bold text-ink hover:text-nova-2">
                          {p.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-black", st.cls)}>{st.label}</span>
                          {p.category ? <span className="text-[11px] text-ink-3">{p.category}</span> : null}
                          {!p.image ? <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[10.5px] font-black text-warn">بلا صورة</span> : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-end">
                    <span className="block font-black tabular-nums text-ink">{formatEgp(p.pricePiasters)}</span>
                    {p.compareAtPiasters && p.compareAtPiasters > p.pricePiasters ? (
                      <s className="text-[11px] tabular-nums text-ink-3">{formatEgp(p.compareAtPiasters)}</s>
                    ) : null}
                  </td>
                  <td className="hidden p-3 text-end lg:table-cell">
                    <Margin p={p} />
                  </td>
                  <td className="p-3">
                    <StockCell p={p} />
                  </td>
                  <td className="hidden p-3 text-end tabular-nums text-ink-2 lg:table-cell">{fmtNum(p.orderCount)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">{actions(p, true)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {rows.map((p) => {
          const checked = selected.has(p.id);
          const st = STATUS_CHIP[p.status] ?? STATUS_CHIP.draft!;
          return (
            <li key={p.id} className={cn("dash-card p-3", checked && "border-nova/40 bg-nova/[0.05]")}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} aria-label={`تحديد ${p.name}`} className="mt-1 size-5 shrink-0 accent-[var(--dash-nova)]" />
                <Link href={`/dashboard/products/${p.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                  <Thumb p={p} size="size-16" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-black text-ink">{p.name}</span>
                    <span className="mt-0.5 block text-[13px] font-black tabular-nums text-ink">{formatEgp(p.pricePiasters)}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-black", st.cls)}>{st.label}</span>
                      {!p.image ? <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[10.5px] font-black text-warn">بلا صورة</span> : null}
                    </span>
                  </span>
                </Link>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-edge/[0.06] pt-2.5">
                <StockCell p={p} />
                <div className="flex items-center gap-1.5">{actions(p)}</div>
              </div>
            </li>
          );
        })}
      </ul>

      {selected.size > 0 ? (
        <div
          role="toolbar"
          aria-label="إجراءات على المنتجات المحددة"
          className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-nova/30 bg-space-2/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:inset-x-auto md:bottom-6 md:start-1/2 md:-translate-x-1/2 rtl:md:translate-x-1/2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-1 text-[12.5px] font-black text-ink">{count}</span>
            <BulkBtn icon={Send} label="نشر" onClick={() => start(async () => void (await bulk({ action: "status", status: "active" }, `نُشر ${count}`)))} disabled={pending} />
            <BulkBtn icon={EyeOff} label="إخفاء" onClick={() => start(async () => void (await bulk({ action: "status", status: "hidden" }, `أُخفي ${count}`)))} disabled={pending} />
            <BulkBtn icon={Percent} label="تعديل السعر" onClick={() => setDialog({ kind: "price" })} disabled={pending} />
            {categories.length ? <BulkBtn icon={FolderInput} label="نقل لقسم" onClick={() => setDialog({ kind: "category" })} disabled={pending} /> : null}
            <BulkBtn icon={Trash2} label="حذف" tone="danger" onClick={() => setDialog({ kind: "bulkDelete" })} disabled={pending} />
            <button type="button" onClick={() => setSelected(new Set())} aria-label="إلغاء التحديد" className="grid size-10 place-items-center rounded-xl text-ink-3 hover:bg-edge/5 hover:text-ink">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onClose={() => setDialog(null)}
        title={dialog?.kind === "delete" ? `حذف «${dialog.name}»` : ""}
        description="يختفي المنتج من المتجر ومن هذه القائمة. الطلبات القديمة التي فيه تبقى كما هي."
        confirmLabel="احذف المنتج"
        tone="danger"
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return false;
          const r = await deleteProductAction(dialog.id);
          if (!r.ok) {
            toast.error(r.error ?? "تعذر الحذف");
            return false;
          }
          done("حُذف المنتج");
          return true;
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "bulkDelete"}
        onClose={() => setDialog(null)}
        title={`حذف ${count}`}
        description="تختفي من المتجر ومن هذه القائمة. الطلبات القديمة التي فيها تبقى كما هي."
        confirmLabel="احذفها"
        tone="danger"
        onConfirm={() => bulk({ action: "delete" }, `حُذف ${count}`)}
      />
      <PriceDialog open={dialog?.kind === "price"} onClose={() => setDialog(null)} count={count} onApply={(percent) => bulk({ action: "pricePercent", percent }, `تعدّل سعر ${count} بنسبة ${percent > 0 ? "+" : ""}${percent}%`)} />
      <CategoryDialog
        open={dialog?.kind === "category"}
        onClose={() => setDialog(null)}
        count={count}
        categories={categories}
        onApply={(categoryId) => bulk({ action: "category", categoryId }, categoryId ? `نُقل ${count}` : `أُزيل القسم عن ${count}`)}
      />
    </>
  );
}

function BulkBtn({ icon: Icon, label, onClick, disabled, tone }: { icon: typeof Send; label: string; onClick: () => void; disabled?: boolean; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-colors disabled:opacity-50",
        tone === "danger" ? "border-bad/25 text-bad hover:bg-bad/10" : "border-edge/10 bg-edge/[0.03] text-ink hover:bg-edge/[0.07]"
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function PriceDialog({ open, onClose, count, onApply }: { open: boolean; onClose: () => void; count: string; onApply: (percent: number) => Promise<boolean> }) {
  const [value, setValue] = useState("10");
  const [busy, setBusy] = useState(false);
  const n = Number(value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  const valid = Number.isFinite(n) && n !== 0 && n >= -90 && n <= 500;
  const example = valid ? Math.round(100 * (1 + n / 100)) : null;
  return (
    <DashDialog
      open={open}
      onClose={() => !busy && onClose()}
      title={`تعديل سعر ${count}`}
      description="رفع أو خفض بنسبة مئوية، ويشمل السعر قبل الخصم (فتبقى نسبة الخصم كما هي) وأسعار المقاسات والألوان. تُقرَّب الأسعار لأقرب جنيه."
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
            تراجع
          </button>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onApply(n);
              setBusy(false);
              if (ok) onClose();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            طبّق
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {[-20, -10, 5, 10, 15, 25].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setValue(String(v))}
            className={cn("min-h-10 rounded-xl border px-3 text-[12.5px] font-bold tabular-nums", String(v) === value ? "border-nova bg-nova/12 text-nova-2" : "border-edge/10 text-ink-2 hover:bg-edge/5")}
            dir="ltr"
          >
            {v > 0 ? "+" : ""}
            {v}%
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[12px] font-bold text-ink-2">نسبة أخرى</span>
        <span className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            dir="ltr"
            className="min-h-11 w-28 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-end text-[14px] font-black tabular-nums text-ink outline-none focus:ring-2 focus:ring-nova/20"
          />
          <span className="text-[13px] font-bold text-ink-2">%</span>
        </span>
      </label>
      <p className="mt-2 text-[12px] text-ink-3">{valid ? `مثال: منتج بـ 100 ج يصبح بـ ${fmtNum(example!)} ج.` : "اكتب نسبة بين -90 و500 (مثل 10 أو -15)."}</p>
    </DashDialog>
  );
}

function CategoryDialog({
  open,
  onClose,
  count,
  categories,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  count: string;
  categories: { id: string; name: string }[];
  onApply: (categoryId: string | null) => Promise<boolean>;
}) {
  const [cat, setCat] = useState<string>(categories[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <DashDialog
      open={open}
      onClose={() => !busy && onClose()}
      title={`نقل ${count} إلى قسم`}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
            تراجع
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onApply(cat || null);
              setBusy(false);
              if (ok) onClose();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            انقل
          </button>
        </>
      }
    >
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-bold text-ink-2">القسم</span>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="min-h-11 w-full rounded-xl border border-edge/10 bg-space-2 px-3 text-[13px] font-bold text-ink outline-none focus:ring-2 focus:ring-nova/20">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="">بلا قسم</option>
        </select>
      </label>
    </DashDialog>
  );
}
