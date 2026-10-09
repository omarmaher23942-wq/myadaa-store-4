// CountdownOffer — بانر عرض محدود مع عداد تنازلي + كود خصم.
import { Timer, Gift } from "lucide-react";
import { z } from "zod";
import { SectionShell } from "@/components/storefront/SectionShell";
import { Countdown } from "@/components/storefront/Countdown";
import type * as S from "@/blueprint/schema";

export function CountdownOffer({
  s,
}: {
  s: z.infer<typeof S.countdownOfferSection>;
}) {
  return (
    <SectionShell s={s}>
      <div
        className="flex flex-col items-center justify-between gap-6 rounded-3xl border p-8 shadow-xl sm:p-10 md:flex-row"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--card-foreground)",
        }}
        dir="rtl"
      >
        <div className="max-w-md space-y-2 text-center md:text-start">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold"
            style={{
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
              borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
              color: "var(--primary)",
            }}
          >
            <Timer className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            عرض لفترة محدودة
          </span>
          <h3 className="font-black font-heading text-2xl sm:text-3xl">
            {s.title}
          </h3>
          {s.text ? (
            <p className="text-xs leading-relaxed opacity-80 sm:text-sm">
              {s.text}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-3">
          <Countdown endsAt={s.endsAt} />
          {s.couponCode ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 font-mono text-xs font-black"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Gift className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
              كود: {s.couponCode}
            </span>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}