"use client";

// ProductsTable — جدول منتجات + Bulk actions + Duplicate/Delete.
import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Package,
  Edit3,
  Copy,
  Trash2,
  MoreVertical,
  Plus,
  Percent,
  Tag,
  EyeOff,
  Eye,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  deleteProductAction,
  duplicateProductAction,
  bulkUpdateProductsAction,
} from "@/server/actions/products";

const SW = 1.75;

type Row = {
  id: string;
  name: string;
  slug: string;
  pricePiasters: number;
  compareAtPiasters: number | null;
  costPiasters: number | null;
  stock: number | null;
  trackStock: boolean;
  status: string;
  images: unknown;
  shortDescription: string | null;
  categoryId: string | null;
  createdAt: string;
};

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as { url?: string } | string;
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "url" in first) return first.url ?? null;
  return null;
}

export function ProductsTable({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<
    | { kind: "delete"; id: string }
    | { kind: "bulkDelete" }
    | { kind: "bulkPrice"; percent: number }
    | null
  >(null);
  const router = useRouter();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected(
      selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))
    );

  const doDelete = (id: string) =>
    start(async () => {
      const r = await deleteProductAction(id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("تم حذف المنتج");
        router.refresh();
      }
      setDialog(null);
    });

  const doDuplicate = (id: string) =>
    start(async () => {
      const r = await duplicateProductAction(id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("تم تكرار المنتج");
        router.refresh();
      }
    });

  const doBulkDelete = () =>
    start(async () => {
      const ids = Array.from(selected);
      const r = await bulkUpdateProductsAction(ids, { action: "delete" });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`تم حذف ${ids.length} منتج`);
        setSelected(new Set());
        router.refresh();
      }
      setDialog(null);
    });

  const doBulkPrice = (percent: number) =>
    start(async () => {
      const ids = Array.from(selected);
      const r = await bulkUpdateProductsAction(ids, {
        action: "pricePercent",
        percent,
      });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`تم تطبيق ${percent > 0 ? "+" : ""}${percent}% على ${ids.length} منتج`);
        setSelected(new Set());
        router.refresh();
      }
      setDialog(null);
    });

  const doBulkStatus = (status: "active" | "draft" | "hidden") =>
    start(async () => {
      const ids = Array.from(selected);
      const r = await bulkUpdateProductsAction(ids, { action: "status", status });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`تم تحديث ${ids.length} منتج`);
        setSelected(new Set());
        router.refresh();
      }
    });

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-edge/10 bg-edge/[0.02]">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="border-b border-edge/10 bg-edge/[0.02] text-ink-3">
            <tr>
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={toggleAll}
                  aria-label="تحديد الكل"
                  className="size-4 accent-nova"
                />
              </th>
              <th className="p-3 text-start font-bold">المنتج</th>
              <th className="p-3 text-start font-bold">السعر</th>
              <th className="p-3 text-start font-bold">الربح</th>
              <th className="p-3 text-start font-bold">المخزون</th>
              <th className="p-3 text-start font-bold">الحالة</th>
              <th className="p-3 text-start font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge/[0.04]">
            {rows.map((p) => {
              const img = firstImage(p.images);
              const profit =
                p.costPiasters && p.costPiasters > 0
                  ? p.pricePiasters - p.costPiasters
                  : null;
              const profitPct =
                profit !== null && p.pricePiasters > 0
                  ? Math.round((profit / p.pricePiasters) * 100)
                  : null;
              const checked = selected.has(p.id);
              const lowStock =
                p.trackStock && p.stock !== null && p.stock <= 3;

              return (
                <tr
                  key={p.id}
                  className={cn(
                    "transition-colors",
                    checked ? "bg-nova/[0.06]" : "hover:bg-edge/[0.02]"
                  )}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      aria-label={`تحديد ${p.name}`}
                      className="size-4 accent-nova"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-edge/10 bg-edge/[0.03]">
                        {img ? (
                          <Image
                            src={img}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="grid size-full place-items-center text-ink-3">
                            <Package className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/products/${p.id}`}
                          className="truncate text-xs font-bold text-ink hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.shortDescription ? (
                          <p className="mt-0.5 line-clamp-1 text-[10.5px] text-ink-3">
                            {p.shortDescription}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-sm font-black tabular-nums text-ink">
                      {formatEgp(p.pricePiasters)}
                    </div>
                    {p.compareAtPiasters && p.compareAtPiasters > p.pricePiasters ? (
                      <div className="mt-0.5 font-mono text-[10.5px] text-ink-3 line-through">
                        {formatEgp(p.compareAtPiasters)}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    {profit !== null ? (
                      <>
                        <div className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-300">
                          {formatEgp(profit)}
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-ink-3">
                          {profitPct}% هامش
                        </div>
                      </>
                    ) : (
                      <span className="text-[10.5px] text-ink-3">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {p.trackStock ? (
                      <span
                        className={cn(
                          "font-mono font-bold",
                          lowStock ? "text-rose-600 dark:text-rose-300" : "text-ink-2"
                        )}
                      >
                        {p.stock ?? 0} قطعة
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                        غير محدود
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "inline-block rounded-lg border px-2.5 py-1 text-[11px] font-bold",
                        p.status === "active"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-400/30"
                          : p.status === "draft"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30"
                            : "bg-ink-3/15 text-ink-2 border-edge/15"
                      )}
                    >
                      {p.status === "active"
                        ? "منشور"
                        : p.status === "draft"
                          ? "مسودة"
                          : "مخفي"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/products/${p.id}`}
                        className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5"
                        aria-label="تعديل"
                      >
                        <Edit3 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => doDuplicate(p.id)}
                        disabled={pending}
                        className="grid size-9 place-items-center rounded-lg border border-edge/10 text-ink-2 transition-colors hover:bg-edge/5 disabled:opacity-50"
                        aria-label="تكرار"
                        title="تكرار المنتج"
                      >
                        <Copy className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: "delete", id: p.id })}
                        className="grid size-9 place-items-center rounded-lg border border-edge/10 text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-500/10"
                        aria-label="حذف"
                      >
                        <Trash2 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="mx-auto size-10 opacity-30" strokeWidth={SW} aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-ink">لا توجد منتجات</p>
            <Link
              href="/dashboard/products/new"
              className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-nova px-4 text-xs font-black text-white"
            >
              <Plus className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
              أضف أول منتج
            </Link>
          </div>
        ) : null}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-nova/30 bg-space-2/95 p-3 shadow-2xl backdrop-blur-xl md:inset-x-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-black text-ink">
              {selected.size.toLocaleString("ar-EG")} منتج مُحدَّد
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setDialog({ kind: "bulkPrice", percent: 10 })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 text-[11px] font-bold text-violet-600 dark:text-violet-300 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
              >
                <Percent className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                تعديل السعر %
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => doBulkStatus("active")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
              >
                <Eye className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                نشر
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => doBulkStatus("hidden")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink-3/20 px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-ink-3/30 disabled:opacity-50"
              >
                <EyeOff className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                إخفاء
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDialog({ kind: "bulkDelete" })}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 text-[11px] font-bold text-rose-600 dark:text-rose-300 transition-colors hover:bg-rose-500/30 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                حذف
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-9 rounded-lg px-3 text-[11px] font-bold text-ink-3 transition-colors hover:text-ink"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Dialogs */}
      {dialog?.kind === "delete" ? (
        <ConfirmDialog
          title="حذف المنتج؟"
          description="سيتم الحذف النهائي ولا يمكن التراجع."
          confirmText="حذف"
          tone="danger"
          onCancel={() => setDialog(null)}
          onConfirm={() => doDelete(dialog.id)}
        />
      ) : null}

      {dialog?.kind === "bulkDelete" ? (
        <ConfirmDialog
          title={`حذف ${selected.size} منتج؟`}
          description="سيتم الحذف النهائي ولا يمكن التراجع."
          confirmText="حذف الكل"
          tone="danger"
          onCancel={() => setDialog(null)}
          onConfirm={doBulkDelete}
        />
      ) : null}

      {dialog?.kind === "bulkPrice" ? (
        <PricePercentDialog
          onCancel={() => setDialog(null)}
          onConfirm={doBulkPrice}
        />
      ) : null}
    </>
  );
}

// ─── Dialog: Confirm ────────────────────────────────────────────────────────
function ConfirmDialog({
  title,
  description,
  confirmText,
  tone = "default",
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmText: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
        <h3 className="text-lg font-black text-ink">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">{description}</p>
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
            onClick={onConfirm}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-xs font-black text-ink transition-colors",
              tone === "danger"
                ? "bg-rose-500 hover:bg-rose-600"
                : "bg-nova hover:bg-nova"
            )}
          >
            <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog: Price Percent ─────────────────────────────────────────────────
function PricePercentDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: (percent: number) => void;
  onCancel: () => void;
}) {
  const [pct, setPct] = useState("10");
  const numeric = Number(pct);
  const valid = Number.isFinite(numeric) && numeric >= -90 && numeric <= 500;

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
        <h3 className="text-lg font-black text-ink">تعديل السعر بنسبة</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          أدخل نسبة موجبة للزيادة أو سالبة للتخفيض (مثال: 10 أو -15).
        </p>
        <input
          type="number"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          dir="ltr"
          className="mt-4 h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-center font-mono text-lg font-black text-ink outline-none focus:ring-2 focus:ring-nova/40"
          aria-label="نسبة التعديل"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[-20, -10, -5, 5, 10, 20].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setPct(String(v))}
              className="rounded-lg border border-edge/10 bg-edge/[0.03] px-2.5 py-1 font-mono text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06]"
            >
              {v > 0 ? "+" : ""}
              {v}%
            </button>
          ))}
        </div>
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
            onClick={() => onConfirm(numeric)}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-nova px-4 text-xs font-black text-white transition-colors hover:bg-nova disabled:opacity-50"
          >
            <Tag className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            تطبيق
          </button>
        </div>
      </div>
    </div>
  );
}