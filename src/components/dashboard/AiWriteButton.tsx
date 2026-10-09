"use client";

// زر "اكتب بالذكاء الاصطناعي" لمحتوى المنتج: يملأ السطر البيعي والوصف وSEO والكلمات المفتاحية،
// مع تراجع بضغطة. يعمل بمفتاح التاجر بعد التفعيل (ai/merchant).
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Loader2, Undo2, KeyRound, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { INTEGRATIONS_NAV } from "@/lib/edition";
import { aiProductCopyAction, aiStatusAction, type ProductCopy } from "@/server/actions/ai-assist";
import type { MerchantAiStatus } from "@/ai/merchant";

export function AiWriteButton({
  input,
  current,
  onApply,
}: {
  input: { name: string; priceEgp?: number; category?: string; attributes?: { label: string; value: string }[]; description?: string };
  current: ProductCopy;
  onApply: (copy: ProductCopy) => void;
}) {
  const [status, setStatus] = useState<MerchantAiStatus | null>(null);
  const [pending, start] = useTransition();
  const [instruction, setInstruction] = useState("");
  const [open, setOpen] = useState(false);
  const [undo, setUndo] = useState<ProductCopy | null>(null);

  useEffect(() => {
    aiStatusAction().then(setStatus).catch(() => {});
  }, []);

  function generate() {
    if (input.name.trim().length < 2) {
      toast.error("اكتب اسم المنتج أولاً");
      return;
    }
    start(async () => {
      const r = await aiProductCopyAction({
        ...input,
        attributes: input.attributes?.filter((a) => a.label && a.value),
        instruction: instruction.trim() || undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setUndo(current);
      onApply(r.data);
      setOpen(false);
      toast.success("كتبنا المحتوى. راجعه وعدّل ما تريد.");
      aiStatusAction().then(setStatus).catch(() => {});
    });
  }

  if (status?.mode === "needs_key") {
    return (
      <Link
        href={INTEGRATIONS_NAV.href}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-warn/30 bg-warn/10 px-3 text-[11.5px] font-black text-warn"
      >
        <KeyRound className="size-3.5" aria-hidden="true" />
        اربط مفتاح Groq لتفعيل الكتابة الذكية
      </Link>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        {undo ? (
          <button
            type="button"
            onClick={() => {
              onApply(undo);
              setUndo(null);
            }}
            className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-[11.5px] font-bold text-ink-3 transition hover:bg-edge/[0.05] hover:text-ink"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            تراجع
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={pending}
          aria-expanded={open}
          className="group relative inline-flex min-h-10 items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-l from-aurora to-nova px-3.5 text-[12px] font-black text-white shadow-lg shadow-aurora/25 transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
          {pending ? "نكتب الآن..." : "اكتب بالذكاء الاصطناعي"}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="dash-card absolute end-0 top-full z-20 mt-2 w-[min(22rem,85vw)] space-y-3 p-4"
          >
            <p className="text-[12.5px] font-black text-ink">ماذا تريد أن نبرز؟ (اختياري)</p>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="مثال: مناسب كهدية، خامة قطن 100%، مقاسات كبيرة متاحة"
              className="w-full resize-none rounded-xl border border-edge/10 bg-edge/[0.03] p-2.5 text-[12.5px] text-ink outline-none placeholder:text-ink-3/60 focus:border-nova"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-3">
                {status?.mode === "own"
                  ? "بمفتاحك الخاص"
                  : status?.mode === "trial"
                    ? `التجربة: ${status.remaining} محاولة متبقية اليوم`
                    : ""}
              </span>
              <button
                type="button"
                onClick={generate}
                disabled={pending}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-nova px-3.5 text-[12px] font-black text-white transition hover:brightness-110 disabled:opacity-60"
                )}
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" aria-hidden="true" />}
                اكتب الآن
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
