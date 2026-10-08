"use client";

// CheckoutProgress — مؤشر 3 خطوات ذكي:
// - كل خطوة تُعتبر مكتملة بناءً على حالة الحقول الفعلية.
// - Progress bar يتحرك بسلاسة عند الإكمال.
// - يعمل كـ sticky فوق نموذج الدفع.
import { CheckCircle2, Circle, Truck, CreditCard, ClipboardCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const SW = 1.75;

type StepId = "contact" | "payment" | "confirm";

type Step = {
  id: StepId;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const STEPS: Step[] = [
  { id: "contact", label: "بيانات التوصيل", icon: Truck },
  { id: "payment", label: "طريقة الدفع", icon: CreditCard },
  { id: "confirm", label: "المراجعة والتأكيد", icon: ClipboardCheck },
];

export function CheckoutProgress({
  completed,
  current,
}: {
  completed: Record<StepId, boolean>;
  current: StepId;
}) {
  const reduce = useReducedMotion();
  const completedCount = STEPS.filter((s) => completed[s.id]).length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div
      className="sticky top-16 z-20 -mx-4 border-b px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6"
      style={{
        background: "color-mix(in srgb, var(--background) 88%, transparent)",
        borderColor: "var(--border)",
      }}
      dir="rtl"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-2">
          <ol className="flex flex-1 items-center gap-2">
            {STEPS.map((step, i) => {
              const done = completed[step.id];
              const isCurrent = step.id === current;
              const Icon = step.icon;
              return (
                <li key={step.id} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-2 transition-colors",
                      done
                        ? "text-emerald-600"
                        : isCurrent
                          ? "text-[var(--primary)]"
                          : "text-[var(--foreground)]/50"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full border-2",
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : isCurrent
                            ? "border-[var(--primary)]"
                            : "border-[var(--border)]"
                      )}
                    >
                      {done ? (
                        <CheckCircle2
                          className="size-4"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                      ) : (
                        <Icon
                          className="size-3.5"
                          strokeWidth={SW}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        "hidden text-[11.5px] font-bold sm:inline",
                        done && "line-through opacity-70"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 ? (
                    <div
                      className={cn(
                        "h-0.5 flex-1 rounded-full transition-colors",
                        done ? "bg-emerald-500" : "bg-[var(--border)]"
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
          <span
            className="hidden shrink-0 font-mono text-xs font-black tabular-nums sm:inline"
            style={{ color: "var(--primary)" }}
          >
            {pct}%
          </span>
        </div>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--muted)]">
          <motion.div
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
          />
        </div>
      </div>
    </div>
  );
}

export function useCheckoutProgress(fields: {
  name: string;
  phone: string;
  governorate: string;
  address: string;
  paymentMethod: "cod" | "vodafone_cash" | "instapay";
  transferScreenshotUrl: string;
  requireTransferProof: boolean;
}): { completed: Record<StepId, boolean>; current: StepId } {
  const contactDone = Boolean(
    fields.name.trim().length >= 2 &&
      /^01[0125]\d{8}$/.test(fields.phone.replace(/\D/g, "")) &&
      fields.governorate &&
      fields.address.trim().length >= 5
  );

  const paymentDone =
    fields.paymentMethod === "cod" ||
    (fields.requireTransferProof
      ? Boolean(fields.transferScreenshotUrl)
      : true);

  const confirmDone = contactDone && paymentDone;

  return {
    completed: {
      contact: contactDone,
      payment: paymentDone,
      confirm: confirmDone,
    },
    current: !contactDone ? "contact" : !paymentDone ? "payment" : "confirm",
  };
}