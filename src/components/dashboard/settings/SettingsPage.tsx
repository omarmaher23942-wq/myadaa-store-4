"use client";

// SettingsPage — إعدادات المتجر والحساب في أربعة أقسام (التبويب في الرابط ?tab= ليُفتح مباشرة من أي مكان):
//  - «المتجر»: رابطه وكود QR، واستقبال الطلبات (وضع الإجازة).
//  - «الدفع»: الوسائل التي يراها العميل في صفحة الدفع بأرقامها وأسماء أصحابها وتعليمات التحويل.
//  - «التواصل»: واتساب والهاتف والبريد وإنستاجرام وفيسبوك كما تظهر في المتجر.
//  - «حسابك»: الاسم والموبايل والصورة، وكلمة المرور (نسخة التاجر)، والخروج، وحذف متجر التجربة (المنصة).
// إعدادات المتجر الثلاثة مسودة واحدة بشريط حفظ لاصق، تُتحقق بنفس قواعد الخادم (lib/store-settings.ts) قبل الإرسال،
// وأول خطأ يفتح تبويبه ويُركّز حقله. لا حفظ تلقائي: التاجر يحفظ بنفسه (Ctrl+S)، وتنبيه قبل مغادرة تعديلات غير محفوظة.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, MessageCircle, RotateCcw, Save, Store as StoreIcon, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { stableJson } from "@/lib/blueprint-patch";
import { SETTINGS_FIELD_ORDER, validateSettings, type SettingsDraft, type SettingsField } from "@/lib/store-settings";
import { saveStoreSettingsAction } from "@/server/actions/store-settings";
import { ConfirmDialog } from "../ui/DashDialog";
import { requestPulse } from "../DashboardPulse";
import { ContactSection, PaymentsSection, ShareCard, VacationSection } from "./StoreSections";
import { AccountTab, type AccountInfo } from "./AccountTab";

export type SettingsTab = "store" | "payments" | "contact" | "account";
const TABS: { key: SettingsTab; label: string; icon: typeof UserIcon }[] = [
  { key: "store", label: "المتجر", icon: StoreIcon },
  { key: "payments", label: "الدفع", icon: CreditCard },
  { key: "contact", label: "التواصل", icon: MessageCircle },
  { key: "account", label: "حسابك", icon: UserIcon },
];
const TAB_OF: Record<SettingsField, SettingsTab> = {
  payments: "payments",
  "vodafone.number": "payments",
  "vodafone.holder": "payments",
  "instapay.target": "payments",
  "instapay.holder": "payments",
  transferInstructions: "payments",
  whatsapp: "contact",
  phone: "contact",
  email: "contact",
  instagram: "contact",
  facebook: "contact",
  vacationMessage: "store",
};

export type StoreInfo = { name: string; subdomain: string; status: string; url: string; qr: string };

export function SettingsPage({ initialTab, store, settings, account }: { initialTab: SettingsTab; store: StoreInfo | null; settings: SettingsDraft | null; account: AccountInfo }) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>(store ? initialTab : "account");
  const [saved, setSaved] = useState(settings);
  const [d, setD] = useState(settings);
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirty = useMemo(() => Boolean(d && saved && stableJson(d) !== stableJson(saved)), [d, saved]);

  const go = (t: SettingsTab) => {
    setTab(t);
    const u = new URL(location.href);
    u.searchParams.set("tab", t);
    history.replaceState(history.state, "", u);
  };

  const patch = useCallback((p: Partial<SettingsDraft>, clear?: SettingsField[]) => {
    setD((cur) => (cur ? { ...cur, ...p } : cur));
    if (clear?.length) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !clear.includes(k as SettingsField))));
  }, []);

  const focusFirst = (errs: Partial<Record<SettingsField, string>>) => {
    const first = SETTINGS_FIELD_ORDER.find((f) => errs[f]);
    if (!first) return;
    go(TAB_OF[first]);
    // بعد أن يُعرض التبويب الجديد.
    setTimeout(() => {
      const el = document.getElementById(`set-${first}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    }, 60);
  };

  const save = useCallback(async () => {
    if (!d || saving) return;
    const v = validateSettings(d);
    if (!v.ok) {
      setErrors(v.errors);
      toast.error(Object.values(v.errors)[0] ?? "راجع الحقول المعلَّمة");
      return void focusFirst(v.errors);
    }
    setSaving(true);
    const r = await saveStoreSettingsAction(d).catch(() => ({ ok: false as const, error: "انقطع الاتصال، حاول مرة أخرى", errors: undefined }));
    setSaving(false);
    if (!r.ok) {
      if (r.errors) {
        setErrors(r.errors);
        focusFirst(r.errors);
      }
      return void toast.error(r.error);
    }
    setSaved(r.data);
    setD(r.data);
    setErrors({});
    requestPulse();
    toast.success("حُفظت الإعدادات، وتظهر في متجرك الآن");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, saving]);

  // Ctrl+S للحفظ، وتنبيه قبل مغادرة تعديلات غير محفوظة (إغلاق التبويب أو رابط داخلي).
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void saveRef.current();
      }
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const tabs = store ? TABS : TABS.filter((t) => t.key === "account");
  const badge = (t: SettingsTab) => Object.keys(errors).some((f) => TAB_OF[f as SettingsField] === t);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-black text-ink">الإعدادات</h1>
        <p className="mt-1 text-[12.5px] text-ink-3">{store ? `${store.name}: الدفع والتواصل واستقبال الطلبات، وحسابك.` : "حسابك."}</p>
      </header>

      <nav aria-label="أقسام الإعدادات" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => go(t.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-[12.5px] font-bold transition-colors",
                active ? "border-nova/30 bg-nova/15 text-ink" : "border-edge/10 text-ink-2 hover:bg-edge/[0.04] hover:text-ink"
              )}
            >
              <t.icon className={cn("size-4", active ? "text-nova-2" : "text-ink-3")} aria-hidden="true" />
              {t.label}
              {badge(t.key) ? <span className="size-2 rounded-full bg-bad" aria-label="فيه خطأ" /> : null}
            </button>
          );
        })}
      </nav>

      {store && d ? (
        <>
          {tab === "store" ? (
            <div className="space-y-5">
              <ShareCard store={store} />
              <VacationSection d={d} patch={patch} errors={errors} />
            </div>
          ) : null}
          {tab === "payments" ? <PaymentsSection d={d} patch={patch} errors={errors} /> : null}
          {tab === "contact" ? <ContactSection d={d} patch={patch} errors={errors} /> : null}
        </>
      ) : null}
      {tab === "account" ? <AccountTab account={account} store={store} /> : null}

      {dirty || saving ? (
        <div data-savebar className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 md:bottom-4">
          <div className="dash-card flex items-center justify-between gap-3 border-nova/30 p-2.5 ps-4 shadow-2xl shadow-black/20">
            <p className="text-[12.5px] font-bold text-ink-2">{saving ? "نحفظ…" : "تعديلات غير محفوظة"}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setD(saved);
                  setErrors({});
                }}
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold text-ink-3 hover:bg-edge/5 hover:text-ink"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                تراجع
              </button>
              <button type="button" onClick={() => void save()} disabled={saving} title="Ctrl+S" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                احفظ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={leaveTo !== null}
        onClose={() => setLeaveTo(null)}
        title="تغادر بلا حفظ؟"
        description="تعديلاتك على الإعدادات لم تُحفظ بعد وستضيع."
        confirmLabel="غادر بلا حفظ"
        tone="danger"
        onConfirm={async () => {
          const to = leaveTo;
          setSaved(d);
          setLeaveTo(null);
          if (to) router.push(to);
          return true;
        }}
      />
    </div>
  );
}
