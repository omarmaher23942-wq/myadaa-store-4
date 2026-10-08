"use client";

// معالج الإعداد الأول: ثلاث محطات واضحة، كل واحدة تعرض الخطوة التالية فقط، ويعمل كاملاً من الموبايل.
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Database,
  Sparkles,
  Loader2,
  Check,
  Copy,
  ChevronDown,
  KeyRound,
  ShieldCheck,
  CloudUpload,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  PartyPopper,
} from "lucide-react";
import type { SetupStatus } from "@/server/setup/status";
import type { ImportProgress } from "@/server/setup/importer";
import { statusAction, prepareDatabaseAction, beginImportAction, importStepAction, cancelImportAction } from "./actions";

type Props = { storeName: string; platform: string; initial: SetupStatus; initialProgress: ImportProgress | null };

const STEPS = [
  { key: "db", label: "قاعدة البيانات", icon: Database },
  { key: "receive", label: "استلام متجرك", icon: CloudUpload },
  { key: "done", label: "جاهز", icon: PartyPopper },
] as const;

function stepIndex(s: SetupStatus, finished: boolean) {
  if (finished || s.phase === "done") return 2;
  if (s.phase === "needs_import") return 1;
  return 0;
}

export function SetupWizard({ storeName, platform, initial, initialProgress }: Props) {
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<SetupStatus>(initial);
  const [progress, setProgress] = useState<ImportProgress | null>(initialProgress);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const active = stepIndex(status, finished);

  return (
    <div dir="rtl" className="dash dash-cosmos dark min-h-dvh text-ink">
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 py-8 sm:py-14">
        <header className="mb-8 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-nova via-aurora to-nova-deep text-white shadow-2xl shadow-nova/40">
            <Sparkles className="size-6" />
          </span>
          <h1 className="text-2xl font-black sm:text-3xl">متجر «{storeName}» على حساباتك</h1>
          <p className="mt-2 text-sm leading-7 text-ink-2">خطوات قليلة ويصبح متجرك ولوحة تحكمه ملكك بالكامل، بنفس الشكل والمنتجات والطلبات.</p>
        </header>

        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="خطوات الإعداد">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const state = i < active ? "done" : i === active ? "current" : "next";
            return (
              <li
                key={s.key}
                aria-current={state === "current" ? "step" : undefined}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center text-[11.5px] font-bold transition ${
                  state === "current"
                    ? "border-nova/50 bg-nova/10 text-ink"
                    : state === "done"
                      ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300"
                      : "border-edge/10 text-ink-3"
                }`}
              >
                <span className="grid size-8 place-items-center rounded-full bg-edge/[0.06]">
                  {state === "done" ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>

        <motion.section
            key={finished ? "finished" : status.phase + (progress ? ":p" : "")}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="dash-card p-5 sm:p-7"
          >
            {finished ? (
              <Finished recovery={recovery} />
            ) : status.phase === "no_database" || status.phase === "database_error" ? (
              <ConnectDatabase status={status} onStatus={setStatus} />
            ) : status.phase === "needs_schema" ? (
              <PrepareDatabase onStatus={setStatus} />
            ) : status.phase === "needs_import" && progress ? (
              <Importing
                progress={progress}
                onProgress={setProgress}
                onDone={(code) => {
                  setRecovery(code ?? null);
                  setFinished(true);
                }}
                onCancel={() => setProgress(null)}
              />
            ) : status.phase === "needs_import" ? (
              <ReceiveForm platform={platform} onStarted={setProgress} />
            ) : null}
          </motion.section>

        <p className="mt-6 text-center text-[11.5px] leading-6 text-ink-3">
          بياناتك ومفاتيحك تُحفظ في قاعدتك أنت فقط. لا تحتفظ Colapia بأي مفتاح لحساباتك.
        </p>
      </main>
    </div>
  );
}

// ─── 1) ربط قاعدة البيانات ───────────────────────────────────────────────────

function ConnectDatabase({ status, onStatus }: { status: SetupStatus; onStatus: (s: SetupStatus) => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-5">
      <Title icon={Database} title="اربط قاعدة البيانات المجانية" subtitle="مرة واحدة فقط، ومن الموبايل في دقيقة." />
      {status.phase === "database_error" ? <Alert tone="error">{status.message}</Alert> : null}
      <Steps
        items={[
          <>افتح مشروعك على <b>vercel.com</b> (نفس الحساب الذي نشرت منه المتجر).</>,
          <>من القائمة اختر <b>Storage</b> ثم <b>Create Database</b>.</>,
          <>اختر <b>Neon</b> (Serverless Postgres) ثم <b>Continue</b>، واختر المنطقة <b>Frankfurt (eu-central-1)</b> لأنها الأقرب لمصر.</>,
          <>اختر الخطة <b>Free</b> ثم <b>Create</b>. في نافذة <b>Connect a Project</b> تأكد أن مشروع متجرك هو المختار.</>,
          <>اترك <b>Environments</b> كلها مُعلَّمة، واترك <b>Create database branch</b> بلا علامة، و<b>لا تغيّر Custom Prefix</b> (اتركه STORAGE)، ثم اضغط <b>Connect</b>.</>,
          <>من <b>Deployments</b> افتح آخر نشر واضغط <b>⋯ ثم Redeploy</b>، ثم ارجع لهذه الصفحة.</>,
        ]}
      />
      <PrimaryButton
        pending={pending}
        onClick={() =>
          start(async () => {
            onStatus(await statusAction());
          })
        }
        icon={RefreshCw}
      >
        ربطتها، تحقق الآن
      </PrimaryButton>
    </div>
  );
}

// ─── 2) تجهيز الجداول ────────────────────────────────────────────────────────

function PrepareDatabase({ onStatus }: { onStatus: (s: SetupStatus) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    () =>
      start(async () => {
        setError(null);
        const r = await prepareDatabaseAction();
        if (r.ok) onStatus(r.data);
        else setError(r.error);
      }),
    [onStatus]
  );
  // التجهيز آمن للتكرار، فنبدأه تلقائياً عند فتح الصفحة.
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    run();
  }, [run]);
  return (
    <div className="space-y-5">
      <Title icon={Database} title="قاعدة البيانات مربوطة" subtitle="نجهّز جداول متجرك الآن (ثوانٍ)." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <PrimaryButton pending={pending} onClick={run} icon={ShieldCheck}>
        {pending ? "جارٍ التجهيز..." : "جهّز القاعدة"}
      </PrimaryButton>
    </div>
  );
}

// ─── 3) نموذج الاستلام ───────────────────────────────────────────────────────

function ReceiveForm({ platform, onStarted }: { platform: string; onStarted: (p: ImportProgress) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ut, setUt] = useState("");

  useEffect(() => {
    // رابط "افتح صفحة الإعداد" من لوحة Colapia يحمل الكود بعد # فلا يصل لأي سجل خادم.
    const m = window.location.hash.match(/code=([A-Za-z0-9_-]+)/);
    if (m?.[1]) {
      setCode(m[1]);
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await beginImportAction({ code, email, password, confirm, uploadthingToken: ut });
          if (r.ok) onStarted(r.data);
          else setError(r.error);
        });
      }}
    >
      <Title icon={CloudUpload} title="استلم متجرك" subtitle="منتجاتك وطلباتك وعملاؤك وتصميمك ينتقلون كما هم." />

      <Field label="كود الاستلام" hint={<>من لوحة Colapia: «امتلك متجرك» ← «كود الاستلام». ينتهي خلال 7 أيام.</>}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          placeholder="clp_..."
          className={inputCls}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="بريدك (للدخول للوحة التحكم)">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" autoComplete="email" className={inputCls} required />
        </Field>
        <Field label="كلمة مرور قوية">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} className={inputCls} required />
        </Field>
      </div>
      <Field label="أكّد كلمة المرور">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputCls} required />
      </Field>

      <Field
        label="مفتاح UploadThing (لصور متجرك)"
        hint="مجاني. ننقل إليه كل صور متجرك، وكل صورة ترفعها بعد ذلك تذهب لحسابك."
      >
        <textarea value={ut} onChange={(e) => setUt(e.target.value)} dir="ltr" rows={2} spellCheck={false} placeholder="UPLOADTHING_TOKEN" className={`${inputCls} resize-none font-mono text-[12px]`} required />
      </Field>
      <Guide
        title="إزاي أجيب مفتاح UploadThing من الموبايل؟"
        steps={[
          <>افتح <b>uploadthing.com</b> واضغط <b>Get started</b>، وادخل بحساب GitHub نفسه.</>,
          <>اضغط <b>Create a new app</b>، اكتب اسم متجرك، واختر المنطقة الأقرب.</>,
          <>من قائمة التطبيق افتح <b>API Keys</b>.</>,
          <>في خانة <b>UPLOADTHING_TOKEN</b> اضغط زر النسخ، ثم الصقه هنا.</>,
        ]}
        link={{ href: "https://uploadthing.com/dashboard", label: "افتح UploadThing" }}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      <PrimaryButton pending={pending} type="submit" icon={ArrowLeft}>
        {pending ? "نتحقق من الكود والمفتاح..." : "ابدأ الاستلام"}
      </PrimaryButton>
      <p className="text-center text-[11.5px] text-ink-3">
        الكود من <span dir="ltr">{platform.replace(/^https?:\/\//, "")}</span>
      </p>
    </form>
  );
}

// ─── 4) التقدم ────────────────────────────────────────────────────────────────

function Importing({
  progress,
  onProgress,
  onDone,
  onCancel,
}: {
  progress: ImportProgress;
  onProgress: (p: ImportProgress) => void;
  onDone: (recoveryCode?: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const fails = useRef(0);

  useEffect(() => {
    if (paused) return;
    let alive = true;
    (async () => {
      while (alive) {
        const r = await importStepAction();
        if (!alive) return;
        if (!r.ok) {
          fails.current++;
          setError(r.error);
          if (fails.current >= 4) {
            setPaused(true);
            return;
          }
          await new Promise((res) => setTimeout(res, 2500));
          continue;
        }
        fails.current = 0;
        setError(null);
        onProgress(r.data.progress);
        if (r.data.progress.phase === "done") {
          onDone(r.data.recoveryCode);
          return;
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [paused, onProgress, onDone]);

  const totalRows = progress.tables.reduce((a, t) => a + t.total, 0);
  const doneRows = progress.tables.reduce((a, t) => a + t.done, 0);
  const pct = Math.round(
    ((progress.media.total ? progress.media.done / progress.media.total : 1) * 0.35 + (totalRows ? doneRows / totalRows : 1) * 0.65) * 100
  );
  const label =
    progress.phase === "media"
      ? `ننقل الصور إلى حسابك (${progress.media.done} من ${progress.media.total})`
      : progress.phase === "rows"
        ? "ننقل منتجاتك وطلباتك وعملاءك"
        : progress.phase === "verify"
          ? "نطابق الأعداد للتأكد أن لا شيء ناقص"
          : "نؤكد الاستلام مع المنصة";

  return (
    <div className="space-y-5" aria-live="polite">
      <Title icon={CloudUpload} title="نستلم متجرك الآن" subtitle="اترك الصفحة مفتوحة. لو انقطع الاتصال نكمل من حيث توقفنا." />
      <div>
        <div className="mb-2 flex items-center justify-between text-[12.5px] font-bold">
          <span className="flex items-center gap-2 text-ink-2">
            {paused ? null : <Loader2 className="size-3.5 animate-spin" />} {label}
          </span>
          <span className="tabular-nums text-ink">{Math.min(99, pct)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-edge/[0.07]">
          <motion.div className="h-full rounded-full bg-gradient-to-l from-nova to-aurora" animate={{ width: `${Math.min(99, pct)}%` }} transition={{ duration: 0.4 }} />
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-2 text-[12px]">
        {progress.tables.slice(0, 10).map((t) => (
          <li key={t.name} className="flex items-center justify-between rounded-xl border border-edge/[0.07] px-3 py-2">
            <span className="text-ink-2">{t.label}</span>
            <span className={`tabular-nums font-bold ${t.done >= t.total ? "text-emerald-300" : "text-ink-3"}`}>
              {t.done >= t.total ? <Check className="inline size-3.5" /> : `${t.done}/${t.total}`}
            </span>
          </li>
        ))}
      </ul>
      {error ? <Alert tone={paused ? "error" : "info"}>{error}</Alert> : null}
      {paused ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <PrimaryButton
            onClick={() => {
              fails.current = 0;
              setPaused(false);
            }}
            icon={RefreshCw}
          >
            أكمل الاستلام
          </PrimaryButton>
          <button
            type="button"
            onClick={async () => {
              await cancelImportAction();
              onCancel();
            }}
            className="h-12 rounded-2xl border border-edge/10 text-sm font-bold text-ink-2 hover:bg-edge/[0.04]"
          >
            ابدأ بكود جديد
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── 5) انتهى ─────────────────────────────────────────────────────────────────

function Finished({ recovery }: { recovery: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30">
        <Check className="size-8" strokeWidth={3} />
      </span>
      <div>
        <h2 className="text-xl font-black">متجرك الآن ملكك بالكامل</h2>
        <p className="mt-2 text-[13px] leading-7 text-ink-2">كل شيء انتقل لحساباتك، ورابط متجرك القديم على Colapia يحوّل الزوار لهنا تلقائياً.</p>
      </div>
      {recovery ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-start">
          <p className="flex items-center gap-2 text-[13px] font-black text-amber-200">
            <KeyRound className="size-4" /> احفظ كود الاسترجاع الآن
          </p>
          <p className="mt-1 text-[12px] leading-6 text-ink-2">لو نسيت كلمة المرور، هذا الكود وحده يعيد تعيينها. لن يظهر مرة أخرى.</p>
          <div className="mt-3 flex items-center gap-2">
            <code dir="ltr" className="flex-1 rounded-xl bg-edge/[0.06] px-3 py-2.5 text-center font-mono text-[14px] font-bold tracking-wider text-ink">
              {recovery}
            </code>
            <button
              type="button"
              aria-label="نسخ كود الاسترجاع"
              onClick={() => {
                navigator.clipboard.writeText(recovery).catch(() => {});
                setCopied(true);
              }}
              className="grid size-11 place-items-center rounded-xl border border-edge/10 text-ink-2 hover:bg-edge/[0.05]"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
      ) : null}
      <a href="/dashboard" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep text-sm font-black text-white shadow-lg shadow-nova/30">
        ادخل لوحة التحكم <ArrowLeft className="size-4" />
      </a>
      <a href="/" className="block text-[12.5px] font-bold text-ink-2 underline-offset-4 hover:underline">
        شاهد متجرك
      </a>
    </div>
  );
}

// ─── عناصر مشتركة ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 py-3 text-[14px] text-ink outline-none transition placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/20";

function Title({ icon: Icon, title, subtitle }: { icon: typeof Database; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nova/15 text-nova">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-lg font-black">{title}</h2>
        <p className="text-[12.5px] leading-6 text-ink-2">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12.5px] font-bold text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-[11.5px] leading-5 text-ink-3">{hint}</span> : null}
    </label>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[13px] leading-7 text-ink-2">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-nova/15 text-[11px] font-black text-nova">{i + 1}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

function Guide({ title, steps, link }: { title: string; steps: React.ReactNode[]; link?: { href: string; label: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-edge/[0.08] bg-edge/[0.02]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-[12.5px] font-bold text-ink-2">
        {title}
        <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-edge/[0.06] px-4 py-4">
          <Steps items={steps} />
          {link ? (
            <a href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-nova">
              {link.label} <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Alert({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl px-3.5 py-2.5 text-[12.5px] leading-6 ${tone === "error" ? "bg-rose-400/10 text-rose-300" : "bg-sky-400/10 text-sky-200"}`}
    >
      {children}
    </p>
  );
}

function PrimaryButton({
  children,
  pending,
  onClick,
  type = "button",
  icon: Icon,
}: {
  children: React.ReactNode;
  pending?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  icon?: typeof Database;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep text-sm font-black text-white shadow-lg shadow-nova/30 transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}
