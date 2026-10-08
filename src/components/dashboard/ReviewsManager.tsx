"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Star, Check, X, Trash2, MessageSquare, Loader2 } from "lucide-react";
import {
  toggleReviewApprovalAction,
  deleteReviewAction,
} from "@/server/actions/reviews";
import { cn } from "@/lib/utils";

type R = {
  id: string;
  productName: string;
  customerName: string;
  rating: number;
  body: string | null;
  imageUrls: string[];
  isApproved: boolean;
  isVerified: boolean;
  createdAt: string;
};

const SW = 1.75;

export function ReviewsManager({ rows }: { rows: R[] }) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("pending");
  const [pending, start] = useTransition();

  const filtered = rows.filter((r) => {
    if (filter === "pending") return !r.isApproved;
    if (filter === "approved") return r.isApproved;
    return true;
  });

  const pendingCount = rows.filter((r) => !r.isApproved).length;
  const approvedCount = rows.filter((r) => r.isApproved).length;

  const toggle = (id: string, approved: boolean) => {
    start(async () => {
      const r = await toggleReviewApprovalAction(id, approved);
      if (r.ok) toast.success(approved ? "تم اعتماد التقييم" : "تم إلغاء الاعتماد");
      else toast.error(r.error ?? "فشل");
    });
  };

  const remove = (id: string) => {
    if (!confirm("حذف التقييم نهائياً؟")) return;
    start(async () => {
      const r = await deleteReviewAction(id);
      if (r.ok) toast.success("تم الحذف");
      else toast.error(r.error ?? "فشل");
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "pending" as const, label: "بانتظار الاعتماد", count: pendingCount },
          { key: "approved" as const, label: "معتمد", count: approvedCount },
          { key: "all" as const, label: "الكل", count: rows.length },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition-colors",
              filter === t.key
                ? "bg-nova text-white"
                : "border border-edge/10 bg-edge/[0.02] text-ink-2 hover:bg-edge/[0.04]"
            )}
          >
            {t.label}
            <span className="rounded-full bg-black/20 px-1.5 font-mono text-[10px]">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge/10 p-12 text-center">
          <MessageSquare className="mx-auto size-8 text-ink-3 opacity-40" strokeWidth={SW} />
          <p className="mt-3 text-xs font-bold text-ink-3">
            لا توجد تقييمات في هذه القائمة
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-edge/10 bg-edge/[0.02] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-black text-ink">
                      {r.customerName}
                    </p>
                    {r.isVerified && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9.5px] font-black text-emerald-600 dark:text-emerald-300">
                        موثّق
                      </span>
                    )}
                    {!r.isApproved && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9.5px] font-black text-amber-700 dark:text-amber-300">
                        بانتظار الاعتماد
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-3">
                    على: {r.productName} ·{" "}
                    {new Date(r.createdAt).toLocaleString("ar-EG", {
                      timeZone: "Africa/Cairo",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>

                  <div className="mt-2 flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3.5",
                          i < r.rating ? "text-amber-700 dark:text-amber-400" : "text-ink-3/30"
                        )}
                        fill={i < r.rating ? "currentColor" : "none"}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>

                  {r.body ? (
                    <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
                      {r.body}
                    </p>
                  ) : null}

                  {r.imageUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.imageUrls.map((u, i) => (
                        <div
                          key={i}
                          className="relative size-16 overflow-hidden rounded-lg border border-edge/10"
                        >
                          <Image
                            src={u}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  {!r.isApproved ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggle(r.id, true)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-[11px] font-black text-emerald-600 dark:text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-40"
                    >
                      <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
                      اعتماد
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggle(r.id, false)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 text-[11px] font-black text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-500/25 disabled:opacity-40"
                    >
                      <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
                      إلغاء
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(r.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 text-[11px] font-black text-rose-600 dark:text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-40"
                  >
                    <Trash2 className="size-3" strokeWidth={2.5} aria-hidden="true" />
                    حذف
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}