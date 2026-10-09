"use client";

// «نوفا»: المساعد الذكي في لوحة التاجر. يجيب من بيانات المتجر الحقيقية، ويكتب المحتوى الجاهز.
// يعمل بمفتاح Groq الخاص بالتاجر بعد التفعيل (ai/merchant). يفتح بالضغط على الكوكب أو Ctrl+J.
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Sparkles, X, SendHorizonal, Loader2, KeyRound, RotateCcw, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INTEGRATIONS_NAV } from "@/lib/edition";
import { copilotAction, aiStatusAction } from "@/server/actions/ai-assist";
import type { MerchantAiStatus } from "@/ai/merchant";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = [
  "ملخص مبيعات الأسبوع ده",
  "إيه أكتر 5 منتجات بتتباع؟",
  "فيه منتجات قربت تخلص؟",
  "اكتب بوست إنستجرام لأكتر منتج مبيعاً",
  "إيه آخر تقييمات العملاء؟",
];

const STORAGE_KEY = "clp_copilot_history";

export function Copilot({ storeName }: { storeName: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<MerchantAiStatus | null>(null);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as Msg[];
      if (Array.isArray(saved)) setMsgs(saved.slice(-24));
    } catch {
      /* سجل غير صالح */
    }
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    const openIt = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("clp:open-copilot", openIt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("clp:open-copilot", openIt);
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-24)));
    } catch {
      /* التخزين غير متاح */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [msgs, reduce]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (!status) aiStatusAction().then(setStatus).catch(() => {});
  }, [open, status]);

  function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const next: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    start(async () => {
      const r = await copilotAction(next.map(({ role, content }) => ({ role, content })));
      setMsgs((cur) => [...cur, r.ok ? { role: "assistant", content: r.data } : { role: "assistant", content: r.error, error: true }]);
      aiStatusAction().then(setStatus).catch(() => {});
    });
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "إغلاق المساعد الذكي" : "افتح المساعد الذكي نوفا"}
        aria-expanded={open}
        whileHover={reduce ? undefined : { scale: 1.06 }}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        className="copilot-fab fixed bottom-24 end-4 z-40 grid size-14 place-items-center rounded-full bg-gradient-to-br from-nova via-aurora to-nova-deep text-white shadow-2xl shadow-nova/40 ring-1 ring-white/20 md:bottom-6 md:end-6"
      >
        <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-nova/30 [animation-duration:3s]" />
        {open ? <X className="relative size-6" /> : <Sparkles className="relative size-6" />}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.section
            role="dialog"
            aria-label="المساعد الذكي نوفا"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            style={{ background: "var(--dash-space-2)" }}
            className="dash-card fixed bottom-40 end-4 z-40 flex h-[min(600px,calc(100dvh-12rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden md:bottom-24 md:end-6"
          >
            <header className="flex items-center gap-3 border-b border-edge/[0.07] px-4 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-nova to-aurora text-white shadow-lg shadow-nova/30">
                <Sparkles className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-black text-ink">نوفا · مساعدك الذكي</p>
                <p className="truncate text-[11px] text-ink-3">
                  {status?.mode === "own"
                    ? `يعمل بمفتاحك الخاص · ${storeName}`
                    : status?.mode === "trial"
                      ? `${status.remaining} رسالة متبقية اليوم`
                      : storeName}
                </p>
              </div>
              {msgs.length ? (
                <button
                  type="button"
                  onClick={() => setMsgs([])}
                  aria-label="محادثة جديدة"
                  title="محادثة جديدة"
                  className="grid size-8 place-items-center rounded-lg text-ink-3 transition hover:bg-edge/[0.06] hover:text-ink"
                >
                  <RotateCcw className="size-4" />
                </button>
              ) : null}
            </header>

            {status?.mode === "needs_key" ? (
              <div className="grid flex-1 place-items-center p-6 text-center">
                <div className="space-y-3">
                  <KeyRound className="mx-auto size-9 text-amber-500" strokeWidth={1.6} />
                  <p className="text-sm font-black text-ink">اربط مفتاح Groq لتفعيل نوفا</p>
                  <p className="text-[12.5px] leading-6 text-ink-2">بعد التفعيل يعمل المساعد بمفتاحك الخاص، مجاناً وبلا حدود من المنصة.</p>
                  <Link href={INTEGRATIONS_NAV.href} className="inline-flex h-10 items-center rounded-xl bg-nova px-4 text-xs font-black text-white">
                    اربط المفتاح
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div ref={listRef} className="hide-scrollbar flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                  {!msgs.length ? (
                    <div className="space-y-4 pt-2">
                      <p className="text-[13px] leading-7 text-ink-2">
                        أهلاً! اسألني عن مبيعاتك وطلباتك ومخزونك وتقييمات عملائك، أو اطلب مني أكتب لك منشوراً أو رداً.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => send(q)}
                            className="rounded-full border border-edge/10 bg-edge/[0.03] px-3 py-1.5 text-[12px] font-bold text-ink-2 transition hover:border-nova/40 hover:bg-nova/10 hover:text-ink"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    msgs.map((m, i) => <Bubble key={i} msg={m} />)
                  )}
                  {pending ? (
                    <div className="flex items-center gap-2 text-[12px] text-ink-3">
                      <Loader2 className="size-3.5 animate-spin" /> نوفا تراجع بيانات متجرك...
                    </div>
                  ) : null}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="flex items-end gap-2 border-t border-edge/[0.07] p-3"
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="اسأل نوفا..."
                    className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-edge/10 bg-edge/[0.03] px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/20"
                  />
                  <button
                    type="submit"
                    disabled={pending || !input.trim()}
                    aria-label="إرسال"
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-nova to-nova-deep text-white shadow-lg shadow-nova/30 transition hover:brightness-110 disabled:opacity-40"
                  >
                    <SendHorizonal className="size-4.5 -scale-x-100" />
                  </button>
                </form>
              </>
            )}
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const [copied, setCopied] = useState(false);
  const mine = msg.role === "user";
  return (
    <div className={cn("flex", mine ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "group relative max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-7",
          mine
            ? "rounded-ss-md bg-gradient-to-br from-nova to-nova-deep text-white"
            : msg.error
              ? "rounded-se-md bg-rose-400/10 text-rose-600 dark:text-rose-300"
              : "rounded-se-md bg-edge/[0.05] text-ink"
        )}
      >
        {msg.content}
        {!mine && !msg.error ? (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(msg.content).catch(() => {});
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            aria-label="نسخ الرد"
            className="absolute -bottom-3 start-2 hidden size-7 place-items-center rounded-full border border-edge/10 bg-space-2 text-ink-3 shadow group-hover:grid"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
