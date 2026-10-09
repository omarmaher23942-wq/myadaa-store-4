"use client";

// AttentionStrip — «يحتاج انتباهك الآن» في أعلى النظرة العامة: نفس بنود الجرس، حية من نبض اللوحة،
// كبطاقات كبيرة سهلة اللمس على الموبايل. لا تظهر إن لم يكن هناك ما ينتظر التاجر.
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardPulse } from "../DashboardPulse";
import { ATTENTION_TONE, attentionItems } from "../attention-items";

export function AttentionStrip() {
  const { counts, ready } = useDashboardPulse();
  if (!ready) return null;
  const items = attentionItems(counts);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="attention-title">
      <h2 id="attention-title" className="mb-2.5 text-[13px] font-black text-ink">
        يحتاج انتباهك الآن
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-3">
        {items.map((it) => (
          <li key={it.key}>
            <Link
              href={it.href}
              className="dash-card group flex h-full min-h-16 flex-col items-start gap-2 p-3 transition hover:border-nova/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova sm:flex-row sm:items-center sm:gap-3 sm:p-3.5"
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl sm:size-10", ATTENTION_TONE[it.tone])}>
                <it.icon className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-black leading-5 text-ink sm:truncate">{it.title}</span>
                <span className="mt-0.5 block text-[12px] font-bold text-ink-2">{it.chip}</span>
              </span>
              <ChevronLeft className="hidden size-4 shrink-0 text-ink-3 transition group-hover:-translate-x-0.5 group-hover:text-ink sm:block" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
