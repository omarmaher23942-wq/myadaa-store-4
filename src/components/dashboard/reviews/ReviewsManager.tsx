"use client";

// ReviewsManager — التقييمات: لكل تقييم نجومه ونصه وصوره والمنتج، و«موثّق من طلب CLP-…» حين جاء من طلب حقيقي، واعتماد
// أو إخفاء بضغطة (فردي وجماعي)، وحذف مع «تراجع»، وواتساب للعميل (لشكره أو لحل مشكلة في تقييم منخفض).
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, EyeOff, MessageCircle, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { arCount, NOUN } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { isHostedImage } from "@/lib/media-hosts";
import { timeAgo } from "../orders/parts";
import { deleteReviewAction, restoreReviewAction, setReviewsApprovalAction } from "@/server/actions/reviews";
import type { ReviewRow } from "@/server/repos/reviews-list";
import { requestPulse } from "../DashboardPulse";

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} من 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-4", i <= n ? "fill-warn text-warn" : "text-edge/25")} aria-hidden="true" />
      ))}
    </span>
  );
}

export function ReviewsManager({ rows, storeName }: { rows: ReviewRow[]; storeName: string }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setList(rows);
    setSelected(new Set());
  }, [rows]);

  const refresh = () => {
    requestPulse();
    router.refresh();
  };

  async function approve(idsToSet: string[], approved: boolean) {
    setBusy(idsToSet.length === 1 ? idsToSet[0]! : "bulk");
    const r = await setReviewsApprovalAction(idsToSet, approved).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success(approved ? (idsToSet.length > 1 ? `اعتُمد ${arCount(idsToSet.length, NOUN.review)}، وظهرت في صفحات المنتجات` : "اعتُمد، ويظهر الآن في صفحة المنتج") : "أُخفي من صفحة المنتج");
    refresh();
  }

  async function remove(r: ReviewRow) {
    setBusy(r.id);
    const res = await deleteReviewAction(r.id).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setList((l) => l.filter((x) => x.id !== r.id));
    toast.success("حُذف التقييم", {
      action: {
        label: "تراجع",
        onClick: async () => {
          const back = await restoreReviewAction(res.deleted).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
          if (!back.ok) return void toast.error(back.error);
          toast.success("أُعيد التقييم");
          refresh();
        },
      },
    });
    refresh();
  }

  const pendingSelected = list.filter((r) => selected.has(r.id) && !r.isApproved).map((r) => r.id);

  if (!list.length) return null;

  return (
    <div className="space-y-3">
      {pendingSelected.length ? (
        <div className="dash-card sticky top-20 z-20 flex flex-wrap items-center justify-between gap-2 border-nova/30 p-2.5 ps-4">
          <span className="text-[12.5px] font-bold text-ink-2">محدد: {arCount(pendingSelected.length, NOUN.review)}</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className="inline-flex min-h-10 items-center rounded-xl px-3 text-[12px] font-bold text-ink-3 hover:bg-edge/5">
              إلغاء
            </button>
            <button type="button" onClick={() => approve(pendingSelected, true)} disabled={busy === "bulk"} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-nova px-4 text-[12px] font-black text-white disabled:opacity-50">
              <Check className="size-4" aria-hidden="true" />
              اعتمد المحدد
            </button>
          </span>
        </div>
      ) : null}

      <ul className="space-y-3">
        {list.map((r) => {
          const wa = waLink(
            r.customerPhone,
            r.rating <= 3
              ? `أهلاً ${r.customerName.split(" ")[0]}، معك ${storeName}. شكراً على تقييمك لـ«${r.productName ?? "المنتج"}». يهمنا نعرف ما الذي لم يعجبك لنصلحه.`
              : `أهلاً ${r.customerName.split(" ")[0]}، معك ${storeName}. شكراً جزيلاً على تقييمك لـ«${r.productName ?? "المنتج"}»، سعدنا أنه أعجبك.`
          );
          return (
            <li key={r.id} className={cn("dash-card p-4", !r.isApproved && "border-warn/25")}>
              <div className="flex items-start gap-3">
                {!r.isApproved ? (
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                    aria-label={`تحديد تقييم ${r.customerName}`}
                    className="mt-1 size-4 shrink-0 accent-[var(--dash-nova)]"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Stars n={r.rating} />
                    <b className="text-[13px] text-ink">{r.customerName}</b>
                    {r.isVerified && r.orderId ? (
                      <Link href={`/dashboard/orders/${r.orderId}`} className="inline-flex items-center gap-1 rounded-full bg-ok/12 px-2 py-0.5 text-[10.5px] font-black text-ok hover:bg-ok/20" title="من طلب مُسلَّم">
                        <BadgeCheck className="size-3.5" aria-hidden="true" />
                        موثّق{r.orderCode ? ` · ${r.orderCode}` : ""}
                      </Link>
                    ) : null}
                    {!r.isApproved ? <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[10.5px] font-black text-warn">بانتظار اعتمادك</span> : null}
                    <span className="text-[11.5px] text-ink-3">{timeAgo(r.createdAt)}</span>
                  </p>
                  {r.body ? <p className="mt-2 whitespace-pre-line text-[13px] leading-7 text-ink-2">{r.body}</p> : <p className="mt-2 text-[12px] text-ink-3">بلا تعليق.</p>}
                  {r.imageUrls.filter(isHostedImage).length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.imageUrls.filter(isHostedImage).map((u) => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="relative size-20 overflow-hidden rounded-lg border border-edge/10" aria-label="صورة من العميل">
                          <Image src={u} alt="" fill sizes="80px" className="object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <Link href={`/dashboard/products/${r.productId}`} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-edge/[0.04] py-1 pe-2.5 ps-1 text-[12px] font-bold text-ink-2 hover:text-nova-2">
                    <span className="relative size-7 shrink-0 overflow-hidden rounded-md bg-edge/[0.06]">
                      {r.productImage && isHostedImage(r.productImage) ? <Image src={r.productImage} alt="" fill sizes="28px" className="object-cover" /> : null}
                    </span>
                    <span className="truncate">{r.productName ?? "منتج محذوف"}</span>
                  </Link>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-edge/[0.06] pt-3">
                {r.isApproved ? (
                  <button type="button" onClick={() => approve([r.id], false)} disabled={busy === r.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5 disabled:opacity-50">
                    <EyeOff className="size-4" aria-hidden="true" />
                    أخفِ من المتجر
                  </button>
                ) : (
                  <button type="button" onClick={() => approve([r.id], true)} disabled={busy === r.id} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-nova px-3.5 text-[12px] font-black text-white disabled:opacity-50">
                    <Check className="size-4" aria-hidden="true" />
                    اعتمد ليظهر
                  </button>
                )}
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-ok/25 px-3 text-[12px] font-bold text-ok hover:bg-ok/10">
                    <MessageCircle className="size-4" aria-hidden="true" />
                    {r.rating <= 3 ? "تواصل لحل المشكلة" : "اشكره"}
                  </a>
                ) : null}
                <button type="button" onClick={() => remove(r)} disabled={busy === r.id} aria-label="حذف التقييم" title="حذف" className="ms-auto grid size-10 place-items-center rounded-xl border border-bad/20 text-bad hover:bg-bad/10 disabled:opacity-50">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
