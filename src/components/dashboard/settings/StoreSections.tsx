"use client";

// StoreSections — أقسام إعدادات المتجر: الرابط وكود QR، واستقبال الطلبات، ووسائل الدفع (بمعاينة كما يراها العميل
// في صفحة الدفع)، وقنوات التواصل. كل حقل له معرّف ثابت (set-<الحقل>) ليُركَّز عليه عند الخطأ.
import { useState } from "react";
import { Banknote, Check, Copy, Download, ExternalLink, Printer, Share2, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { paymentMethods } from "@/lib/payment-methods";
import { cleanInstapay, SETTINGS_LIMITS, type SettingsDraft, type SettingsField } from "@/lib/store-settings";
import { Field, Section, Switch, inputCls } from "../product/parts";
import type { StoreInfo } from "./SettingsPage";

type Props = { d: SettingsDraft; patch: (p: Partial<SettingsDraft>, clear?: SettingsField[]) => void; errors: Partial<Record<SettingsField, string>> };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function ShareCard({ store }: { store: StoreInfo }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(store.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("نُسخ رابط المتجر");
    } catch {
      toast.error("تعذر النسخ؛ انسخ الرابط يدوياً");
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: store.name, url: store.url });
      } catch {
        /* أغلق نافذة المشاركة */
      }
    } else await copy();
  };
  const print = () => {
    const w = window.open("", "_blank", "width=600,height=760");
    if (!w) return void toast.error("اسمح بالنوافذ المنبثقة لطباعة الكارت");
    w.document.write(
      `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(store.name)}</title><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;background:#fff;color:#111}.c{text-align:center;padding:32px 40px;border:1px solid #e5e7eb;border-radius:24px}h1{font-size:22px;margin:0 0 4px}p{margin:4px 0;color:#555;font-size:13px}img{width:300px;height:300px;margin:16px 0 8px}.u{font-family:monospace;direction:ltr;color:#111;font-size:14px}</style></head><body><div class="c"><h1>${esc(store.name)}</h1><p>صوّر الكود بكاميرا موبايلك وتسوّق</p><img src="${store.qr}" alt=""><p class="u">${esc(store.url.replace(/^https?:\/\//, ""))}</p></div><script>onload=()=>{print()}</script></body></html>`
    );
    w.document.close();
  };
  return (
    <Section title="رابط متجرك" hint="شاركه أو اطبع كود QR على أكياس التغليف والفواتير ليعود عملاؤك إليك">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={store.qr} alt={`كود QR لرابط ${store.name}`} className="size-32 shrink-0 self-center rounded-2xl border border-edge/10 bg-white p-2" />
        <div className="min-w-0 flex-1 space-y-3">
          <a href={store.url} target="_blank" rel="noopener noreferrer" dir="ltr" className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 font-mono text-[13px] font-bold text-ink hover:border-nova/40">
            <span className="truncate">{store.url.replace(/^https?:\/\//, "")}</span>
            <ExternalLink className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          </a>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={copy}>
              {copied ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              انسخ الرابط
            </Btn>
            <Btn onClick={share}>
              <Share2 className="size-4" aria-hidden="true" />
              شارك
            </Btn>
            <a href={store.qr} download={`${store.subdomain}-qr.png`} className={btnCls}>
              <Download className="size-4" aria-hidden="true" />
              نزّل الكود
            </a>
            <Btn onClick={print}>
              <Printer className="size-4" aria-hidden="true" />
              اطبع كارتاً
            </Btn>
          </div>
        </div>
      </div>
    </Section>
  );
}

const btnCls = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.05] hover:text-ink";
function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={btnCls}>
      {children}
    </button>
  );
}

export function VacationSection({ d, patch, errors }: Props) {
  return (
    <Section title="استقبال الطلبات" hint="أوقفه مؤقتاً في الإجازات أو عند نفاد البضاعة، والمتجر يبقى ظاهراً">
      <Switch
        label={d.acceptingOrders ? "متجرك يستقبل الطلبات" : "استقبال الطلبات متوقف"}
        hint={d.acceptingOrders ? "أطفئه ليظهر للزوار شريط بأن المتجر في إجازة ولا يُقبل أي طلب" : "يرى الزوار متجرك ومنتجاتهم، ولا يستطيعون الطلب"}
        checked={d.acceptingOrders}
        onChange={(v) => patch({ acceptingOrders: v }, ["vacationMessage"])}
      />
      {!d.acceptingOrders ? (
        <Field id="set-vacationMessage" label="رسالة للزوار" optional hint="تظهر في شريط أعلى المتجر وفي صفحة الدفع" error={errors.vacationMessage} count={d.vacationMessage.length} max={SETTINGS_LIMITS.vacation}>
          {(a) => <input {...a} dir="auto" maxLength={SETTINGS_LIMITS.vacation} className={inputCls} value={d.vacationMessage} placeholder="المتجر لا يستقبل طلبات الآن، وسنعود قريباً" onChange={(e) => patch({ vacationMessage: e.target.value }, ["vacationMessage"])} />}
        </Field>
      ) : null}
    </Section>
  );
}

export function PaymentsSection({ d, patch, errors }: Props) {
  const transfers = d.vodafone.enabled || d.instapay.enabled;
  const vf = normalizeEgyptianPhone(d.vodafone.number) ?? d.vodafone.number.trim();
  const ip = cleanInstapay(d.instapay.target);
  const preview = paymentMethods({
    cod: { enabled: d.cod },
    vodafoneCash: { enabled: d.vodafone.enabled, number: vf || undefined, holderName: d.vodafone.holder.trim() || undefined },
    instapay: { enabled: d.instapay.enabled, address: ip?.address, number: ip?.number ?? (ip ? undefined : d.instapay.target.trim() || undefined), holderName: d.instapay.holder.trim() || undefined },
    requireTransferProof: d.requireTransferProof,
  });
  const ICON = { cod: Banknote, vodafone_cash: Smartphone, instapay: Wallet } as const;

  return (
    <div className="space-y-5">
      <Section title="وسائل الدفع" hint="ما يختاره العميل في صفحة الدفع">
        {errors.payments ? (
          <p id="set-payments" tabIndex={-1} role="alert" className="rounded-xl border border-bad/25 bg-bad/[0.06] p-3 text-[12.5px] font-bold text-bad outline-none">
            {errors.payments}
          </p>
        ) : null}
        <Method>
          <Switch label="الدفع عند الاستلام" hint="العميل يدفع كاش للمندوب" checked={d.cod} onChange={(v) => patch({ cod: v }, ["payments"])} />
        </Method>
        <Method>
          <Switch label="فودافون كاش والمحافظ" hint="يحوّل العميل على رقم محفظتك" checked={d.vodafone.enabled} onChange={(v) => patch({ vodafone: { ...d.vodafone, enabled: v } }, ["payments", "vodafone.number"])} />
          {d.vodafone.enabled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="set-vodafone.number" label="رقم المحفظة" error={errors["vodafone.number"]}>
                {(a) => <input {...a} type="tel" inputMode="tel" dir="ltr" autoComplete="off" placeholder="01xxxxxxxxx" className={cn(inputCls, "font-mono")} value={d.vodafone.number} onChange={(e) => patch({ vodafone: { ...d.vodafone, number: e.target.value } }, ["vodafone.number"])} />}
              </Field>
              <Field id="set-vodafone.holder" label="اسم صاحب المحفظة" optional hint="يظهر بجانب الرقم ليطمئن العميل" error={errors["vodafone.holder"]}>
                {(a) => <input {...a} dir="auto" maxLength={SETTINGS_LIMITS.holder} className={inputCls} value={d.vodafone.holder} onChange={(e) => patch({ vodafone: { ...d.vodafone, holder: e.target.value } }, ["vodafone.holder"])} />}
              </Field>
            </div>
          ) : null}
        </Method>
        <Method>
          <Switch label="إنستاباي" hint="تحويل بنكي فوري برقمك أو عنوانك على إنستاباي" checked={d.instapay.enabled} onChange={(v) => patch({ instapay: { ...d.instapay, enabled: v } }, ["payments", "instapay.target"])} />
          {d.instapay.enabled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="set-instapay.target" label="الرقم أو العنوان" hint="01xxxxxxxxx أو name@instapay" error={errors["instapay.target"]}>
                {(a) => <input {...a} dir="ltr" autoComplete="off" placeholder="name@instapay" className={cn(inputCls, "font-mono")} value={d.instapay.target} onChange={(e) => patch({ instapay: { ...d.instapay, target: e.target.value } }, ["instapay.target"])} />}
              </Field>
              <Field id="set-instapay.holder" label="اسم صاحب الحساب" optional error={errors["instapay.holder"]}>
                {(a) => <input {...a} dir="auto" maxLength={SETTINGS_LIMITS.holder} className={inputCls} value={d.instapay.holder} onChange={(e) => patch({ instapay: { ...d.instapay, holder: e.target.value } }, ["instapay.holder"])} />}
              </Field>
            </div>
          ) : null}
        </Method>
      </Section>

      {transfers ? (
        <Section title="التحويلات" hint="للدفع بفودافون كاش أو إنستاباي">
          <Switch label="اطلب صورة التحويل" hint="لا يُرسَل الطلب حتى يرفع العميل صورة إيصال التحويل، فتراجعها من صفحة الطلب" checked={d.requireTransferProof} onChange={(v) => patch({ requireTransferProof: v })} />
          <Field id="set-transferInstructions" label="تعليمات التحويل" optional hint="تظهر للعميل في صفحة طلبه بعد إرساله" error={errors.transferInstructions} count={d.transferInstructions.length} max={SETTINGS_LIMITS.instructions}>
            {(a) => <textarea {...a} dir="auto" rows={3} maxLength={SETTINGS_LIMITS.instructions} className={cn(inputCls, "py-2.5 font-normal leading-7")} placeholder="مثال: اكتب رقم الطلب في ملاحظة التحويل" value={d.transferInstructions} onChange={(e) => patch({ transferInstructions: e.target.value }, ["transferInstructions"])} />}
          </Field>
        </Section>
      ) : null}

      <section aria-labelledby="pay-preview" className="rounded-2xl border border-dashed border-edge/15 p-4">
        <p id="pay-preview" className="text-[12px] font-black text-ink-2">
          كما تظهر للعميل في صفحة الدفع
        </p>
        {preview.length ? (
          <ul className="mt-3 space-y-2">
            {preview.map((m) => {
              const I = ICON[m.id];
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-xl border border-edge/10 bg-edge/[0.02] p-3">
                  <I className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-bold text-ink">{m.label}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">{m.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] font-bold text-bad">لا وسيلة دفع: لن يستطيع أحد الطلب.</p>
        )}
      </section>
    </div>
  );
}

function Method({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 rounded-xl border border-edge/10 bg-edge/[0.02] p-3.5">{children}</div>;
}

export function ContactSection({ d, patch, errors }: Props) {
  const field = (key: "whatsapp" | "phone" | "email" | "instagram" | "facebook", label: string, hint: string, extra: React.InputHTMLAttributes<HTMLInputElement>) => (
    <Field id={`set-${key}`} label={label} optional hint={hint} error={errors[key]}>
      {(a) => <input {...a} {...extra} dir="ltr" autoComplete="off" className={cn(inputCls, extra.type === "tel" && "font-mono")} value={d[key]} onChange={(e) => patch({ [key]: e.target.value } as Partial<SettingsDraft>, [key])} />}
    </Field>
  );
  return (
    <Section title="التواصل" hint="كيف يصل إليك عملاؤك. ما تتركه فارغاً لا يظهر في المتجر">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("whatsapp", "واتساب", "في رأس المتجر والفوتر وقسم التواصل", { type: "tel", inputMode: "tel", placeholder: "01xxxxxxxxx" })}
        {field("phone", "رقم الهاتف", "في الفوتر وقسم التواصل", { type: "tel", inputMode: "tel", placeholder: "01xxxxxxxxx" })}
        {field("email", "البريد", "في الفوتر", { type: "email", inputMode: "email", placeholder: "hello@yourstore.com" })}
        {field("instagram", "إنستاجرام", "في الفوتر. اكتب اسم الحساب أو الصق رابطه", { placeholder: "@yourstore" })}
        <div className="sm:col-span-2">{field("facebook", "فيسبوك", "في الفوتر. الصق رابط صفحتك", { inputMode: "url", placeholder: "facebook.com/yourstore" })}</div>
      </div>
    </Section>
  );
}
