"use client";

// الفواتير وإعداداتها في مكان واحد: أي تعديل (المقاس، اللون، الشعار، الأسعار، رمز QR، الملاحظة) يظهر على
// الفواتير فوراً، ويُحفظ في الخلفية لتطبَّق نفس الإعدادات على كل فاتورة لاحقة.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, Printer, Settings2, AlertCircle } from "lucide-react";
import { formatEgp } from "@/lib/money";
import { saveInvoiceSettingsAction } from "@/server/actions/invoice";
import type { StoreBlueprint } from "@/blueprint/schema";

type Invoice = StoreBlueprint["invoice"];

export type InvoiceOrder = {
  id: string;
  code: string;
  date: string;
  customerName: string;
  phones: string;
  address: string;
  notes: string | null;
  lines: { id: string; name: string; variant: string | null; qty: number; unit: number }[];
  subtotal: number;
  shipping: number;
  codFee: number;
  discount: number;
  discountCode: string | null;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  shipment: string | null;
  qr: string;
};

type Brand = { name: string; logo: string | null; primary: string; contact: string };

const PAYMENT: Record<string, string> = { cod: "الدفع عند الاستلام", vodafone_cash: "فودافون كاش", instapay: "إنستاباي" };
const PAY_STATUS: Record<string, string> = { pending: "لم يُدفع بعد", under_review: "التحويل قيد المراجعة", confirmed: "مدفوع", rejected: "تحويل مرفوض", refunded: "مسترد" };
const PAGE: Record<Invoice["paperSize"], { size: string; width: string; font: string; label: string }> = {
  A5: { size: "A5", width: "136mm", font: "11px", label: "A5" },
  A4: { size: "A4", width: "190mm", font: "12px", label: "A4" },
  thermal80: { size: "80mm auto", width: "72mm", font: "10.5px", label: "حرارية 80مم" },
};
const SWATCHES = ["#111827", "#0f766e", "#1d4ed8", "#7c3aed", "#be123c", "#c2410c", "#a16207", "#15803d"];

type Save = "idle" | "saving" | "saved" | "error";

export function InvoiceSheets({ orders, autoPrint, initial, brand }: { orders: InvoiceOrder[]; autoPrint: boolean; initial: Invoice; brand: Brand }) {
  const [v, setV] = useState<Invoice>(initial);
  const [open, setOpen] = useState(false);
  const [save, setSave] = useState<Save>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!autoPrint || !orders.length) return;
    // ننتظر تحميل الشعار ورموز QR قبل فتح نافذة الطباعة.
    const t = window.setTimeout(() => window.print(), 700);
    return () => window.clearTimeout(t);
  }, [autoPrint, orders.length]);

  /** يطبّق التعديل فوراً، ويحفظه بعد توقف قصير (فالكتابة والسحب على اللون لا يرسلان طلباً لكل حرف). */
  const update = (patch: Partial<Invoice>, delay = 350) => {
    const next = { ...v, ...patch };
    setV(next);
    setSave("saving");
    setError(null);
    if (timer.current) window.clearTimeout(timer.current);
    const my = ++seq.current;
    timer.current = window.setTimeout(async () => {
      const r = await saveInvoiceSettingsAction(next).catch(() => ({ ok: false as const, error: "انقطع الاتصال، أعد المحاولة" }));
      if (my !== seq.current) return;
      if (r.ok) setSave("saved");
      else {
        setSave("error");
        setError(r.error);
      }
    }, delay);
  };

  const page = PAGE[v.paperSize] ?? PAGE.A5;
  const accent = v.accentColor ?? brand.primary;
  const thermal = v.paperSize === "thermal80";

  return (
    <div dir="rtl" className="invoice-root" style={{ ["--accent" as string]: accent, fontSize: page.font }}>
      <style>{`
        @page { size: ${page.size}; margin: ${thermal ? "4mm" : "10mm"}; }
        .invoice-root { background: #eef0f4; min-height: 100dvh; padding: 20px 12px 48px; color: #111827; font-family: var(--font-cairo), system-ui, sans-serif; }
        .inv { width: ${page.width}; max-width: 100%; margin: 0 auto 24px; background: #fff; padding: ${thermal ? "10px" : "22px 24px"}; border-radius: 10px; box-shadow: 0 6px 24px rgb(0 0 0 / .08); transition: width .25s ease; }
        .inv table { width: 100%; border-collapse: collapse; }
        .inv th { text-align: start; font-weight: 800; color: #6b7280; font-size: .85em; padding: 6px 4px; border-bottom: 2px solid var(--accent); }
        .inv td { padding: 7px 4px; border-bottom: 1px solid #eef0f4; vertical-align: top; }
        .inv .num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .ibar button { cursor: pointer; }
        .ibar .chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 10px; padding: 7px 11px; font-size: 12px; font-weight: 800; border: 1px solid rgb(255 255 255 / .14); background: rgb(255 255 255 / .06); color: #fff; }
        .ibar .chip[aria-pressed="true"] { background: #fff; color: #111827; border-color: #fff; }
        @media print {
          .invoice-root { background: #fff; padding: 0; }
          .inv { box-shadow: none; border-radius: 0; margin: 0 auto; padding: 0; page-break-after: always; break-after: page; }
          .inv:last-of-type { page-break-after: auto; break-after: auto; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print ibar" style={{ position: "sticky", top: 8, zIndex: 10, maxWidth: 780, margin: "0 auto 18px", background: "#111827", color: "#fff", borderRadius: 14, padding: "10px 12px", boxShadow: "0 10px 30px rgb(0 0 0 / .18)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <Link href="/dashboard/orders" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, opacity: 0.85 }}>
            <ArrowRight size={16} /> الطلبات
          </Link>
          <span style={{ fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {orders.length ? `${orders.length} فاتورة` : "لا توجد طلبات بهذه الأرقام"}
            <SaveBadge state={save} />
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="chip" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-pressed={open}>
              <Settings2 size={15} /> تخصيص الفاتورة
            </button>
            <button type="button" className="chip" aria-pressed onClick={() => window.print()} disabled={!orders.length}>
              <Printer size={15} /> اطبع أو احفظ PDF
            </button>
          </div>
        </div>

        {open ? (
          <div style={{ marginTop: 12, display: "grid", gap: 12, fontSize: 12, borderTop: "1px solid rgb(255 255 255 / .1)", paddingTop: 12 }}>
            <Row label="مقاس الورق">
              {(Object.keys(PAGE) as Invoice["paperSize"][]).map((p) => (
                <button key={p} type="button" className="chip" aria-pressed={v.paperSize === p} onClick={() => update({ paperSize: p }, 0)}>
                  {PAGE[p].label}
                </button>
              ))}
            </Row>
            <Row label="يظهر في الفاتورة">
              <Toggle on={v.showPrices} onClick={() => update({ showPrices: !v.showPrices }, 0)}>الأسعار</Toggle>
              <Toggle on={v.showLogo} onClick={() => update({ showLogo: !v.showLogo }, 0)} disabled={!brand.logo} title={brand.logo ? undefined : "أضف شعاراً من إعدادات المتجر أولاً"}>
                الشعار
              </Toggle>
              <Toggle on={v.showQr} onClick={() => update({ showQr: !v.showQr }, 0)}>رمز تتبع الطلب</Toggle>
            </Row>
            <Row label="لون الفاتورة">
              <button type="button" className="chip" aria-pressed={!v.accentColor} onClick={() => update({ accentColor: undefined }, 0)}>
                <span style={{ width: 14, height: 14, borderRadius: 99, background: brand.primary, border: "1px solid rgb(255 255 255 / .4)" }} /> لون متجرك
              </button>
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`اللون ${c}`}
                  aria-pressed={v.accentColor?.toLowerCase() === c}
                  onClick={() => update({ accentColor: c }, 0)}
                  style={{ width: 26, height: 26, borderRadius: 99, background: c, border: v.accentColor?.toLowerCase() === c ? "2px solid #fff" : "1px solid rgb(255 255 255 / .25)", boxShadow: v.accentColor?.toLowerCase() === c ? "0 0 0 2px #111827, 0 0 0 4px #fff" : undefined }}
                />
              ))}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }} className="chip">
                لون آخر
                <input type="color" value={accent} onChange={(e) => update({ accentColor: e.target.value }, 500)} aria-label="اختر لوناً" style={{ width: 26, height: 20, background: "transparent", border: 0, padding: 0 }} />
              </label>
            </Row>
            <Row label="ملاحظة أسفل الفاتورة">
              <input
                value={v.footerNote}
                maxLength={200}
                placeholder="مثال: الاستبدال خلال 14 يوماً مع الفاتورة"
                onChange={(e) => update({ footerNote: e.target.value }, 700)}
                style={{ flex: 1, minWidth: 220, background: "rgb(255 255 255 / .08)", color: "#fff", borderRadius: 10, padding: "8px 10px", border: "1px solid rgb(255 255 255 / .15)", fontSize: 13 }}
              />
              <span style={{ opacity: 0.55, fontSize: 11 }}>{v.footerNote.length}/200</span>
            </Row>
            {error ? (
              <p style={{ display: "flex", alignItems: "center", gap: 6, color: "#fecaca", fontWeight: 700 }}>
                <AlertCircle size={14} /> {error}
              </p>
            ) : (
              <p style={{ opacity: 0.6 }}>التعديلات تظهر على الفواتير فوراً وتُحفظ لكل فاتورة قادمة.</p>
            )}
          </div>
        ) : null}
      </div>

      {orders.map((o) => (
        <article key={o.id} className="inv">
          <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexDirection: thermal ? "column" : "row" }}>
            <div>
              {v.showLogo && brand.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo} alt={brand.name} style={{ height: 42, width: "auto", objectFit: "contain", marginBottom: 6 }} />
              ) : null}
              <div style={{ fontSize: "1.45em", fontWeight: 900, color: "var(--accent)" }}>{brand.name}</div>
              <div style={{ color: "#6b7280", fontSize: ".9em" }}>{brand.contact}</div>
            </div>
            <div style={{ textAlign: thermal ? "start" : "end" }}>
              <div style={{ fontWeight: 900, fontSize: "1.15em" }}>فاتورة</div>
              <div style={{ fontFamily: "monospace", fontWeight: 800 }}>{o.code}</div>
              <div style={{ color: "#6b7280" }}>{o.date}</div>
            </div>
          </header>

          <section style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "#f8f9fb", lineHeight: 1.8, borderInlineStart: "3px solid var(--accent)" }}>
            <div style={{ fontWeight: 800 }}>{o.customerName}</div>
            <div dir="ltr" style={{ textAlign: "end", fontFamily: "monospace" }}>{o.phones}</div>
            <div>{o.address}</div>
            {o.notes ? <div style={{ color: "#6b7280" }}>ملاحظة: {o.notes}</div> : null}
          </section>

          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>المنتج</th>
                <th className="num">الكمية</th>
                {v.showPrices ? <th className="num">السعر</th> : null}
                {v.showPrices ? <th className="num">الإجمالي</th> : null}
              </tr>
            </thead>
            <tbody>
              {o.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{l.name}</div>
                    {l.variant ? <div style={{ color: "#6b7280", fontSize: ".9em" }}>{l.variant}</div> : null}
                  </td>
                  <td className="num">{l.qty}</td>
                  {v.showPrices ? <td className="num">{formatEgp(l.unit)}</td> : null}
                  {v.showPrices ? <td className="num">{formatEgp(l.unit * l.qty)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>

          {v.showPrices ? (
            <section style={{ marginTop: 10, marginInlineStart: "auto", width: thermal ? "100%" : "60%", lineHeight: 2 }}>
              <Money label="المجموع" value={formatEgp(o.subtotal)} />
              <Money label="الشحن" value={o.shipping ? formatEgp(o.shipping) : "مجاني"} />
              {o.codFee ? <Money label="رسوم التحصيل" value={formatEgp(o.codFee)} /> : null}
              {o.discount ? <Money label={`خصم${o.discountCode ? ` (${o.discountCode})` : ""}`} value={`- ${formatEgp(o.discount)}`} /> : null}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid var(--accent)", marginTop: 4, paddingTop: 4, fontWeight: 900, fontSize: "1.15em" }}>
                <span>الإجمالي</span>
                <span className="num" style={{ color: "var(--accent)" }}>{formatEgp(o.total)}</span>
              </div>
            </section>
          ) : null}

          <footer style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
            <div style={{ lineHeight: 1.9 }}>
              <div>
                <b>الدفع:</b> {PAYMENT[o.paymentMethod] ?? o.paymentMethod} · {PAY_STATUS[o.paymentStatus] ?? o.paymentStatus}
              </div>
              {o.shipment ? (
                <div>
                  <b>الشحنة:</b> {o.shipment}
                </div>
              ) : null}
              {v.footerNote ? <div style={{ marginTop: 6, color: "var(--accent)", fontWeight: 700 }}>{v.footerNote}</div> : null}
            </div>
            {v.showQr && o.qr ? (
              <div style={{ textAlign: "center", fontSize: ".75em", color: "#6b7280" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.qr} alt="رمز تتبع الطلب" style={{ width: thermal ? 72 : 84, height: thermal ? 72 : 84 }} />
                <div>تتبع طلبك</div>
              </div>
            ) : null}
          </footer>
        </article>
      ))}
    </div>
  );
}

function SaveBadge({ state }: { state: Save }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: <Loader2 size={13} className="animate-spin" />, text: "يحفظ", color: "#cbd5e1" },
    saved: { icon: <Check size={13} />, text: "حُفظ", color: "#86efac" },
    error: { icon: <AlertCircle size={13} />, text: "لم يُحفظ", color: "#fca5a5" },
  } as const;
  const m = map[state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: m.color }} aria-live="polite">
      {m.icon} {m.text}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ opacity: 0.7, minWidth: 96 }}>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, children, ...rest }: { on: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="chip" aria-pressed={on} {...rest} style={rest.disabled ? { opacity: 0.45 } : undefined}>
      {on ? <Check size={13} /> : null} {children}
    </button>
  );
}

function Money({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
