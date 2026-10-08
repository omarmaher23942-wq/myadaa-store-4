"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Sparkles, Check, Loader2, ExternalLink, KeyRound, Copy, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveKeyAction, removeKeyAction, newRecoveryCodeAction } from "./actions";

type Provider = "uploadthing" | "groq" | "resend";

const CARDS: {
  id: Provider;
  title: string;
  why: string;
  icon: typeof Sparkles;
  required?: boolean;
  placeholder: string;
  link: string;
  steps: string[];
}[] = [
  {
    id: "uploadthing",
    title: "UploadThing: صور متجرك",
    why: "كل صورة منتج أو شعار ترفعها تُحفظ في حسابك. مجاني حتى 2GB.",
    icon: CloudUpload,
    required: true,
    placeholder: "UPLOADTHING_TOKEN",
    link: "https://uploadthing.com/dashboard",
    steps: ["افتح uploadthing.com وادخل بحساب GitHub.", "افتح تطبيقك (أو Create a new app).", "API Keys ثم انسخ UPLOADTHING_TOKEN والصقه هنا."],
  },
  {
    id: "groq",
    title: "Groq: الذكاء الاصطناعي",
    why: "يشغّل «نوفا» وكاتب وصف المنتجات بلا حدود. مجاني.",
    icon: Sparkles,
    placeholder: "gsk_...",
    link: "https://console.groq.com/keys",
    steps: ["افتح console.groq.com وادخل بحساب Google.", "API Keys ثم Create API Key واكتب أي اسم.", "انسخ المفتاح (يبدأ بـ gsk_) والصقه هنا."],
  },
];

export function IntegrationsCenter({ keys, hasRecovery }: { keys: Record<Provider, string | null>; hasRecovery: boolean }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-black text-ink">الربط والمفاتيح</h1>
        <p className="mt-1 text-[13px] leading-7 text-ink-2">مفاتيح حساباتك تُحفظ في قاعدة بياناتك أنت، وتُختبر قبل الحفظ، ولا تظهر كاملة أبداً.</p>
      </header>
      {CARDS.map((c) => (
        <KeyCard key={c.id} card={c} current={keys[c.id]} />
      ))}
      <RecoveryCard hasRecovery={hasRecovery} />
    </div>
  );
}

function KeyCard({ card, current }: { card: (typeof CARDS)[number]; current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(!current);
  const [pending, start] = useTransition();
  const Icon = card.icon;
  return (
    <section className="dash-card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nova/15 text-nova">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-black text-ink">
            {card.title}
            {card.required ? <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10.5px] text-amber-600 dark:text-amber-300">أساسي</span> : null}
          </h2>
          <p className="text-[12.5px] leading-6 text-ink-2">{card.why}</p>
        </div>
        {current ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
            <Check className="size-3.5" /> مربوط {current}
          </span>
        ) : null}
      </div>
      {open ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveKeyAction({ provider: card.id, key: value });
              if (r.ok) {
                toast.success("تم اختبار المفتاح وحفظه");
                setValue("");
                setOpen(false);
                router.refresh();
              } else toast.error(r.error);
            });
          }}
        >
          <ol className="space-y-1.5 text-[12.5px] leading-6 text-ink-2">
            {card.steps.map((s, i) => (
              <li key={i}>
                <b className="text-nova">{i + 1}.</b> {s}
              </li>
            ))}
          </ol>
          <a href={card.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-nova">
            افتح الموقع <ExternalLink className="size-3.5" />
          </a>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              dir="ltr"
              spellCheck={false}
              placeholder={card.placeholder}
              className="min-w-0 flex-1 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 py-2.5 font-mono text-[12.5px] text-ink outline-none focus:border-nova focus:ring-2 focus:ring-nova/20"
            />
            <button
              disabled={pending || value.trim().length < 8}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-nova px-4 text-[12.5px] font-black text-white disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} اختبر واحفظ
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-edge/10 px-3.5 py-2 text-[12.5px] font-bold text-ink-2 hover:bg-edge/[0.04]">
            استبدل المفتاح
          </button>
          {!card.required ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeKeyAction(card.id);
                  if (r.ok) router.refresh();
                  else toast.error(r.error);
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-rose-500 hover:bg-rose-500/10"
            >
              <Trash2 className="size-3.5" /> إزالة
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function RecoveryCard({ hasRecovery }: { hasRecovery: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="dash-card space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-black text-ink">
        <KeyRound className="size-4 text-amber-500" /> كود استرجاع كلمة المرور
      </h2>
      <p className="text-[12.5px] leading-6 text-ink-2">
        {hasRecovery
          ? "لديك كود استرجاع محفوظ. أنشئ كوداً جديداً إن فقدته (القديم يتوقف فوراً)."
          : "لا يوجد كود استرجاع صالح الآن. أنشئ واحداً واحفظه في مكان آمن."}
      </p>
      {code ? (
        <div className="flex items-center gap-2">
          <code dir="ltr" className="flex-1 rounded-xl bg-edge/[0.06] px-3 py-2.5 text-center font-mono text-[14px] font-bold tracking-wider text-ink">
            {code}
          </code>
          <button
            type="button"
            aria-label="نسخ"
            onClick={() => navigator.clipboard.writeText(code).then(() => toast.success("نُسخ"))}
            className="grid size-11 place-items-center rounded-xl border border-edge/10"
          >
            <Copy className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await newRecoveryCodeAction();
              if (r.ok) setCode(r.data);
              else toast.error(r.error);
            })
          }
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3.5 py-2 text-[12.5px] font-black text-amber-600 dark:text-amber-300"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} أنشئ كوداً جديداً
        </button>
      )}
    </section>
  );
}
