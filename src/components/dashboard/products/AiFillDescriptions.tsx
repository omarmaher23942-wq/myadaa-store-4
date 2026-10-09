"use client";

// AiFillDescriptions — «اكتب الأوصاف الناقصة»: يمر على المنتجات التي بلا وصف واحداً واحداً، يكتب لكل منها سطراً بيعياً
// ووصفاً وكلمات بحث بمساعد المتجر (مفتاح التاجر أو حصة التجربة)، ويحفظ دون أن يكتب فوق ما كتبه التاجر. تقدم حقيقي
// وإيقاف في أي لحظة، ويتوقف وحده عند نفاد الحصة أو غياب المفتاح برسالة واضحة.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { INTEGRATIONS_NAV } from "@/lib/edition";
import { aiProductCopyAction, applyProductCopyAction } from "@/server/actions/ai-assist";
import { productsMissingCopyAction } from "@/server/actions/product-import";
import { DashDialog } from "../ui/DashDialog";

type Item = { id: string; name: string; priceEgp: number; category: string | null };

export function AiFillDescriptions({ missing }: { missing: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [stopReason, setStopReason] = useState<{ text: string; needsKey?: boolean } | null>(null);
  const stop = useRef(false);

  if (missing === 0) return null;

  async function begin() {
    setOpen(true);
    setStopReason(null);
    setDoneCount(0);
    const list = await productsMissingCopyAction().catch(() => []);
    setItems(list);
    if (!list.length) return;
    setRunning(true);
    stop.current = false;
    let ok = 0;
    for (const it of list) {
      if (stop.current) break;
      setCurrent(it.name);
      const lost = { ok: false as const, error: "انقطع الاتصال، أعد المحاولة", code: undefined };
      const r = await aiProductCopyAction({ name: it.name, priceEgp: it.priceEgp, category: it.category ?? undefined }).catch(() => lost);
      if (!r.ok) {
        setStopReason({ text: r.error, needsKey: r.code === "needs_key" || r.code === "key_rejected" });
        break;
      }
      const saved = await applyProductCopyAction({ id: it.id, copy: r.data }).catch(() => lost);
      if (!saved.ok) {
        setStopReason({ text: saved.error });
        break;
      }
      ok++;
      setDoneCount(ok);
    }
    setRunning(false);
    setCurrent(null);
    if (ok) {
      toast.success(`كُتب وصف ${arCount(ok, NOUN.product)}. راجعها من صفحة كل منتج.`);
      router.refresh();
    }
  }

  const total = items?.length ?? missing;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <>
      <button
        type="button"
        onClick={begin}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-nova/30 bg-nova/10 px-3.5 text-[12.5px] font-black text-nova-2 transition-colors hover:bg-nova/20"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        <span className="sm:hidden">اكتب الأوصاف ({fmtNum(missing)})</span>
        <span className="hidden sm:inline">اكتب الأوصاف الناقصة ({fmtNum(missing)})</span>
      </button>

      <DashDialog
        open={open}
        onClose={() => {
          if (running) stop.current = true;
          else setOpen(false);
        }}
        title="كتابة الأوصاف الناقصة"
        description="لكل منتج بلا وصف: سطر بيعي ووصف وكلمات بحث بأسلوب متجرك. لا يُكتب فوق أي وصف كتبته أنت، وتراجع كل منتج وتعدّله من صفحته."
        footer={
          running ? (
            <button type="button" onClick={() => (stop.current = true)} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
              أوقف بعد المنتج الحالي
            </button>
          ) : (
            <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center rounded-xl bg-nova px-5 text-[12.5px] font-black text-white">
              تم
            </button>
          )
        }
      >
        <div className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-edge/[0.07]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="التقدم">
            <div className="h-full rounded-full bg-gradient-to-l from-nova to-aurora transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[13px] font-bold text-ink" aria-live="polite">
            {items === null ? "نجهّز القائمة…" : items.length === 0 ? "كل منتجاتك لها وصف." : `${fmtNum(doneCount)} من ${fmtNum(items.length)}`}
          </p>
          {current ? (
            <p className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <Loader2 className="size-4 shrink-0 animate-spin text-nova-2" aria-hidden="true" />
              <span className="truncate">نكتب: {current}</span>
            </p>
          ) : null}
          {stopReason ? (
            <div className="rounded-xl bg-warn/10 p-3 text-[12.5px] leading-6 text-warn">
              توقفنا: {stopReason.text}
              {stopReason.needsKey ? (
                <Link href={INTEGRATIONS_NAV.href} className="ms-1 font-black underline">
                  أضف المفتاح
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </DashDialog>
    </>
  );
}
