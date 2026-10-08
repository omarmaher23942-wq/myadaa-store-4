"use client";

// SettingsForm — إعادة اختراع كاملة لصفحة الإعدادات.
// البنية:
//  - 5 تبويبات: الحساب / المتجر / الدفع / التواصل / منطقة الخطر.
//  - View Transitions API للتنقل بين التبويبات (مع fallback بسيط).
//  - معاينة حية (LivePreview) على الشاشات الكبيرة تعرض ملخص المتجر.
//  - Sticky Save Bar أسفل الشاشة يظهر عند dirty state + Cmd/Ctrl+S.
//  - Confirmation Modal قبل الحفظ مع diff summary.
//  - Auto-save بعد 30 ثانية من آخر تعديل (best-effort).
//  - useOptimistic للتبديلات السريعة (vacation mode, showcase).
//  - AvatarUploader: رفع/حذف/استخدام صورة Google.
//  - Zod validation على السيرفر + عرض أخطاء عربية من ActionResult.
//  - Full ARIA + prefers-reduced-motion + zero emoji.
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import {
  User as UserIcon,
  Store as StoreIcon,
  CreditCard,
  MessageCircle,
  AlertTriangle,
  QrCode,
  Copy,
  Download,
  Printer,
  Share2,
  Moon,
  Save,
  Loader2,
  Check,
  X,
  Phone,
  Wallet,
  Instagram,
  Eye,
  LogOut,
  Trash2,
  Image as ImageIcon,
  Upload,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sparkle,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { cn, storeHost } from "@/lib/utils";
import type { StoreBlueprint } from "@/blueprint/schema";
import {
  saveBlueprintAction,
  setStoreOpsAction,
} from "@/server/actions/blueprint";
import {
  updateMerchantProfileAction,
  merchantLogoutAction,
  removeAvatarAction,
  applyGoogleAvatarAction,
  type ActionResult,
} from "@/server/actions/auth";

// ── Constants
const TABS = [
  { key: "account", label: "الحساب", icon: UserIcon },
  { key: "store", label: "المتجر", icon: StoreIcon },
  { key: "payments", label: "الدفع", icon: CreditCard },
  { key: "contact", label: "التواصل", icon: MessageCircle },
  { key: "danger", label: "منطقة الخطر", icon: AlertTriangle },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const I =
  "w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 py-2.5 text-xs font-bold text-ink outline-none transition-colors focus:border-nova/60 focus:ring-2 focus:ring-nova/20 disabled:opacity-60";

const I_ERR =
  "w-full rounded-xl border border-rose-500/40 bg-rose-500/[0.04] px-3.5 py-2.5 text-xs font-bold text-white outline-none transition-colors focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20";

// ── Types
type Merchant = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActivated: boolean;
};

type StoreOps = {
  acceptingOrders: boolean;
  vacationMessage: string;
  showcaseOptIn: boolean;
};

export type SettingsFormProps = {
  merchant: Merchant;
  store:
    | {
        id: string;
        name: string;
        subdomain: string;
        status: string;
        acceptingOrders: boolean;
        vacationMessage: string | null;
        showcaseOptIn: boolean;
      }
    | null;
  bp: StoreBlueprint | null;
  url: string;
  qr: string;
};

export function SettingsForm({
  merchant,
  store,
  bp: initialBp,
  url,
  qr,
}: SettingsFormProps) {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<TabKey>("account");
  const [bp, setBp] = useState<StoreBlueprint | null>(initialBp);
  const [ops, setOps] = useState<StoreOps>({
    acceptingOrders: store?.acceptingOrders ?? true,
    vacationMessage: store?.vacationMessage ?? "",
    showcaseOptIn: store?.showcaseOptIn ?? false,
  });

  // Baseline للحفظ لإظهار dirty state.
  const [baseline] = useState(() => ({
    bp: initialBp,
    ops: {
      acceptingOrders: store?.acceptingOrders ?? true,
      vacationMessage: store?.vacationMessage ?? "",
      showcaseOptIn: store?.showcaseOptIn ?? false,
    },
  }));

  const [pendingSave, startSave] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // dirty = أي تغيير على bp أو ops عن الـ baseline.
  const dirty = useMemo(() => {
    if (JSON.stringify(bp) !== JSON.stringify(baseline.bp)) return true;
    if (JSON.stringify(ops) !== JSON.stringify(baseline.ops)) return true;
    return false;
  }, [bp, ops, baseline]);

  // diff summary — ما الذي تغيّر بالضبط؟ يُعرض في confirmation modal.
  const diff = useMemo(() => {
    const items: { label: string; from: string; to: string }[] = [];
    const b = baseline.ops;
    if (b.acceptingOrders !== ops.acceptingOrders) {
      items.push({
        label: "استقبال الطلبات",
        from: b.acceptingOrders ? "مفتوح" : "موقوف",
        to: ops.acceptingOrders ? "مفتوح" : "موقوف",
      });
    }
    if (b.vacationMessage !== ops.vacationMessage) {
      items.push({
        label: "رسالة الإجازة",
        from: b.vacationMessage || "—",
        to: ops.vacationMessage || "—",
      });
    }
    if (b.showcaseOptIn !== ops.showcaseOptIn) {
      items.push({
        label: "معرض Colapia",
        from: b.showcaseOptIn ? "مفعّل" : "معطّل",
        to: ops.showcaseOptIn ? "مفعّل" : "معطّل",
      });
    }
    if (baseline.bp && bp) {
      if (baseline.bp.payments.cod.enabled !== bp.payments.cod.enabled) {
        items.push({
          label: "COD",
          from: baseline.bp.payments.cod.enabled ? "مفعّل" : "معطّل",
          to: bp.payments.cod.enabled ? "مفعّل" : "معطّل",
        });
      }
      if (
        baseline.bp.payments.vodafoneCash.enabled !==
        bp.payments.vodafoneCash.enabled
      ) {
        items.push({
          label: "فودافون كاش",
          from: baseline.bp.payments.vodafoneCash.enabled ? "مفعّل" : "معطّل",
          to: bp.payments.vodafoneCash.enabled ? "مفعّل" : "معطّل",
        });
      }
      if (baseline.bp.payments.instapay.enabled !== bp.payments.instapay.enabled) {
        items.push({
          label: "إنستاباي",
          from: baseline.bp.payments.instapay.enabled ? "مفعّل" : "معطّل",
          to: bp.payments.instapay.enabled ? "مفعّل" : "معطّل",
        });
      }
      if (
        (baseline.bp.channels.whatsappNumber ?? "") !==
        (bp.channels.whatsappNumber ?? "")
      ) {
        items.push({
          label: "واتساب",
          from: baseline.bp.channels.whatsappNumber || "—",
          to: bp.channels.whatsappNumber || "—",
        });
      }
      if ((baseline.bp.channels.phone ?? "") !== (bp.channels.phone ?? "")) {
        items.push({
          label: "هاتف المتجر",
          from: baseline.bp.channels.phone || "—",
          to: bp.channels.phone || "—",
        });
      }
      if (
        (baseline.bp.channels.instagramUsername ?? "") !==
        (bp.channels.instagramUsername ?? "")
      ) {
        items.push({
          label: "إنستاجرام",
          from: baseline.bp.channels.instagramUsername || "—",
          to: bp.channels.instagramUsername || "—",
        });
      }
    }
    return items;
  }, [bp, ops, baseline]);

  // ── تبديل التبويب مع View Transitions
  const switchTab = useCallback(
    (next: TabKey) => {
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => unknown;
      };
      if (reduce || typeof doc.startViewTransition !== "function") {
        setTab(next);
        return;
      }
      doc.startViewTransition(() => setTab(next));
    },
    [reduce]
  );

  // ── حفظ الإعدادات (bp + ops) بشكل متزامن.
  const commitSave = useCallback(async () => {
    if (!bp) return;
    const [a] = await Promise.all([
      saveBlueprintAction(bp, "تحديث إعدادات المتجر"),
      setStoreOpsAction(ops),
    ]);
    if (a && "error" in a && a.error) {
      toast.error(a.error);
      throw new Error(a.error);
    }
    toast.success("تم حفظ إعدادات المتجر");
  }, [bp, ops]);

  const onSaveClick = useCallback(() => {
    if (pendingSave || !dirty) return;
    // لو الفرق بسيط (تبديل واحد)، احفظ مباشرة بدون modal.
    if (diff.length <= 1) {
      startSave(() => {
        commitSave().catch(() => {});
      });
      return;
    }
    setConfirmOpen(true);
  }, [pendingSave, dirty, diff.length, commitSave]);

  const onConfirmSave = useCallback(() => {
    setConfirmOpen(false);
    startSave(() => {
      commitSave().catch(() => {});
    });
  }, [commitSave]);

  // ── Keyboard shortcut: Cmd/Ctrl+S لحفظ فوري.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSaveClick();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSaveClick]);

  // ── Auto-save: بعد 30 ثانية من آخر تعديل (best-effort).
  const lastEditRef = useRef<number>(0);
  useEffect(() => {
    if (!dirty) return;
    lastEditRef.current = Date.now();
    const t = window.setTimeout(() => {
      const since = Date.now() - lastEditRef.current;
      // فقط لو مرت 30 ثانية كاملة دون تعديل جديد.
      if (since >= 29_000 && !pendingSave) {
        startSave(() => {
          commitSave().catch(() => {});
        });
      }
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [dirty, bp, ops, pendingSave, commitSave]);

  // ── Warn on unload if dirty.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const storeDisplayName = store?.name ?? "متجرك";

  return (
    <div className="mx-auto max-w-6xl" dir="rtl">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* تبويبات */}
          <nav
            aria-label="أقسام الإعدادات"
            className="flex gap-1 overflow-x-auto rounded-2xl border border-edge/10 bg-edge/[0.02] p-1.5"
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              const isDanger = t.key === "danger";
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchTab(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50",
                    active
                      ? isDanger
                        ? "bg-rose-500/90 text-white shadow"
                        : "bg-nova text-white shadow"
                      : isDanger
                        ? "text-rose-600 dark:text-rose-200/80 hover:bg-rose-500/10"
                        : "text-ink-2 hover:bg-edge/[0.04]"
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* المحتوى */}
          <AnimatePresence mode="wait" initial={false}>
            {tab === "account" ? (
              <TabPanel key="account">
                <AccountTab merchant={merchant} />
              </TabPanel>
            ) : null}

            {tab === "store" && bp && store ? (
              <TabPanel key="store">
                <StoreTab
                  bp={bp}
                  onBpChange={setBp}
                  ops={ops}
                  onOpsChange={setOps}
                  qr={qr}
                  url={url}
                  storeName={storeDisplayName}
                  subdomain={store.subdomain}
                />
              </TabPanel>
            ) : null}

            {tab === "payments" && bp ? (
              <TabPanel key="payments">
                <PaymentsTab bp={bp} onBpChange={setBp} />
              </TabPanel>
            ) : null}

            {tab === "contact" && bp ? (
              <TabPanel key="contact">
                <ContactTab bp={bp} onBpChange={setBp} />
              </TabPanel>
            ) : null}

            {tab === "danger" ? (
              <TabPanel key="danger">
                <DangerTab />
              </TabPanel>
            ) : null}
          </AnimatePresence>

          {!store || !bp ? (
            <div className="rounded-3xl border border-dashed border-edge/15 bg-edge/[0.01] p-8 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-nova/10 text-nova-2">
                <StoreIcon className="size-6" />
              </div>
              <h2 className="mt-4 text-base font-black text-ink">
                لا يوجد متجر بعد
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-xs text-ink-3">
                ابدأ ببناء متجرك وستظهر هنا إعدادات الدفع والشحن والربط.
              </p>
            </div>
          ) : null}
        </div>

        {/* Live Preview */}
        {store && bp ? (
          <aside className="hidden lg:block" aria-label="معاينة حية">
            <LivePreview
              storeName={storeDisplayName}
              subdomain={store.subdomain}
              bp={bp}
              ops={ops}
            />
          </aside>
        ) : null}
      </div>

      {/* Sticky Save Bar */}
      <StickySaveBar
        visible={dirty && Boolean(store && bp)}
        pending={pendingSave}
        onSave={onSaveClick}
        onDiscard={() => {
          setBp(baseline.bp);
          setOps(baseline.ops);
          toast.info("تم التراجع عن التغييرات");
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirmOpen}
        items={diff}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onConfirmSave}
      />
    </div>
  );
}

// ── Tab Panel wrapper مع motion
function TabPanel({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -6 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── ACCOUNT TAB
function AccountTab({ merchant }: { merchant: Merchant }) {
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(
    async (_prev, fd) => updateMerchantProfileAction(fd),
    null
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("تم حفظ بيانات حسابك");
    else if (state.error) toast.error(state.error);
  }, [state]);

  const fieldErr = (name: string) => state?.fieldErrors?.[name];

  return (
    <section className="space-y-6 rounded-3xl border border-edge/10 bg-edge/[0.02] p-6 sm:p-8">
      <header className="flex items-center gap-3 border-b border-edge/10 pb-5">
        <span className="grid size-10 place-items-center rounded-2xl bg-nova/15 text-nova-2">
          <UserIcon className="size-4" strokeWidth={2.25} />
        </span>
        <div>
          <h2 className="text-base font-black text-ink">بيانات الحساب</h2>
          <p className="mt-0.5 text-[11px] text-ink-3">
            اسمك، موبايلك، وصورتك الشخصية
          </p>
        </div>
      </header>

      <AvatarUploader merchant={merchant} />

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="displayName"
              className="mb-1.5 block text-xs font-bold text-ink-2"
            >
              الاسم المعروض
            </label>
            <input
              id="displayName"
              name="displayName"
              defaultValue={merchant.displayName}
              required
              maxLength={80}
              aria-invalid={Boolean(fieldErr("displayName"))}
              className={fieldErr("displayName") ? I_ERR : I}
            />
            {fieldErr("displayName") ? (
              <FieldError>{fieldErr("displayName")}</FieldError>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-xs font-bold text-ink-2"
            >
              رقم الموبايل
            </label>
            <input
              id="phone"
              name="phone"
              defaultValue={merchant.phone ?? ""}
              placeholder="01xxxxxxxxx"
              dir="ltr"
              inputMode="numeric"
              pattern="^01[0125]\d{8}$"
              aria-invalid={Boolean(fieldErr("phone"))}
              className={cn(fieldErr("phone") ? I_ERR : I, "font-mono")}
            />
            {fieldErr("phone") ? (
              <FieldError>{fieldErr("phone")}</FieldError>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="email-readonly"
              className="mb-1.5 block text-xs font-bold text-ink-2"
            >
              البريد الإلكتروني
            </label>
            <input
              id="email-readonly"
              type="email"
              value={merchant.email ?? ""}
              readOnly
              disabled
              dir="ltr"
              className={cn(I, "cursor-not-allowed font-mono opacity-60")}
            />
            <p className="mt-1 text-[10.5px] text-ink-3">
              البريد مرتبط بحساب Google ولا يمكن تغييره.
            </p>
          </div>
        </div>

        {/* نُخفي avatarUrl داخل حقل مخفي — التحديث يتم من AvatarUploader */}
        <input type="hidden" name="avatarUrl" value={merchant.avatarUrl ?? ""} />

        <div className="flex items-center justify-end pt-2">
          <ProfileSubmitButton pending={isPending} state={state} />
        </div>
      </form>
    </section>
  );
}

// زر الإرسال — يستخدم useFormStatus للحالة.
function ProfileSubmitButton({
  pending,
  state,
}: {
  pending: boolean;
  state: ActionResult | null;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-5 text-xs font-black text-space shadow-md transition-all hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2 focus-visible:ring-offset-2 focus-visible:ring-offset-space disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
      ) : state?.ok ? (
        <Check className="size-3.5" strokeWidth={2.5} />
      ) : (
        <Save className="size-3.5" strokeWidth={2.5} />
      )}
      <span>{pending ? "جاري الحفظ..." : "حفظ بيانات الحساب"}</span>
    </button>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-1.5 flex items-center gap-1 text-[10.5px] font-bold text-rose-600 dark:text-rose-300"
    >
      <AlertTriangle className="size-3 shrink-0" strokeWidth={2.5} />
      {children}
    </p>
  );
}

// ── AVATAR UPLOADER
function AvatarUploader({ merchant }: { merchant: Merchant }) {
  const [pendingRemove, startRemove] = useTransition();
  const [pendingGoogle, startGoogle] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onRemove = () => {
    startRemove(async () => {
      const res = await removeAvatarAction();
      if (res.ok) toast.success("تم حذف الصورة");
      else toast.error(res.error ?? "تعذر الحذف");
    });
  };

  const onUseGoogle = () => {
    startGoogle(async () => {
      const res = await applyGoogleAvatarAction();
      if (res.ok) toast.success("سيتم استخدام صورة Google في الدخول القادم");
      else toast.error(res.error ?? "تعذر التنفيذ");
    });
  };

  const initial = merchant.displayName.trim().charAt(0) || "C";

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        {merchant.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={merchant.avatarUrl}
            alt=""
            className="size-20 rounded-full border-2 border-nova-2/40 object-cover shadow-lg"
          />
        ) : (
          <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-nova to-aurora text-2xl font-black text-white shadow-lg">
            {initial}
          </div>
        )}
        {merchant.isActivated ? (
          <span className="absolute bottom-0 end-0 grid size-6 place-items-center rounded-full bg-emerald-500 text-white shadow">
            <ShieldCheck className="size-3.5" strokeWidth={2.5} />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
          >
            <Upload className="size-3" strokeWidth={2.25} />
            رفع صورة
          </button>

          <button
            type="button"
            onClick={onUseGoogle}
            disabled={pendingGoogle}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50 disabled:opacity-60"
          >
            {pendingGoogle ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />
            ) : (
              <Sparkle className="size-3" strokeWidth={2.25} />
            )}
            استخدام صورة Google
          </button>

          {merchant.avatarUrl ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={pendingRemove}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 text-[11px] font-bold text-rose-600 dark:text-rose-200 transition-colors hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:opacity-60"
            >
              {pendingRemove ? (
                <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />
              ) : (
                <Trash2 className="size-3" strokeWidth={2.25} />
              )}
              حذف
            </button>
          ) : null}
        </div>

        <p className="text-[10.5px] leading-relaxed text-ink-3">
          الصورة تظهر في الداشبورد وفواتير المتجر. الحجم الموصى به: 400x400 بكسل.
        </p>

        {/* input مخفي — لربط الرفع بـ Server Action مستقبلي */}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            toast.info(
              "رفع الصور سيتوفر قريباً — استخدم 'استخدام صورة Google' الآن."
            );
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

// ── STORE TAB
function StoreTab({
  bp,
  onBpChange,
  ops,
  onOpsChange,
  qr,
  url,
  storeName,
  subdomain,
}: {
  bp: StoreBlueprint;
  onBpChange: (next: StoreBlueprint) => void;
  ops: StoreOps;
  onOpsChange: (next: StoreOps) => void;
  qr: string;
  url: string;
  storeName: string;
  subdomain: string;
}) {
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();

  // useOptimistic للتبديل السريع لحالة الإجازة — يعطي إحساساً فورياً.
  const [optimisticOps, setOptimisticOps] = useOptimistic(
    ops,
    (_curr, next: Partial<StoreOps>) => ({ ..._curr, ...next })
  );

  const toggleVacation = (checked: boolean) => {
    setOptimisticOps({ acceptingOrders: !checked });
    onOpsChange({ ...ops, acceptingOrders: !checked });
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("تم نسخ رابط المتجر");
    } catch {
      toast.error("تعذر النسخ — انسخه يدوياً");
    }
  };

  const onDownloadQr = () => {
    const a = document.createElement("a");
    a.href = qr;
    a.download = `${subdomain}-qr.png`;
    a.click();
    toast.success("تم تنزيل كود QR");
  };

  const onPrintQr = () => {
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return;
    w.document.write(`
      <html dir="rtl"><head><title>QR — ${subdomain}</title>
      <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;background:#fff;}
      .card{text-align:center;padding:32px;border:1px solid #eee;border-radius:24px;}
      img{width:320px;height:320px;} h1{font-size:18px;margin:0 0 8px;} p{font-size:12px;color:#666;margin:4px 0;}</style>
      </head><body><div class="card">
      <h1>${storeName}</h1>
      <img src="${qr}" alt="QR" />
      <p>${url}</p>
      </div><script>window.onload=()=>window.print();</script></body></html>
    `);
    w.document.close();
  };

  const onShareQr = async () => {
    try {
      const res = await fetch(qr);
      const blob = await res.blob();
      const file = new File([blob], `${subdomain}-qr.png`, { type: "image/png" });
      const navAny = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };
      if (navAny.canShare?.({ files: [file] }) && navAny.share) {
        await navAny.share({ files: [file], title: `متجر ${storeName}` });
        return;
      }
      await onCopy();
    } catch {
      toast.error("تعذرت المشاركة");
    }
  };

  return (
    <div className="space-y-6">
      {/* QR Card */}
      <section className="rounded-3xl border border-edge/10 bg-edge/[0.02] p-6 sm:p-8">
        <header className="mb-5 flex items-center gap-3 border-b border-edge/10 pb-5">
          <span className="grid size-10 place-items-center rounded-2xl bg-nova/15 text-nova-2">
            <QrCode className="size-4" strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="text-base font-black text-ink">رابط المتجر وكود QR</h2>
            <p className="mt-0.5 text-[11px] text-ink-3">
              اطبع الكود على تغليف شحناتك لزيادة الطلبات
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="كود QR لرابط المتجر"
            className="size-32 shrink-0 rounded-2xl border border-edge/10 bg-white p-2 shadow-lg"
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="rounded-xl border border-edge/10 bg-edge/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
                رابط المتجر
              </p>
              <p className="mt-1 truncate font-mono text-xs font-bold text-ink" dir="ltr">
                {url}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
              >
                {copied ? (
                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                ) : (
                  <Copy className="size-3" strokeWidth={2.25} />
                )}
                نسخ الرابط
              </button>
              <button
                type="button"
                onClick={onDownloadQr}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
              >
                <Download className="size-3" strokeWidth={2.25} />
                تنزيل PNG
              </button>
              <button
                type="button"
                onClick={onPrintQr}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
              >
                <Printer className="size-3" strokeWidth={2.25} />
                طباعة كارت
              </button>
              <button
                type="button"
                onClick={onShareQr}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2/50"
              >
                <Share2 className="size-3" strokeWidth={2.25} />
                مشاركة
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Vacation mode */}
      <section className="rounded-3xl border border-edge/10 bg-edge/[0.02] p-6 sm:p-8">
        <header className="mb-5 flex items-center gap-3 border-b border-edge/10 pb-5">
          <span className="grid size-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <Moon className="size-4" strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="text-base font-black text-ink">وضع الإجازة</h2>
            <p className="mt-0.5 text-[11px] text-ink-3">
              أوقف استقبال الطلبات مؤقتاً دون إغلاق المتجر
            </p>
          </div>
        </header>

        <label className="flex items-center gap-3 rounded-xl border border-edge/5 bg-edge/[0.02] p-3.5">
          <input
            type="checkbox"
            checked={!optimisticOps.acceptingOrders}
            onChange={(e) => toggleVacation(e.target.checked)}
            className="size-4 accent-nova"
          />
          <span className="text-xs font-bold text-ink">
            إيقاف استقبال الطلبات مؤقتاً
          </span>
        </label>

        <AnimatePresence initial={false}>
          {!optimisticOps.acceptingOrders ? (
            <motion.div
              key="vac-msg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 overflow-hidden"
            >
              <label
                htmlFor="vacationMessage"
                className="mb-1.5 block text-xs font-bold text-ink-2"
              >
                رسالة تظهر لزبائنك
              </label>
              <input
                id="vacationMessage"
                type="text"
                value={ops.vacationMessage}
                maxLength={160}
                onChange={(e) =>
                  onOpsChange({ ...ops, vacationMessage: e.target.value })
                }
                placeholder="نعتذر، المتجر في إجازة مؤقتة وسنعود قريباً"
                className={I}
              />
              <p className="mt-1 text-[10.5px] text-ink-3">
                {ops.vacationMessage.length}/160 حرفاً
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      {/* Showcase opt-in */}
      <section className="rounded-3xl border border-edge/10 bg-edge/[0.02] p-6 sm:p-8">
        <header className="mb-5 flex items-center gap-3 border-b border-edge/10 pb-5">
          <span className="grid size-10 place-items-center rounded-2xl bg-nova/15 text-nova-2">
            <Sparkles className="size-4" strokeWidth={2.25} />
          </span>
          <div>
            <h2 className="text-base font-black text-ink">معرض Colapia</h2>
            <p className="mt-0.5 text-[11px] text-ink-3">
              اسمح بعرض متجرك في الصفحة الرئيسية للمنصة
            </p>
          </div>
        </header>

        <label className="flex items-center gap-3 rounded-xl border border-edge/5 bg-edge/[0.02] p-3.5">
          <input
            type="checkbox"
            checked={optimisticOps.showcaseOptIn}
            onChange={(e) => {
              setOptimisticOps({ showcaseOptIn: e.target.checked });
              onOpsChange({ ...ops, showcaseOptIn: e.target.checked });
            }}
            className="size-4 accent-nova"
          />
          <span className="text-xs font-bold text-ink">
            اعرض متجري في معرض Colapia العام
          </span>
        </label>
      </section>
    </div>
  );
}

// ── PAYMENTS TAB
function PaymentsTab({
  bp,
  onBpChange,
}: {
  bp: StoreBlueprint;
  onBpChange: (next: StoreBlueprint) => void;
}) {
  const setPayments = (patch: Partial<StoreBlueprint["payments"]>) => {
    onBpChange({ ...bp, payments: { ...bp.payments, ...patch } });
  };

  return (
    <section className="space-y-5 rounded-3xl border border-edge/10 bg-edge/[0.02] p-6 sm:p-8">
      <header className="flex items-center gap-3 border-b border-edge/10 pb-5">
        <span className="grid size-10 place-items-center rounded-2xl bg-nova/15 text-nova-2">
          <Wallet className="size-4" strokeWidth={2.25} />
        </span>
        <div>
          <h2 className="text-base font-black text-ink">وسائل الدفع</h2>
          <p className="mt-0.5 text-[11px] text-ink-3">
            ما الذي يمكن لعملائك الدفع به؟
          </p>
        </div>
      </header>

      <PaymentRow
        label="الدفع عند الاستلام كاش (COD)"
        hint="الطريقة الأكثر شعبية في مصر"
        enabled={bp.payments.cod.enabled}
        onToggle={(v) =>
          setPayments({ cod: { ...bp.payments.cod, enabled: v } })
        }
      />

      <PaymentRow
        label="فودافون كاش / المحافظ الإلكترونية"
        hint="استقبل التحويلات من محفظتك"
        enabled={bp.payments.vodafoneCash.enabled}
        onToggle={(v) =>
          setPayments({
            vodafoneCash: { ...bp.payments.vodafoneCash, enabled: v },
          })
        }
      >
        {bp.payments.vodafoneCash.enabled ? (
          <input
            type="tel"
            inputMode="numeric"
            placeholder="01xxxxxxxxx"
            dir="ltr"
            pattern="^01[0125]\d{8}$"
            value={bp.payments.vodafoneCash.number ?? ""}
            onChange={(e) =>
              setPayments({
                vodafoneCash: {
                  ...bp.payments.vodafoneCash,
                  number: e.target.value,
                },
              })
            }
            className={cn(I, "font-mono")}
          />
        ) : null}
      </PaymentRow>

      <PaymentRow
        label="إنستاباي (InstaPay)"
        hint="للمدفوعات البنكية الفورية"
        enabled={bp.payments.instapay.enabled}
        onToggle={(v) =>
          setPayments({ instapay: { ...bp.payments.instapay, enabled: v } })
        }
      >
        {bp.payments.instapay.enabled ? (
          <input
            type="text"
            placeholder="username@instapay أو 01xxxxxxxxx"
            dir="ltr"
            value={
              bp.payments.instapay.address ??
              bp.payments.instapay.number ??
              ""
            }
            onChange={(e) =>
              setPayments({
                instapay: { ...bp.payments.instapay, address: e.target.value },
              })
            }
            className={cn(I, "font-mono")}
          />
        ) : null}
      </PaymentRow>
    </section>
  );
}

function PaymentRow({
  label,
  hint,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  hint: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-edge/5 bg-edge/[0.02] p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 size-4 accent-nova"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink">{label}</p>
          <p className="mt-0.5 text-[10.5px] text-ink-3">{hint}</p>
        </div>
      </label>
      {enabled && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

// ── CONTACT TAB
function ContactTab({
  bp,
  onBpChange,
}: {
  bp: StoreBlueprint;
  onBpChange: (next: StoreBlueprint) => void;
}) {
  const setChannels = (patch: Partial<StoreBlueprint["channels"]>) => {
    onBpChange({ ...bp, channels: { ...bp.channels, ...patch } });
  };

  return (
    <section className="space-y-5 rounded-3xl border border-edge/10 bg-edge/[0.02] p-6 sm:p-8">
      <header className="flex items-center gap-3 border-b border-edge/10 pb-5">
        <span className="grid size-10 place-items-center rounded-2xl bg-nova/15 text-nova-2">
          <MessageCircle className="size-4" strokeWidth={2.25} />
        </span>
        <div>
          <h2 className="text-base font-black text-ink">بيانات التواصل</h2>
          <p className="mt-0.5 text-[11px] text-ink-3">
            كيف يتواصل عملاؤك معك؟
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-2">
            <Phone className="size-3 text-nova-2" strokeWidth={2.25} />
            رقم واتساب المتجر
          </label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="01xxxxxxxxx"
            dir="ltr"
            pattern="^01[0125]\d{8}$"
            value={bp.channels.whatsappNumber ?? ""}
            onChange={(e) => setChannels({ whatsappNumber: e.target.value })}
            className={cn(I, "font-mono")}
          />
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-2">
            <Phone className="size-3 text-nova-2" strokeWidth={2.25} />
            رقم الهاتف
          </label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="01xxxxxxxxx"
            dir="ltr"
            pattern="^01[0125]\d{8}$"
            value={bp.channels.phone ?? ""}
            onChange={(e) => setChannels({ phone: e.target.value })}
            className={cn(I, "font-mono")}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-2">
            <Instagram className="size-3 text-nova-2" strokeWidth={2.25} />
            اسم حساب إنستاجرام
          </label>
          <input
            type="text"
            placeholder="username بدون @"
            dir="ltr"
            value={bp.channels.instagramUsername ?? ""}
            onChange={(e) => setChannels({ instagramUsername: e.target.value })}
            className={I}
          />
        </div>
      </div>
    </section>
  );
}

// ── DANGER TAB
function DangerTab() {
  const [doubleStep, setDoubleStep] = useState(false);
  const [pending, start] = useTransition();

  const onLogout = () => {
    start(async () => {
      // merchantLogoutAction يرمي redirect — لا نلفّه بـ try/catch.
      await merchantLogoutAction();
    });
  };

  return (
    <section className="space-y-5 rounded-3xl border border-rose-500/20 bg-rose-500/[0.03] p-6 sm:p-8">
      <header className="flex items-center gap-3 border-b border-rose-500/20 pb-5">
        <span className="grid size-10 place-items-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-300">
          <AlertTriangle className="size-4" strokeWidth={2.25} />
        </span>
        <div>
          <h2 className="text-base font-black text-rose-100">منطقة الخطر</h2>
          <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-200/70">
            إجراءات لا رجعة فيها — تأكد قبل التنفيذ
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-edge/5 bg-edge/[0.02] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink">تسجيل الخروج</p>
            <p className="mt-0.5 text-[10.5px] text-ink-3">
              يُنهي جلستك الحالية — يمكنك الدخول مرة أخرى في أي وقت
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 text-xs font-black text-rose-600 dark:text-rose-200 transition-colors hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
            ) : (
              <LogOut className="size-3.5" strokeWidth={2.25} />
            )}
            تسجيل الخروج
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
        <p className="text-xs font-bold text-rose-100">حذف حساب المتجر</p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-rose-600 dark:text-rose-200/70">
          سيتم حذف كل بيانات متجرك (المنتجات، الطلبات، العملاء) نهائياً. هذا
          الإجراء لا يمكن التراجع عنه.
        </p>
        {!doubleStep ? (
          <button
            type="button"
            onClick={() => setDoubleStep(true)}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 text-[11px] font-bold text-rose-100 transition-colors hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            <Trash2 className="size-3" strokeWidth={2.25} />
            أريد حذف الحساب
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href="mailto:support@colapia.com?subject=طلب%20حذف%20حساب"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-[11px] font-black text-white transition-colors hover:bg-rose-700"
            >
              <Trash2 className="size-3" strokeWidth={2.25} />
              تأكيد الطلب عبر البريد
            </a>
            <button
              type="button"
              onClick={() => setDoubleStep(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06]"
            >
              <RotateCcw className="size-3" strokeWidth={2.25} />
              إلغاء
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ── LIVE PREVIEW
function LivePreview({
  storeName,
  subdomain,
  bp,
  ops,
}: {
  storeName: string;
  subdomain: string;
  bp: StoreBlueprint;
  ops: StoreOps;
}) {
  const reduce = useReducedMotion();
  const paymentMethods = [
    bp.payments.cod.enabled && "COD",
    bp.payments.vodafoneCash.enabled && "Vodafone Cash",
    bp.payments.instapay.enabled && "InstaPay",
  ].filter(Boolean) as string[];

  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-3xl border border-edge/10 bg-edge/[0.02] p-5">
        <p className="mb-3 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
          <Eye className="size-3" strokeWidth={2.25} />
          معاينة حية
        </p>

        <motion.div
          layout={!reduce}
          className="rounded-2xl border border-edge/10 bg-gradient-to-br from-space-2 to-space p-4 shadow-inner"
        >
          <div className="flex items-center gap-3 border-b border-edge/5 pb-3">
            <div className="grid size-9 place-items-center rounded-xl bg-nova/20 text-nova-2">
              <StoreIcon className="size-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-ink">
                {storeName || "متجرك"}
              </p>
              <p
                className="truncate font-mono text-[10px] text-ink-3"
                dir="ltr"
              >
                {storeHost(subdomain)}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {!ops.acceptingOrders ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                <Moon className="size-2.5" strokeWidth={2.25} />
                إجازة مؤقتة
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                <Check className="size-2.5" strokeWidth={2.5} />
                مفتوح للطلبات
              </span>
            )}

            {ops.vacationMessage ? (
              <p className="rounded-lg border border-edge/5 bg-edge/[0.02] p-2 text-[10px] leading-relaxed text-ink-2">
                {ops.vacationMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-1">
              {paymentMethods.length === 0 ? (
                <span className="text-[10px] text-ink-3">
                  لا توجد وسائل دفع مفعّلة
                </span>
              ) : (
                paymentMethods.map((m) => (
                  <span
                    key={m}
                    className="rounded-md bg-nova/10 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-nova-2"
                    dir="ltr"
                  >
                    {m}
                  </span>
                ))
              )}
            </div>

            {ops.showcaseOptIn ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-nova/10 px-2 py-1 text-[10px] font-bold text-nova-2">
                <Sparkles className="size-2.5" strokeWidth={2.5} />
                معروض في معرض Colapia
              </span>
            ) : null}
          </div>
        </motion.div>
      </div>

      <p className="px-2 text-[10px] leading-relaxed text-ink-3">
        هذه معاينة مصغّرة من إعداداتك الحالية. المتجر الحقيقي يعكس التغييرات بعد
        الحفظ.
      </p>
    </div>
  );
}

// ── STICKY SAVE BAR
function StickySaveBar({
  visible,
  pending,
  onSave,
  onDiscard,
}: {
  visible: boolean;
  pending: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(92vw,680px)] items-center justify-between gap-3 rounded-2xl border border-edge/10 bg-space-2/95 p-3 shadow-2xl backdrop-blur-md"
          role="region"
          aria-label="شريط الحفظ"
        >
          <div className="flex items-center gap-2 ps-1">
            <span className="grid size-7 place-items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <Sparkle className="size-3" strokeWidth={2.5} />
            </span>
            <div className="text-start">
              <p className="text-[11px] font-black text-ink">
                تغييرات غير محفوظة
              </p>
              <p className="text-[10px] text-ink-3">
                <kbd className="rounded bg-edge/5 px-1 font-mono text-[9.5px]" dir="ltr">
                  Ctrl+S
                </kbd>{" "}
                للحفظ السريع
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] disabled:opacity-60"
            >
              تراجع
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              aria-busy={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-4 text-[11px] font-black text-space shadow transition-all hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />
              ) : (
                <Save className="size-3" strokeWidth={2.5} />
              )}
              {pending ? "جاري الحفظ..." : "حفظ"}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ── CONFIRM MODAL
function ConfirmModal({
  open,
  items,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  items: { label: string; from: string; to: string }[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: reduce ? 1 : 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: reduce ? 1 : 0.96, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-edge/10 bg-space-2 p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-nova/15 text-nova-2">
                <Save className="size-4" strokeWidth={2.25} />
              </span>
              <div>
                <h2 id="confirm-title" className="text-sm font-black text-ink">
                  تأكيد حفظ التغييرات
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  راجع الفروقات قبل الحفظ
                </p>
              </div>
            </div>

            <ul className="max-h-[280px] space-y-2 overflow-y-auto pe-1">
              {items.map((it, idx) => (
                <li
                  key={`${it.label}-${idx}`}
                  className="rounded-xl border border-edge/5 bg-edge/[0.02] p-3"
                >
                  <p className="text-[11px] font-bold text-ink-2">
                    {it.label}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10.5px]">
                    <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 font-mono text-rose-600 dark:text-rose-200 line-through">
                      {it.from}
                    </span>
                    <span className="text-ink-3">←</span>
                    <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-emerald-600 dark:text-emerald-200">
                      {it.to}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-4 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.06]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-l from-nova to-nova-2 px-5 text-xs font-black text-space shadow transition-all hover:brightness-105"
              >
                <Check className="size-3.5" strokeWidth={2.5} />
                تأكيد الحفظ
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}