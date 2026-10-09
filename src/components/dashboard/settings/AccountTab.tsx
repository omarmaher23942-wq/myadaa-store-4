"use client";

// AccountTab — حسابك: الاسم والموبايل، والصورة الشخصية (رفع حقيقي، أو صورة Google في المنصة)، وكلمة المرور (في نسخة
// التاجر حيث الدخول بالبريد وكلمة المرور)، والخروج، وحذف متجر التجربة نهائياً (في المنصة، قبل الدفع).
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, LogOut, Save, Sparkle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EDITION, OWNER_LOGIN } from "@/lib/edition";
import { isHostedImage } from "@/lib/media-hosts";
import { updateMerchantProfileAction, applyGoogleAvatarAction, merchantLogoutAction, type ActionResult } from "@/server/actions/auth";
import { changePasswordAction, deleteStoreAction, setAvatarAction } from "@/server/actions/account";
import { useImageUpload } from "@/editor/useImageUpload";
import { Field, Section, inputCls } from "../product/parts";
import { DashDialog } from "../ui/DashDialog";
import type { StoreInfo } from "./SettingsPage";

export type AccountInfo = { displayName: string; email: string | null; phone: string | null; avatarUrl: string | null };

const DELETABLE = ["review", "trial", "frozen"];

export function AccountTab({ account, store }: { account: AccountInfo; store: StoreInfo | null }) {
  return (
    <div className="space-y-5">
      <ProfileCard account={account} />
      {OWNER_LOGIN === "password" ? <PasswordCard /> : null}
      <Section title="الخروج" hint="ينهي جلستك على هذا الجهاز">
        <form action={merchantLogoutAction}>
          <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3.5 text-[12.5px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink">
            <LogOut className="size-4" aria-hidden="true" />
            سجّل الخروج
          </button>
        </form>
      </Section>
      {EDITION === "platform" && store ? <DeleteStoreCard store={store} /> : null}
    </div>
  );
}

function ProfileCard({ account }: { account: AccountInfo }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_p, fd) => updateMerchantProfileAction(fd), null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("حُفظت بيانات حسابك");
      router.refresh();
    } else toast.error(state.error);
  }, [state, router]);
  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Section title="بياناتك" hint="تظهر لك في اللوحة">
      <Avatar account={account} />
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="اسمك" error={err("displayName")}>
            {(a) => <input {...a} name="displayName" defaultValue={account.displayName} required minLength={2} maxLength={80} dir="auto" className={inputCls} />}
          </Field>
        </div>
        <Field label="موبايلك" optional hint="للتواصل معك بخصوص حسابك" error={err("phone")}>
          {(a) => <input {...a} name="phone" type="tel" inputMode="tel" dir="ltr" defaultValue={account.phone ?? ""} placeholder="01xxxxxxxxx" className={cn(inputCls, "font-mono")} />}
        </Field>
        <Field label="البريد" hint={OWNER_LOGIN === "google" ? "بريد حساب Google الذي تدخل به" : "البريد الذي تدخل به للوحة"}>
          {(a) => <input {...a} value={account.email ?? ""} readOnly dir="ltr" className={cn(inputCls, "cursor-default font-mono opacity-70")} />}
        </Field>
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            احفظ بياناتك
          </button>
        </div>
      </form>
    </Section>
  );
}

function Avatar({ account }: { account: AccountInfo }) {
  const router = useRouter();
  const { upload, busy } = useImageUpload();
  const [url, setUrl] = useState(account.avatarUrl);
  const [working, setWorking] = useState(false);
  const initial = account.displayName.trim().charAt(0) || "؟";

  const apply = async (next: string | null) => {
    setWorking(true);
    const r = await setAvatarAction(next).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    setWorking(false);
    if (!r.ok) return void toast.error(r.error);
    setUrl(next);
    toast.success(next ? "تغيّرت صورتك" : "حُذفت صورتك");
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {url && (isHostedImage(url) || /googleusercontent\.com/.test(url)) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-16 rounded-full border border-edge/15 object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-nova to-aurora text-xl font-black text-white">{initial}</span>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={cn("inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink", (busy || working) && "pointer-events-none opacity-60")}>
          {busy || working ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
          {url ? "غيّر الصورة" : "ارفع صورة"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              const [u] = await upload(files, 1);
              if (u) await apply(u);
            }}
          />
        </label>
        {OWNER_LOGIN === "google" ? (
          <button
            type="button"
            disabled={working}
            onClick={async () => {
              const r = await applyGoogleAvatarAction().catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
              if (!r.ok) return void toast.error(r.error ?? "تعذر التنفيذ");
              setUrl(null);
              toast.success("تظهر صورة حساب Google من دخولك القادم");
              router.refresh();
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/[0.05] hover:text-ink"
          >
            <Sparkle className="size-4" aria-hidden="true" />
            صورة Google
          </button>
        ) : null}
        {url ? (
          <button type="button" disabled={working} onClick={() => apply(null)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-bad/20 px-3 text-[12px] font-bold text-bad hover:bg-bad/10">
            <Trash2 className="size-4" aria-hidden="true" />
            احذفها
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = again.length > 0 && again !== next;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return void setError("كلمة المرور الجديدة 8 أحرف على الأقل");
    if (next !== again) return void setError("كلمتا المرور الجديدتان غير متطابقتين");
    setBusy(true);
    const r = await changePasswordAction({ current, next }).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    setBusy(false);
    if (!r.ok) return void setError(r.error);
    setError(null);
    setCurrent("");
    setNext("");
    setAgain("");
    toast.success("تغيّرت كلمة المرور، وخرجت الأجهزة الأخرى من حسابك");
  };

  return (
    <Section title="كلمة المرور" hint="تغييرها يُخرج حسابك من كل الأجهزة الأخرى">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="كلمة المرور الحالية">
            {(a) => <input {...a} type="password" autoComplete="current-password" dir="ltr" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} required />}
          </Field>
        </div>
        <Field label="الجديدة" hint="8 أحرف على الأقل">
          {(a) => <input {...a} type="password" autoComplete="new-password" dir="ltr" minLength={8} className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} required />}
        </Field>
        <Field label="أعد كتابتها" error={mismatch ? "غير متطابقة" : null}>
          {(a) => <input {...a} type="password" autoComplete="new-password" dir="ltr" className={inputCls} value={again} onChange={(e) => setAgain(e.target.value)} required />}
        </Field>
        {error ? (
          <p role="alert" className="text-[12px] font-bold text-bad sm:col-span-2">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={busy || !current || !next || mismatch} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            غيّر كلمة المرور
          </button>
        </div>
      </form>
    </Section>
  );
}

function DeleteStoreCard({ store }: { store: StoreInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const deletable = DELETABLE.includes(store.status);
  const matches = confirm.trim() === store.name.trim();

  const run = async () => {
    setBusy(true);
    const r = await deleteStoreAction({ confirm: confirm.trim() }).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    setOpen(false);
    toast.success(`حُذف «${store.name}» نهائياً`);
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <section className="dash-card space-y-3 border-bad/25 p-4 sm:p-5">
      <div>
        <h2 className="text-[14px] font-black text-bad">حذف المتجر</h2>
        <p className="mt-1 text-[12px] leading-6 text-ink-2">
          {deletable
            ? "يُغلق المتجر فوراً، وتُمسح منتجاته وطلباته وعملاؤه وصوره وتصميمه من المنصة نهائياً. لا يمكن التراجع."
            : store.status === "active"
              ? "متجرك مدفوع: استلمه من «امتلك متجرك» ليصبح موقعك على حساباتك، وتُحذف بياناته من المنصة فور الاستلام."
              : "لا يمكن حذف المتجر في حالته الحالية."}
        </p>
      </div>
      {deletable ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-bad/30 px-3.5 text-[12.5px] font-bold text-bad hover:bg-bad/10">
          <Trash2 className="size-4" aria-hidden="true" />
          احذف «{store.name}»
        </button>
      ) : null}
      <DashDialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={`حذف «${store.name}» نهائياً؟`}
        description="تُمسح كل بياناته من المنصة ولا يمكن استرجاعها. للتأكيد اكتب اسم المتجر كما هو."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
              إلغاء
            </button>
            <button type="button" onClick={run} disabled={!matches || busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-bad px-4 text-[12.5px] font-black text-white disabled:opacity-40">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              احذف نهائياً
            </button>
          </>
        }
      >
        <Field label="اسم المتجر">
          {(a) => <input {...a} dir="auto" autoComplete="off" className={inputCls} value={confirm} placeholder={store.name} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
      </DashDialog>
    </section>
  );
}
