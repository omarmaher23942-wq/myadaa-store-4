"use client";

// DashDialog — نافذة اللوحة على عنصر <dialog> الأصلي: تُعرض في الطبقة العليا للمتصفح وهي داخل .dash فترث
// توكنات الثيم، وتحبس التركيز وتُغلق بـ Esc بلا مكتبة. على الموبايل ورقة من الأسفل، وعلى الشاشات الأكبر في الوسط.
// ConfirmDialog فوقها: تأكيد إجراء حساس مع سبب اختياري، وحالة انتظار حتى ينتهي الإجراء.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn("dash-dialog", className)}
    >
      <div className="flex items-start justify-between gap-3 border-b border-edge/10 px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[15px] font-black text-ink">
            {title}
          </h2>
          {description ? (
            <div id={descId} className="mt-1 text-[12.5px] leading-6 text-ink-2">
              {description}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
        >
          <X className="size-4" strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
      {children ? <div className="px-5 py-4">{children}</div> : null}
      {footer ? <div className="flex flex-wrap-reverse justify-end gap-2 border-t border-edge/10 px-5 py-3.5">{footer}</div> : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  tone = "primary",
  noteLabel,
  notePlaceholder,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  /** إن وُجد: حقل سبب/ملاحظة اختياري يُمرَّر للإجراء. */
  noteLabel?: string;
  notePlaceholder?: string;
  onConfirm: (note: string) => Promise<boolean>;
  children?: ReactNode;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setBusy(false);
    }
  }, [open]);

  async function confirm() {
    setBusy(true);
    const done = await onConfirm(note.trim()).catch(() => false);
    setBusy(false);
    if (done) onClose();
  }

  return (
    <DashDialog
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      description={description}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 transition-colors hover:bg-edge/5 disabled:opacity-50"
          >
            تراجع
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-[12.5px] font-black text-white transition disabled:opacity-60",
              tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-gradient-to-b from-nova to-nova-deep shadow-md hover:shadow-lg"
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {noteLabel ? (
        <label className={cn("block", children ? "mt-3" : undefined)}>
          <span className="mb-1.5 block text-[12px] font-bold text-ink-2">{noteLabel}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={notePlaceholder}
            className="w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-3 focus:border-nova/50 focus:ring-2 focus:ring-nova/20"
          />
        </label>
      ) : null}
    </DashDialog>
  );
}
