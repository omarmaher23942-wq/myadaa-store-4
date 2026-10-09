"use client";

// OrderReviewForm — تقييم منتجات طلب مُسلَّم: نجوم وكلمتان وحتى 3 صور لكل منتج، والاسم الظاهر يختاره العميل، وإرسال واحد
// لكل ما قيّمه. المنتج الذي قيّمه من قبل يظهر بتقييمه دون نموذج. الصور تُرفع لمساحة المتجر (customerReviewImage).
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, CheckCircle2, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing-client";
import { submitOrderReviewsAction } from "@/server/actions/reviews";

const SW = 1.75;
const LABELS = ["", "سيئ", "مقبول", "جيد", "جيد جداً", "ممتاز"];

export type ReviewableItem = { productId: string; name: string; variantLabel: string | null; image: string | null; slug: string; reviewed: number | null };
type Draft = { rating: number; body: string; images: string[]; uploading: boolean };

export function OrderReviewForm({ subdomain, code, token, defaultName, items }: { subdomain: string; code: string; token: string | null; defaultName: string; items: ReviewableItem[] }) {
  const [name, setName] = useState(defaultName);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const { startUpload } = useUploadThing("customerReviewImage", {
    onUploadError: (e) => {
      toast.error(/[؀-ۿ]/.test(e?.message ?? "") ? e.message : "تعذر رفع الصورة. حاول مرة أخرى");
    },
  });

  const open = items.filter((i) => i.reviewed === null && !sent.has(i.productId));
  const draft = (id: string): Draft => drafts[id] ?? { rating: 0, body: "", images: [], uploading: false };
  const patch = (id: string, p: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...draft(id), ...d[id], ...p } }));
  const rated = open.filter((i) => draft(i.productId).rating > 0);

  async function addPhotos(id: string, files: FileList | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") && f.type !== "image/svg+xml").slice(0, 3 - draft(id).images.length);
    if (!list.length) return;
    patch(id, { uploading: true });
    const res = await startUpload(list, { subdomain }).catch(() => undefined);
    setDrafts((d) => {
      const cur = d[id] ?? draft(id);
      return { ...d, [id]: { ...cur, uploading: false, images: [...cur.images, ...(res ?? []).map((r) => r.ufsUrl)].slice(0, 3) } };
    });
  }

  async function send() {
    if (!rated.length) return void toast.error("اختر عدد النجوم لمنتج واحد على الأقل");
    if (name.trim().length < 2) return void toast.error("اكتب الاسم الذي يظهر مع تقييمك");
    setSending(true);
    const r = await submitOrderReviewsAction({
      subdomain,
      code,
      token,
      displayName: name,
      items: rated.map((i) => ({ productId: i.productId, rating: draft(i.productId).rating, body: draft(i.productId).body, imageUrls: draft(i.productId).images })),
    }).catch(() => ({ ok: false as const, error: "انقطع الاتصال، حاول مرة أخرى" }));
    setSending(false);
    if (!r.ok) return void toast.error(r.error);
    setSent((s) => new Set([...s, ...rated.map((i) => i.productId)]));
    toast.success("شكراً لك! تقييمك وصل للمتجر");
  }

  const allDone = items.every((i) => i.reviewed !== null || sent.has(i.productId));

  return (
    <div className="mt-6 space-y-4">
      {items.map((it) => {
        const prior = it.reviewed ?? (sent.has(it.productId) ? draft(it.productId).rating : null);
        const d = draft(it.productId);
        return (
          <section key={it.productId} className="surface p-4 sm:p-5" aria-labelledby={`rv-${it.productId}`}>
            <div className="flex items-center gap-3">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                {it.image ? <Image src={it.image} alt="" fill sizes="64px" className="object-cover" /> : null}
              </span>
              <div className="min-w-0">
                <h2 id={`rv-${it.productId}`} className="truncate text-base font-bold">
                  {it.name}
                </h2>
                {it.variantLabel ? <p className="text-xs text-muted-foreground">{it.variantLabel}</p> : null}
              </div>
            </div>

            {prior !== null ? (
              <p className="mt-3 flex items-center gap-2 text-sm font-bold text-primary">
                <CheckCircle2 strokeWidth={SW} className="size-5" aria-hidden="true" />
                قيّمته {prior} من 5. شكراً لك
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div role="radiogroup" aria-label={`تقييم ${it.name}`} className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={d.rating === n}
                      aria-label={`${n} من 5 (${LABELS[n]})`}
                      onClick={() => patch(it.productId, { rating: n })}
                      className="grid size-11 place-items-center rounded-lg transition-transform active:scale-90"
                    >
                      <Star strokeWidth={SW} className={cn("size-8", n <= d.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} aria-hidden="true" />
                    </button>
                  ))}
                  {d.rating ? <span className="ms-2 text-sm font-bold">{LABELS[d.rating]}</span> : null}
                </div>

                {d.rating ? (
                  <>
                    <label className="block">
                      <span className="sr-only">رأيك في {it.name}</span>
                      <textarea
                        value={d.body}
                        onChange={(e) => patch(it.productId, { body: e.target.value.slice(0, 1000) })}
                        rows={3}
                        placeholder="الخامة، المقاس، اللون… أي شيء يفيد من سيشتري بعدك (اختياري)"
                        className="w-full rounded-lg border bg-background p-3 text-sm outline-none ring-primary/30 focus:ring-2"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.images.map((u) => (
                        <span key={u} className="relative size-16 overflow-hidden rounded-lg bg-muted">
                          <Image src={u} alt="" fill sizes="64px" className="object-cover" />
                          <button type="button" onClick={() => patch(it.productId, { images: d.images.filter((x) => x !== u) })} aria-label="حذف الصورة" className="absolute end-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-black/60 text-white">
                            <X className="size-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                      {d.images.length < 3 ? (
                        <label className={cn("flex size-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed text-[11px] text-muted-foreground", d.uploading && "pointer-events-none opacity-60")}>
                          {d.uploading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Camera strokeWidth={SW} className="size-5" aria-hidden="true" />}
                          صورة
                          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => void addPhotos(it.productId, e.target.files)} />
                        </label>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </section>
        );
      })}

      {allDone ? (
        <div className="surface p-6 text-center">
          <CheckCircle2 strokeWidth={SW} className="mx-auto size-8 text-primary" aria-hidden="true" />
          <p className="mt-2 font-bold">وصلتنا تقييماتك، شكراً لك!</p>
          <Link href="/" className="btn-brand mt-4">
            تصفح المتجر
          </Link>
        </div>
      ) : (
        <div className="surface space-y-3 p-4 sm:p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">الاسم الظاهر مع تقييمك</span>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} className="w-full rounded-lg border bg-background px-3 py-3 outline-none ring-primary/30 focus:ring-2" />
          </label>
          <button type="button" onClick={send} disabled={sending || !rated.length || open.some((i) => draft(i.productId).uploading)} className="btn-brand w-full disabled:opacity-50">
            {sending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            {rated.length ? `أرسل ${rated.length === 1 ? "تقييمك" : `${rated.length} تقييمات`}` : "اختر النجوم أولاً"}
          </button>
          <p className="text-center text-xs text-muted-foreground">رقم موبايلك لا يظهر لأحد.</p>
        </div>
      )}
    </div>
  );
}
