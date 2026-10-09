"use client";

// ImageMover — نقل صور المنتجات من روابط خارجية إلى مساحة الصور في المتجر (المتجر لا يعرض صوراً من مواقع أخرى).
// يمر على المنتجات واحداً واحداً بتقدم حقيقي ويمكن إيقافه في أي لحظة. يستخدمه الاستيراد بعد الحفظ، وتنبيه صفحة
// المنتجات لما لم يُنقل بعد (إغلاق النافذة أثناء النقل، أو تعذر وصول مؤقت).
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImageUp, Loader2, RotateCcw } from "lucide-react";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { INTEGRATIONS_NAV } from "@/lib/edition";
import { productsWithExternalImagesAction, rehostProductImagesAction } from "@/server/actions/product-import";
import { DashDialog } from "../ui/DashDialog";

export type ImagesPhase = {
  total: number;
  done: number;
  moved: number;
  /** صور حُذفت لأنها لا تصلح (غير موجودة، ليست صورة، أكبر من الحد). */
  removed: { name: string; count: number; reason: string }[];
  /** صور تعذر الوصول إليها الآن، باقية بروابطها لإعادة المحاولة. */
  kept: number;
  running: boolean;
  current: string | null;
  stopped: string | null;
  needsKey?: boolean;
};

export function useImageMover() {
  const [phase, setPhase] = useState<ImagesPhase | null>(null);
  const stop = useRef(false);
  const left = useRef<{ id: string; name: string }[]>([]);

  async function run(list: { id: string; name: string }[], resume?: ImagesPhase) {
    stop.current = false;
    left.current = [...list];
    let s: ImagesPhase = resume
      ? { ...resume, running: true, stopped: null, needsKey: false }
      : { total: list.length, done: 0, moved: 0, removed: [], kept: 0, running: true, current: null, stopped: null };
    setPhase(s);
    for (const p of list) {
      if (stop.current) {
        s = { ...s, stopped: "أوقفتَ النقل. ما بقي يظهر في صفحة المنتجات لتكمله متى شئت." };
        break;
      }
      setPhase((s = { ...s, current: p.name }));
      const r = await rehostProductImagesAction({ id: p.id }).catch(() => ({ ok: false as const, error: "انقطع الاتصال. ما بقي يظهر في صفحة المنتجات لتكمله", code: undefined }));
      if (!r.ok) {
        s = { ...s, stopped: r.error, needsKey: r.code === "no_media" };
        break;
      }
      s = {
        ...s,
        done: s.done + 1,
        moved: s.moved + r.moved,
        kept: s.kept + r.kept,
        removed: r.removed.length ? [...s.removed, { name: p.name, count: r.removed.length, reason: r.removed[0]!.reason }] : s.removed,
      };
      left.current.shift();
      setPhase(s);
    }
    setPhase({ ...s, running: false, current: null });
  }

  const canRetry = Boolean(phase && !phase.running && phase.stopped && !phase.needsKey && left.current.length);
  return {
    phase,
    run: (list: { id: string; name: string }[]) => run(list),
    /** يكمل من أول منتج لم يُنقل بعد، مع الإبقاء على ما تحقق. */
    retry: () => (phase ? run(left.current, phase) : undefined),
    canRetry,
    stop: () => (stop.current = true),
    reset: () => setPhase(null),
  };
}

export function ImagesProgress({ p }: { p: ImagesPhase }) {
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const lost = p.removed.reduce((n, f) => n + f.count, 0);
  const finished = !p.running && !p.stopped && p.done === p.total;
  return (
    <div className="space-y-3">
      <div className="h-2 overflow-hidden rounded-full bg-edge/[0.07]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="تقدم نقل الصور">
        <div className="h-full rounded-full bg-gradient-to-l from-nova to-aurora transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[13px] font-bold text-ink" aria-live="polite">
        المنتجات: {fmtNum(p.done)} من {fmtNum(p.total)}
        {p.moved ? <span className="font-normal text-ink-3"> · نُقلت {arCount(p.moved, NOUN.image)}</span> : null}
      </p>
      {p.current ? (
        <p className="flex items-center gap-2 text-[12.5px] text-ink-2">
          <Loader2 className="size-4 shrink-0 animate-spin text-nova-2" aria-hidden="true" />
          <span className="truncate">ننقل صور: {p.current}</span>
        </p>
      ) : null}
      {finished && !lost && !p.kept ? (
        <p className="flex items-center gap-2 rounded-xl bg-ok/10 p-3 text-[12.5px] font-bold text-ok">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          نُقلت كل الصور، وصارت تظهر في متجرك.
        </p>
      ) : null}
      {finished && p.kept ? (
        <p className="rounded-xl bg-warn/10 p-3 text-[12.5px] leading-6 text-warn">
          تعذر الوصول إلى {arCount(p.kept, NOUN.image)} الآن، فبقيت بروابطها. أعد المحاولة بعد قليل بزر «انقل الصور الآن» في صفحة المنتجات.
        </p>
      ) : null}
      {p.stopped ? (
        <p className="rounded-xl bg-warn/10 p-3 text-[12.5px] leading-6 text-warn">
          توقف النقل: {p.stopped}
          {p.needsKey ? (
            <Link href={INTEGRATIONS_NAV.href} className="ms-1 font-black underline">
              أضف المفتاح
            </Link>
          ) : null}
        </p>
      ) : null}
      {p.removed.length ? (
        <details open={!p.running} className="rounded-xl border border-bad/20">
          <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-black text-bad">
            {arCount(lost, NOUN.image)} لا تصلح، فحُذفت من منتجاتها لتضيف غيرها
          </summary>
          <ul className="max-h-36 space-y-1 overflow-y-auto px-3.5 pb-3 text-[12px] text-ink-2">
            {p.removed.slice(0, 50).map((f, i) => (
              <li key={`${i}-${f.name}`}>
                <b>{f.name}:</b> {arCount(f.count, NOUN.image)} ({f.reason})
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** أزرار نهاية النقل: «أعد المحاولة» حين توقف لسبب مؤقت وبقيت منتجات، و«تم». */
export function MoverDoneButtons({ mover, onDone }: { mover: ReturnType<typeof useImageMover>; onDone: () => void }) {
  return (
    <>
      {mover.canRetry ? (
        <button type="button" onClick={mover.retry} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
          <RotateCcw className="size-4" aria-hidden="true" />
          أعد المحاولة
        </button>
      ) : null}
      <button type="button" onClick={onDone} className="inline-flex min-h-11 items-center rounded-xl bg-nova px-5 text-[12.5px] font-black text-white">
        تم
      </button>
    </>
  );
}

/** تنبيه صفحة المنتجات: منتجات صورها ما زالت على روابط خارجية فلا تظهر في المتجر، وزر لنقلها الآن. */
export function PendingImages({ count }: { count: number }) {
  const router = useRouter();
  const mover = useImageMover();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    const list = await productsWithExternalImagesAction().catch(() => []);
    setLoading(false);
    if (!list.length) return void router.refresh();
    setOpen(true);
    await mover.run(list);
  }

  const close = () => {
    if (mover.phase?.running) return void mover.stop();
    setOpen(false);
    mover.reset();
    router.refresh();
  };

  if (count === 0) return null;
  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-warn/25 bg-warn/[0.06] p-3.5 sm:flex-row sm:items-center">
        <ImageUp className="hidden size-5 shrink-0 text-warn sm:block" aria-hidden="true" />
        <p className="flex-1 text-[12.5px] leading-6 text-ink-2">
          <b className="text-ink">صور {arCount(count, NOUN.product)} على روابط خارجية</b> فلا تظهر في متجرك. ننقلها إلى مساحة الصور في متجرك في دقائق.
        </p>
        <button
          type="button"
          onClick={start}
          disabled={loading}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-nova px-4 text-[12.5px] font-black text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImageUp className="size-4" aria-hidden="true" />}
          انقل الصور الآن
        </button>
      </div>
      <DashDialog
        open={open}
        onClose={close}
        title="نقل الصور إلى متجرك"
        description="نجلب كل صورة من رابطها ونرفعها إلى مساحة الصور في متجرك. أبقِ هذه النافذة مفتوحة حتى ينتهي النقل."
        footer={
          mover.phase?.running ? (
            <button type="button" onClick={mover.stop} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
              أوقف بعد المنتج الحالي
            </button>
          ) : (
            <MoverDoneButtons mover={mover} onDone={close} />
          )
        }
      >
        {mover.phase ? <ImagesProgress p={mover.phase} /> : null}
      </DashDialog>
    </>
  );
}
