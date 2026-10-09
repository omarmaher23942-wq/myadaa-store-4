"use client";

// CustomerActions — ما يفعله التاجر في ملف العميل: ملاحظات خاصة تُحفظ بزر (ولا يراها العميل)، وحظر برقمه بتأكيد
// يشرح أثره، ورفع الحظر بضغطة.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fmtNum } from "@/lib/format";
import { saveCustomerNotesAction, setCustomerBlockedAction } from "@/server/actions/customers";
import { ConfirmDialog } from "../ui/DashDialog";
import { inputCls } from "../product/parts";

const NOTES_MAX = 1000;

export function CustomerNotes({ id, initial }: { id: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = notes.trim() !== saved.trim();

  async function save() {
    setBusy(true);
    const r = await saveCustomerNotesAction(id, notes).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    setSaved(notes);
    toast.success("حُفظت الملاحظات");
  }

  return (
    <div className="space-y-2">
      <label htmlFor="customer-notes" className="sr-only">
        ملاحظات عن العميل
      </label>
      <textarea
        id="customer-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
        rows={4}
        placeholder="مثال: يفضّل الاتصال قبل التوصيل، مقاسه L، طلب لون كحلي حين يتوفر"
        className={`${inputCls} py-3 font-normal leading-6`}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-3">لا يراها العميل. {notes.length > NOTES_MAX * 0.8 ? `${fmtNum(notes.length)}/${fmtNum(NOTES_MAX)}` : ""}</span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-nova px-4 text-[12px] font-black text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
          {dirty ? "احفظ" : "محفوظة"}
        </button>
      </div>
    </div>
  );
}

export function BlockCustomer({ id, name, blocked }: { id: string; name: string; blocked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function apply(next: boolean): Promise<boolean> {
    const r = await setCustomerBlockedAction(id, next).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(next ? `حُظر «${name}»` : `رُفع الحظر عن «${name}»`);
    router.refresh();
    return true;
  }

  if (blocked)
    return (
      <button type="button" onClick={() => void apply(false)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ok/30 px-3.5 text-[12.5px] font-bold text-ok hover:bg-ok/10">
        <ShieldCheck className="size-4" aria-hidden="true" />
        ارفع الحظر
      </button>
    );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-bad/20 px-3.5 text-[12.5px] font-bold text-bad hover:bg-bad/10">
        <Ban className="size-4" aria-hidden="true" />
        حظر
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`حظر «${name}»؟`}
        description="لن يستطيع إتمام أي طلب جديد من متجرك برقم موبايله، ويرى رسالة «تواصل مع المتجر». طلباته السابقة لا تتأثر، وترفع الحظر في أي وقت."
        confirmLabel="احظر"
        tone="danger"
        onConfirm={() => apply(true)}
      />
    </>
  );
}
