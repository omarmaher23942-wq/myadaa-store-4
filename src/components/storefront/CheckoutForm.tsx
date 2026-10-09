"use client";

// CheckoutForm — التدفق الكامل:
// - 3 خطوات ذكية عبر CheckoutProgress.
// - Live validation للهاتف المصري + الاسم.
// - quoteAction عند اختيار المحافظة (Suspense-free debounced).
// - idempotencyKey per session لمنع تكرار الأوردر.
// - saveAbandonedAction بعد إدخال الهاتف.
// - تذكّر بيانات المشتري عبر cart.rememberCustomer.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Loader2,
  Check,
  AlertCircle,
  ShoppingBag,
  Truck,
  Copy,
  User,
  Phone,
  MapPin,
  RotateCcw,
  Lock,
  Banknote,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useCart, itemKey } from "@/store/cart";
import { GOVERNORATES } from "@/lib/egypt";
import { formatEgp } from "@/lib/money";
import { clearPromo, readPromo } from "./PromoFromLink";
import { normalizeEgyptianPhone } from "@/lib/phone";
import {
  placeOrderAction,
  quoteAction,
  saveAbandonedAction,
  type Quote,
} from "@/server/actions/checkout";
import { UploadButton } from "@/lib/uploadthing-client";
import { paymentMethods } from "@/lib/payment-methods";
import type { StoreBlueprint } from "@/blueprint/schema";
import { useHydrated } from "./CartView";
import { CheckoutProgress, useCheckoutProgress } from "./CheckoutProgress";
import { cn } from "@/lib/utils";

type PM = "cod" | "vodafone_cash" | "instapay";
type Form = {
  name: string;
  phone: string;
  email: string;
  altPhone: string;
  governorate: string;
  city: string;
  address: string;
  landmark: string;
  notes: string;
  paymentMethod: PM;
  discountCode: string;
  transferSenderPhone: string;
  transferScreenshotUrl: string;
};

type Method = { id: PM; label: string; desc: string; targetNumber?: string };
type QuoteOk = Extract<Quote, { ok: true }>;

const F =
  "w-full rounded-xl border bg-[var(--background)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none transition-all placeholder:opacity-40 focus:ring-2 focus:ring-[var(--primary)]/30";
const SW = 1.75;
const SAVED_KEY = "clp-customer";

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

const methodsOf = (p: StoreBlueprint["payments"]) => paymentMethods(p) as Method[];

const PHONE_RE = /^01[0125]\d{8}$/;
function isPhoneValid(v: string) {
  const n = v.replace(/\D/g, "");
  return PHONE_RE.test(n);
}

export type CheckoutZone = { code: string; fee: number; etaMin: number; etaMax: number; cod?: number };
export type CheckoutPolicy = {
  flatPiasters: number | null;
  freeOverPiasters: number | null;
  generalEta: string;
  inspectionAllowed: boolean;
  returnDays: number;
};

export function CheckoutForm({
  subdomain,
  payments,
  remember,
  zones = [],
  policy,
}: {
  subdomain: string;
  payments: StoreBlueprint["payments"];

  remember: boolean;
  zones?: CheckoutZone[];
  policy?: CheckoutPolicy;
}) {
  // المحافظات التي يشحن إليها المتجر فعلاً (من جدول مناطقه)، وإلا كل المحافظات.
  const zoneByCode = useMemo(() => new Map(zones.map((z) => [z.code, z])), [zones]);
  const governorates = zones.length ? GOVERNORATES.filter((g) => zoneByCode.has(g.code)) : GOVERNORATES;
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const savedCustomer = useCart((s) => s.customer);
  const rememberCustomer = useCart((s) => s.rememberCustomer);
  const router = useRouter();
  const methods = useMemo(() => methodsOf(payments), [payments]);

  const [f, setF] = useState<Form>(() => ({
    name: "",
    phone: "",
    email: "",
    altPhone: "",
    governorate: "",
    city: "",
    address: "",
    landmark: "",
    notes: "",
    paymentMethod: methods[0]?.id ?? "cod",
    discountCode: "",
    transferSenderPhone: "",
    transferScreenshotUrl: "",
  }));
  const [quote, setQuote] = useState<QuoteOk | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);

  // كود من رابط خصم شاركه التاجر (?promo=): يُملأ بعد التركيب (التخزين المحلي لا يُقرأ أثناء العرض على الخادم).
  const [promoFromLink, setPromoFromLink] = useState<string | null>(null);
  useEffect(() => {
    const code = readPromo(subdomain);
    if (!code) return;
    setPromoFromLink(code);
    setF((x) => (x.discountCode ? x : { ...x, discountCode: code }));
  }, [subdomain]);

  const idemKey = useRef("");
  const quoteSeq = useRef(0);
  const savedPhone = useRef<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErr((e) => (e?.field === k ? null : e));
  };

  const localSub = items.reduce((a, i) => a + i.unitPiasters * i.qty, 0);
  const cartPayload = useMemo(
    () =>
      items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        qty: i.qty,
        bundleId: i.bundleId,
      })),
    [items]
  );
  const cartSig = JSON.stringify(cartPayload);
  const phoneNorm = normalizeEgyptianPhone(f.phone) ?? "";

  // Progress
  const progress = useCheckoutProgress({
    name: f.name,
    phone: phoneNorm,
    governorate: f.governorate,
    address: f.address,
    paymentMethod: f.paymentMethod,
    transferScreenshotUrl: f.transferScreenshotUrl,
    requireTransferProof: payments.requireTransferProof,
  });

  // Prefill from remembered customer
  useEffect(() => {
    if (!remember || !savedCustomer) return;
    setF((s) => ({ ...s, ...savedCustomer }));
  }, [remember, savedCustomer]);

  // Idempotency key per checkout session
  useEffect(() => {
    idemKey.current = newKey();
    window.clpTrack?.("begin_checkout");
  }, []);

  // Quote on change (debounced)
  useEffect(() => {
    if (!cartPayload.length) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await quoteAction(subdomain, {
          items: cartPayload,
          governorate: f.governorate,
          paymentMethod: f.paymentMethod,
          discountCode: f.discountCode || undefined,
          phone: phoneNorm || undefined,
        });
        if (seq !== quoteSeq.current) return;
        if (q.ok) {
          setQuote(q);
          setQuoteError(null);
        } else {
          setQuote(null);
          setQuoteError(q.error);
        }
      } catch {
        if (seq === quoteSeq.current) {
          setQuote(null);
          setQuoteError(null);
        }
      } finally {
        if (seq === quoteSeq.current) setQuoting(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [cartSig, f.governorate, f.paymentMethod, f.discountCode, phoneNorm, subdomain]);

  // Save abandoned cart after valid phone
  useEffect(() => {
    if (!phoneNorm || !PHONE_RE.test(phoneNorm)) return;
    if (phoneNorm === savedPhone.current || !cartPayload.length) return;
    const vid = (() => {
      try {
        return localStorage.getItem("clp-vid");
      } catch {
        return null;
      }
    })();
    if (!vid) return;
    const t = setTimeout(() => {
      savedPhone.current = phoneNorm;
      void saveAbandonedAction(subdomain, {
        visitorId: vid,
        phone: phoneNorm,
        name: f.name || undefined,
        items: cartPayload,
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [f.phone, cartPayload, subdomain, f.name, phoneNorm]);

  if (!hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]" aria-busy="true">
        <div className="h-96 animate-pulse rounded-3xl bg-[var(--muted)]" />
        <div className="h-64 animate-pulse rounded-3xl bg-[var(--muted)]" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div
        className="space-y-4 rounded-3xl border p-10 text-center"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--muted)] opacity-60">
          <ShoppingBag className="size-8" strokeWidth={SW} aria-hidden="true" />
        </div>
        <p className="text-base font-black">سلة مشترياتك فارغة</p>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl px-6 text-xs font-black shadow-md"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          تصفح المنتجات الآن
        </Link>
      </div>
    );
  }

  const selectedMethod = methods.find((m) => m.id === f.paymentMethod);
  const hasCod = methods.some((m) => m.id === "cod");
  const prepaid = methods.filter((m) => m.id !== "cod");
  // رسوم التحصيل في المحافظة المختارة (أو أعلاها قبل الاختيار) لتظهر المقارنة بصدق.
  const codFeeHere = f.governorate ? zoneByCode.get(f.governorate)?.cod ?? 0 : Math.max(0, ...zones.map((z) => z.cod ?? 0));
  const isElectronicPay =
    f.paymentMethod === "vodafone_cash" || f.paymentMethod === "instapay";
  const blocked = pending || !!quote?.shippingError;

  const submit = () =>
    start(async () => {
      setErr(null);
      if (isElectronicPay && payments.requireTransferProof && !f.transferScreenshotUrl) {
        toast.error("يرجى إرفاق صورة إيصال التحويل لإتمام طلبك");
        return;
      }
      if (!idemKey.current) idemKey.current = newKey();
      try {
        const r = await placeOrderAction(subdomain, {
          ...f,
          email: f.email || undefined,
          altPhone: f.altPhone || undefined,
          city: f.city || undefined,
          landmark: f.landmark || undefined,
          notes: f.notes || undefined,
          discountCode: f.discountCode || undefined,
          transferSenderPhone: isElectronicPay
            ? f.transferSenderPhone || f.phone
            : undefined,
          transferScreenshotUrl: isElectronicPay ? f.transferScreenshotUrl : undefined,
          items: cartPayload,
          visitorId: (() => {
            try {
              return localStorage.getItem("clp-vid") ?? undefined;
            } catch {
              return undefined;
            }
          })(),
          idempotencyKey: idemKey.current,
        });
        if (!r.ok) {
          setErr({ field: r.field, msg: r.error });
          toast.error(r.error);
          return;
        }
        if (remember) rememberCustomer({ ...f });
        window.clpTrack?.("purchase", {
          code: r.data.code,
          total: r.data.total,
        });
        clear();
        clearPromo(subdomain);
        router.push(`/order/${encodeURIComponent(r.data.code)}`);
      } catch {
        toast.error("تعذّر تأكيد الطلب، يرجى المحاولة ثانية");
      }
    });

  const fieldError = (k: keyof Form) =>
    err?.field === k ? (
      <p className="mt-1 text-[11px] font-bold text-rose-500">{err.msg}</p>
    ) : null;

  const shownSub = quote?.subtotal ?? localSub;
  const shippingReady = !!quote && quote.shipping !== null;

  const inputStyle: React.CSSProperties = {
    borderColor: "var(--border)",
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]" dir="rtl">
      <div className="space-y-6">
        <CheckoutProgress
          completed={progress.completed}
          current={progress.current}
        />

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          {/* Step 1 — Contact */}
          <section
            className="space-y-4 rounded-3xl border p-6 shadow-xs sm:p-7"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <header
              className="flex items-center justify-between gap-2 border-b pb-3"
              style={{ borderColor: "var(--border)" }}
            >
              <h2 className="flex items-center gap-2 font-heading text-base font-black">
                <User className="size-4" style={{ color: "var(--primary)" }} strokeWidth={SW} aria-hidden="true" />
                بيانات التوصيل
              </h2>
              {policy?.inspectionAllowed ? (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                  <ShieldCheck className="inline size-3.5" strokeWidth={SW} aria-hidden="true" /> معاينة مع المندوب
                </span>
              ) : null}
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="co-name" className="mb-1 block text-xs font-bold">الاسم بالكامل *</label>
                <input
                  id="co-name"
                  className={F}
                  style={inputStyle}
                  placeholder="اكتب اسمك الثلاثي"
                  autoComplete="name"
                  value={f.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  maxLength={60}
                  aria-invalid={!!(err?.field === "name")}
                />
                {fieldError("name")}
              </div>

              <div>
                <label htmlFor="co-phone" className="mb-1 block text-xs font-bold">رقم الموبايل *</label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-40"
                    strokeWidth={SW}
                    aria-hidden="true"
                  />
                  <input
                    id="co-phone"
                    className={cn(F, "pe-9 font-mono")}
                    style={inputStyle}
                    placeholder="01xxxxxxxxx"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    value={f.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    required
                    maxLength={20}
                    aria-invalid={!!(err?.field === "phone")}
                  />
                </div>
                {f.phone.length >= 11 && !isPhoneValid(f.phone) ? (
                  <p className="mt-1 text-[11px] font-bold text-rose-500">رقم غير صحيح — يجب أن يبدأ بـ 010/011/012/015</p>
                ) : null}
                {fieldError("phone")}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="co-email" className="mb-1 block text-xs font-bold">
                  بريدك <span className="font-medium opacity-60">(اختياري: نبلغك عليه بكل خطوة في طلبك)</span>
                </label>
                <input
                  id="co-email"
                  type="email"
                  className={cn(F, "font-mono")}
                  style={inputStyle}
                  placeholder="name@example.com"
                  autoComplete="email"
                  inputMode="email"
                  dir="ltr"
                  value={f.email}
                  onChange={(e) => set("email", e.target.value.trim())}
                  maxLength={120}
                  aria-invalid={!!(err?.field === "email")}
                />
                {fieldError("email")}
              </div>

              <div>
                <label htmlFor="co-gov" className="mb-1 block text-xs font-bold">المحافظة *</label>
                <div className="relative">
                  <MapPin
                    className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-40"
                    strokeWidth={SW}
                    aria-hidden="true"
                  />
                  <select
                    id="co-gov"
                    className={cn(F, "pe-9 appearance-none")}
                    style={inputStyle}
                    value={f.governorate}
                    onChange={(e) => set("governorate", e.target.value)}
                    required
                  >
                    <option value="">اختر المحافظة لحساب الشحن</option>
                    {governorates.map((g) => {
                      const z = zoneByCode.get(g.code);
                      const showFee = z && policy && policy.flatPiasters === null && policy.freeOverPiasters !== 0;
                      return (
                        <option key={g.code} value={g.code}>
                          {showFee ? `${g.name} — ${formatEgp(z.fee)}` : g.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {fieldError("governorate")}
                {f.governorate && zoneByCode.get(f.governorate) ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-600">
                    <Truck className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                    يوصلك خلال {zoneByCode.get(f.governorate)!.etaMin}-{zoneByCode.get(f.governorate)!.etaMax} أيام عمل
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="co-city" className="mb-1 block text-xs font-bold">المدينة / الحي</label>
                <input
                  id="co-city"
                  className={F}
                  style={inputStyle}
                  placeholder="المعادي / مدينة نصر"
                  value={f.city}
                  onChange={(e) => set("city", e.target.value)}
                  maxLength={60}
                />
              </div>
            </div>

            <div>
              <label htmlFor="co-address" className="mb-1 block text-xs font-bold">العنوان بالتفصيل *</label>
              <textarea
                id="co-address"
                className={F}
                style={inputStyle}
                rows={2}
                placeholder="اسم الشارع، رقم العمارة، الدور، الشقة"
                autoComplete="street-address"
                value={f.address}
                onChange={(e) => set("address", e.target.value)}
                required
                maxLength={300}
              />
              {fieldError("address")}
            </div>

            <div>
              <label htmlFor="co-notes" className="mb-1 block text-xs font-bold">ملاحظات للطلب (اختياري)</label>
              <input
                id="co-notes"
                className={F}
                style={inputStyle}
                placeholder="أي تفاصيل خاصة بتوقيت الاستلام"
                value={f.notes}
                onChange={(e) => set("notes", e.target.value)}
                maxLength={300}
              />
            </div>
          </section>

          {/* Step 2 — Payment */}
          <section
            className="space-y-4 rounded-3xl border p-6 shadow-xs sm:p-7"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="border-b pb-3 font-heading text-base font-black" style={{ borderColor: "var(--border)" }}>
              متى تحب تدفع؟
            </h2>

            {/* سؤال واحد واضح: الآن بالتحويل أم عند الاستلام. لا اختيار مفروض، ولا رسوم مخفية. */}
            <div className={cn("grid gap-3", hasCod && prepaid.length ? "sm:grid-cols-2" : "grid-cols-1")} role="radiogroup" aria-label="وقت الدفع">
              {hasCod ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={f.paymentMethod === "cod"}
                  onClick={() => set("paymentMethod", "cod")}
                  className={cn("flex items-start gap-3 rounded-2xl border-2 p-4 text-start transition-all", f.paymentMethod === "cod" ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]" : "border-[var(--border)] hover:border-[var(--foreground)]/30")}
                >
                  <span className="s-icon !size-10"><Banknote className="size-5" aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black">عند الاستلام</span>
                    <span className="mt-0.5 block text-xs leading-5 opacity-75">{policy?.inspectionAllowed ? "تفتح الشحنة وتعاين المنتج قبل ما تدفع للمندوب" : "تدفع نقداً للمندوب لما الطلب يوصلك"}</span>
                    <span className={cn("mt-1.5 inline-block text-[11px] font-black", codFeeHere > 0 ? "text-[color-mix(in_srgb,var(--warning)_55%,var(--foreground))]" : "opacity-60")}>
                      {codFeeHere > 0 ? `+ ${formatEgp(codFeeHere)} رسوم تحصيل` : "بدون رسوم إضافية"}
                    </span>
                  </span>
                </button>
              ) : null}
              {prepaid.length ? (
                <button
                  type="button"
                  role="radio"
                  aria-checked={isElectronicPay}
                  onClick={() => !isElectronicPay && set("paymentMethod", prepaid[0]!.id)}
                  className={cn("flex items-start gap-3 rounded-2xl border-2 p-4 text-start transition-all", isElectronicPay ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]" : "border-[var(--border)] hover:border-[var(--foreground)]/30")}
                >
                  <span className="s-icon !size-10"><Smartphone className="size-5" aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black">الآن بالتحويل</span>
                    <span className="mt-0.5 block text-xs leading-5 opacity-75">{prepaid.map((m) => (m.id === "vodafone_cash" ? "فودافون كاش" : "إنستاباي")).join(" أو ")}، وطلبك يتأكد أسرع</span>
                    {codFeeHere > 0 ? <span className="mt-1.5 inline-block text-[11px] font-black text-[color-mix(in_srgb,var(--success)_75%,var(--foreground))]">توفّر {formatEgp(codFeeHere)} رسوم التحصيل</span> : null}
                  </span>
                </button>
              ) : null}
            </div>

            {isElectronicPay && prepaid.length > 1 ? (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="وسيلة التحويل">
                {prepaid.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={f.paymentMethod === m.id}
                    onClick={() => set("paymentMethod", m.id)}
                    className={cn("s-chip min-h-11 border-2 px-3 text-xs font-black transition", f.paymentMethod === m.id ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)]")}
                  >
                    {m.id === "vodafone_cash" ? "فودافون كاش" : "إنستاباي"}
                  </button>
                ))}
              </div>
            ) : null}

            {isElectronicPay && selectedMethod ? (
              <div
                className="mt-3 space-y-3 rounded-2xl border p-4"
                style={{
                  borderColor: "var(--border)",
                  background: "color-mix(in srgb, var(--muted) 40%, transparent)",
                }}
              >
                <ol className="list-inside list-decimal space-y-1 text-[12px] font-bold opacity-80">
                  <li>انسخ الرقم وحوّل المبلغ بالضبط.</li>
                  <li>صوّر شاشة نجاح التحويل وارفعها هنا.</li>
                  <li>اضغط تأكيد الطلب، ونراجع التحويل ونؤكد لك.</li>
                </ol>
                {quote ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border bg-[var(--background)] p-3" style={{ borderColor: "var(--border)" }}>
                    <div>
                      <span className="block text-[10.5px] font-bold opacity-60">المبلغ المطلوب تحويله</span>
                      <span className="block font-mono text-lg font-black">{formatEgp(quote.total)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(String(Math.round(quote.total / 100)));
                        toast.success("تم نسخ المبلغ");
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors hover:bg-[var(--muted)]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Copy className="size-3.5" aria-hidden="true" />
                      نسخ
                    </button>
                  </div>
                ) : null}
                <div
                  className="flex items-center justify-between gap-2 rounded-xl border bg-[var(--background)] p-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="min-w-0">
                    <span className="block text-[10.5px] font-bold opacity-60">
                      {f.paymentMethod === "vodafone_cash"
                        ? "رقم المحفظة للتحويل:"
                        : "عنوان / رقم إنستاباي:"}
                    </span>
                    <span className="block select-all font-mono text-sm font-black" dir="ltr">
                      {selectedMethod.targetNumber || "01xxxxxxxxx"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedMethod.targetNumber) return;
                      navigator.clipboard.writeText(selectedMethod.targetNumber);
                      toast.success("تم نسخ الرقم");
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors hover:bg-[var(--muted)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Copy className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                    نسخ
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold">
                    رقم المحفظة التي حوّلت منها:
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    className={cn(F, "font-mono")}
                    style={inputStyle}
                    placeholder="01xxxxxxxxx"
                    value={f.transferSenderPhone}
                    onChange={(e) => set("transferSenderPhone", e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold">
                    صورة إيصال التحويل *
                  </label>
                  {f.transferScreenshotUrl ? (
                    <div
                      className="flex items-center justify-between gap-2 rounded-xl border bg-[var(--background)] p-2"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Image
                        src={f.transferScreenshotUrl}
                        alt="إيصال"
                        width={56}
                        height={56}
                        className="size-14 rounded-lg object-cover"
                        unoptimized
                      />
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <Check className="size-4" strokeWidth={SW} aria-hidden="true" />
                        تم إرفاق الإيصال
                      </span>
                      <button
                        type="button"
                        onClick={() => set("transferScreenshotUrl", "")}
                        className="text-xs font-bold text-rose-500 hover:underline"
                      >
                        تغيير
                      </button>
                    </div>
                  ) : (
                    <UploadButton
                      endpoint="transferProof"
                      input={{ subdomain }}
                      onClientUploadComplete={(res) => {
                        const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
                        if (url) {
                          set("transferScreenshotUrl", url);
                          toast.success("تم إرفاق الإيصال");
                        }
                      }}
                      onUploadError={(e) => {
                        toast.error(e?.message || "فشل الرفع");
                      }}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </section>

          {/* Step 3 — Discount + Confirm */}
          <section
            className="space-y-4 rounded-3xl border p-6 shadow-xs sm:p-7"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="border-b pb-3 font-heading text-base font-black" style={{ borderColor: "var(--border)" }}>
              هل لديك كود خصم؟
            </h2>
            <input
              className={cn(F, "font-mono font-bold uppercase")}
              style={inputStyle}
              placeholder="اكتب كود الخصم"
              dir="ltr"
              value={f.discountCode}
              onChange={(e) =>
                set("discountCode", e.target.value.toUpperCase().slice(0, 20))
              }
            />
            {quote?.discountError ? (
              <p className="text-xs font-bold text-rose-500">{quote.discountError}</p>
            ) : null}
            {promoFromLink && f.discountCode === promoFromLink && !quote?.discountError ? (
              <p className="text-xs text-[var(--muted-foreground)]">من رابط الخصم الذي فتحته.</p>
            ) : null}
            {quote && quote.discount > 0 ? (
              <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 p-2 text-xs font-bold text-emerald-700">
                <Check strokeWidth={SW} className="size-4" aria-hidden="true" />
                تم تطبيق خصم بقيمة {formatEgp(quote.discount)}
              </p>
            ) : null}
          </section>

          {err && !err.field ? (
            <p className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-bold text-rose-700">
              <AlertCircle strokeWidth={SW} className="size-4 shrink-0" aria-hidden="true" />
              {err.msg}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={blocked || !progress.completed.confirm}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-black text-white shadow-md transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 strokeWidth={SW} className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck strokeWidth={SW} className="size-5" aria-hidden="true" />
            )}
            <span>تأكيد الطلب الآن</span>
            {shippingReady && quote ? (
              <span className="ms-1 rounded-lg bg-emerald-800/40 px-2.5 py-0.5 font-mono text-sm">
                {formatEgp(quote.total)}
              </span>
            ) : null}
          </button>

          {f.paymentMethod === "cod" && policy?.inspectionAllowed ? (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs opacity-60">
              <Truck className="size-3.5" strokeWidth={SW} aria-hidden="true" />
              المعاينة متاحة مع المندوب قبل دفع أي مليم
            </p>
          ) : null}
        </form>
      </div>

      {/* Sidebar Summary */}
      <aside
        className="h-fit space-y-5 rounded-3xl border p-6 shadow-xs lg:sticky lg:top-32"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h2
          className="border-b pb-3 font-heading text-base font-black"
          style={{ borderColor: "var(--border)" }}
        >
          ملخص الطلب ({items.length})
        </h2>
        <ul className="max-h-72 divide-y overflow-y-auto" style={{ borderColor: "var(--border)" }}>
          {items.map((i) => (
            <li key={itemKey(i)} className="flex items-center gap-3 py-3" style={{ borderColor: "var(--border)" }}>
              <div
                className="relative size-14 shrink-0 overflow-hidden rounded-xl border"
                style={{ background: "var(--muted)", borderColor: "var(--border)" }}
              >
                {i.imageUrl ? (
                  <Image src={i.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                ) : null}
                <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-[var(--foreground)] font-mono text-[10px] font-black text-[var(--background)] shadow">
                  {i.qty}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black">{i.name}</p>
                {i.variantLabel ? (
                  <p className="mt-0.5 text-[11px] opacity-60">{i.variantLabel}</p>
                ) : null}
              </div>
              <span className="font-mono text-xs font-black">
                {formatEgp(i.unitPiasters * i.qty)}
              </span>
            </li>
          ))}
        </ul>

        {quoteError ? (
          <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-xs font-bold text-rose-700">
            <AlertCircle strokeWidth={SW} className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {quoteError}
          </p>
        ) : null}

        <dl
          className={cn("space-y-2.5 border-t pt-4 text-xs", quoting && "opacity-60")}
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex justify-between opacity-80">
            <dt>مجموع المنتجات</dt>
            <dd className="font-mono font-bold">{formatEgp(shownSub)}</dd>
          </div>
          <div className="flex justify-between opacity-80">
            <dt>تكلفة التوصيل</dt>
            <dd className="font-mono font-bold">
              {quote?.shippingError ? (
                <span className="text-rose-500">{quote.shippingError}</span>
              ) : !shippingReady ? (
                <span className="font-sans font-normal opacity-60">
                  {f.governorate ? "جاري الحساب…" : "اختر المحافظة"}
                </span>
              ) : quote!.shipping === 0 ? (
                <span className="font-sans font-bold text-emerald-600">مجاني</span>
              ) : (
                formatEgp(quote!.shipping!)
              )}
            </dd>
          </div>
          {quote && quote.codFee > 0 ? (
            <div className="flex justify-between opacity-80">
              <dt>رسوم الدفع عند الاستلام</dt>
              <dd className="font-mono font-bold">{formatEgp(quote.codFee)}</dd>
            </div>
          ) : null}
          {quote && quote.discount > 0 ? (
            <div className="flex justify-between font-bold text-emerald-600">
              <dt>الخصم</dt>
              <dd className="font-mono">− {formatEgp(quote.discount)}</dd>
            </div>
          ) : null}
          <div
            className="flex justify-between border-t pt-3 text-sm font-black"
            style={{ borderColor: "var(--border)" }}
          >
            <dt>الإجمالي</dt>
            <dd className="font-mono text-base text-emerald-600">
              {formatEgp(quote?.total ?? localSub)}
            </dd>
          </div>
        </dl>

        {policy?.freeOverPiasters && quote?.shipping && quote.shipping > 0 && shownSub < policy.freeOverPiasters ? (
          <div className="space-y-1.5 rounded-2xl p-3" style={{ background: "var(--muted)" }}>
            <p className="text-[11.5px] font-bold">
              أضف منتجات بـ <span className="font-mono">{formatEgp(policy.freeOverPiasters - shownSub)}</span> واحصل على شحن مجاني
            </p>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (shownSub / policy.freeOverPiasters) * 100)}%` }} />
            </div>
          </div>
        ) : null}

        {policy ? (
          <ul className="grid gap-2 border-t pt-4 text-[11.5px] font-bold" style={{ borderColor: "var(--border)" }}>
            {policy.inspectionAllowed ? (
              <li className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-emerald-600" strokeWidth={SW} aria-hidden="true" /> افحص المنتج مع المندوب قبل ما تدفع
              </li>
            ) : null}
            {policy.returnDays > 0 ? (
              <li className="flex items-center gap-2">
                <RotateCcw className="size-4 shrink-0 text-emerald-600" strokeWidth={SW} aria-hidden="true" /> استبدال واسترجاع خلال {policy.returnDays} يوماً
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <Lock className="size-4 shrink-0 text-emerald-600" strokeWidth={SW} aria-hidden="true" /> بياناتك محمية ولا نشاركها إلا مع شركة الشحن
            </li>
          </ul>
        ) : null}
      </aside>
    </div>
  );
}