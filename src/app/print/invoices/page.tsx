// /print/invoices?ids=a,b,c — فواتير الطلبات للطباعة أو الحفظ PDF (فاتورة لكل صفحة).
// مقاس الورق ولون الفاتورة والشعار والملاحظة ورمز QR من إعدادات الفاتورة في المتجر (bp.invoice).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders } from "@/db/schema";
import { getBlueprint } from "@/lib/tenant";
import { formatEgp } from "@/lib/money";
import { GOVERNORATES } from "@/lib/egypt";
import { storeUrl } from "@/lib/utils";
import { PrintBar } from "./PrintBar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الفواتير", robots: { index: false, follow: false } };

const PAYMENT: Record<string, string> = { cod: "الدفع عند الاستلام", vodafone_cash: "فودافون كاش", instapay: "إنستاباي" };
const PAY_STATUS: Record<string, string> = { pending: "لم يُدفع بعد", under_review: "التحويل قيد المراجعة", confirmed: "مدفوع", rejected: "تحويل مرفوض", refunded: "مسترد" };
const GOV = new Map(GOVERNORATES.map((g) => [g.code as string, g.name as string]));
const UUID = /^[0-9a-f-]{36}$/i;

const PAGE: Record<string, { size: string; width: string; font: string }> = {
  A4: { size: "A4", width: "190mm", font: "12px" },
  A5: { size: "A5", width: "136mm", font: "11px" },
  thermal80: { size: "80mm auto", width: "72mm", font: "10.5px" },
};

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ ids?: string; print?: string }> }) {
  const sp = await searchParams;
  const ids = (sp.ids ?? "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s)).slice(0, 100);
  const session = await getMerchantSession();
  if (!session?.store) redirect(`/login?redirect=${encodeURIComponent(`/print/invoices?ids=${ids.join(",")}`)}`);
  const store = session.store;
  if (!ids.length) redirect("/dashboard/orders");

  const db = await getTenantDb(store.id);
  const [rows, items, bp] = await Promise.all([
    db.select().from(orders).where(and(eq(orders.storeId, store.id), inArray(orders.id, ids))),
    db.select().from(orderItems).where(and(eq(orderItems.storeId, store.id), inArray(orderItems.orderId, ids))),
    getBlueprint(store.id),
  ]);
  const inv = bp.invoice;
  const page = PAGE[inv.paperSize] ?? PAGE.A5!;
  const accent = inv.accentColor ?? bp.theme.palette.primary;
  const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => Boolean(r));
  const qrs = inv.showQr
    ? await Promise.all(ordered.map((o) => QRCode.toDataURL(storeUrl(store.subdomain, `/track?code=${encodeURIComponent(o.code)}`), { margin: 0, width: 160 }).catch(() => "")))
    : [];
  const thermal = inv.paperSize === "thermal80";

  return (
    <div dir="rtl" className="invoice-root" style={{ ["--accent" as string]: accent, fontSize: page.font }}>
      <style>{`
        @page { size: ${page.size}; margin: ${thermal ? "4mm" : "10mm"}; }
        .invoice-root { background: #f1f2f6; min-height: 100dvh; padding: 24px 12px 48px; color: #111827; font-family: var(--font-cairo), system-ui, sans-serif; }
        .inv { width: ${page.width}; max-width: 100%; margin: 0 auto 24px; background: #fff; padding: ${thermal ? "10px" : "22px 24px"}; border-radius: 10px; box-shadow: 0 6px 24px rgb(0 0 0 / .08); }
        .inv table { width: 100%; border-collapse: collapse; }
        .inv th { text-align: start; font-weight: 800; color: #6b7280; font-size: .85em; padding: 6px 4px; border-bottom: 2px solid var(--accent); }
        .inv td { padding: 7px 4px; border-bottom: 1px solid #eef0f4; vertical-align: top; }
        .inv .num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
        @media print {
          .invoice-root { background: #fff; padding: 0; }
          .inv { box-shadow: none; border-radius: 0; margin: 0 auto; padding: 0; page-break-after: always; break-after: page; }
          .inv:last-of-type { page-break-after: auto; break-after: auto; }
          .no-print { display: none !important; }
        }
      `}</style>

      <PrintBar count={ordered.length} autoPrint={sp.print === "1"} invoice={inv} />

      {ordered.map((o, idx) => {
        const lines = items.filter((it) => it.orderId === o.id);
        return (
          <article key={o.id} className="inv">
            <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexDirection: thermal ? "column" : "row" }}>
              <div>
                {inv.showLogo && bp.brand.logo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bp.brand.logo.url} alt={bp.brand.name} style={{ height: 42, width: "auto", objectFit: "contain", marginBottom: 6 }} />
                ) : null}
                <div style={{ fontSize: "1.45em", fontWeight: 900, color: "var(--accent)" }}>{bp.brand.name}</div>
                <div style={{ color: "#6b7280", fontSize: ".9em" }}>
                  {[bp.channels.phone, bp.channels.whatsappNumber !== bp.channels.phone ? bp.channels.whatsappNumber : null, storeUrl(store.subdomain).replace(/^https?:\/\//, "")].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ textAlign: thermal ? "start" : "end" }}>
                <div style={{ fontWeight: 900, fontSize: "1.15em" }}>فاتورة</div>
                <div style={{ fontFamily: "monospace", fontWeight: 800 }}>{o.code}</div>
                <div style={{ color: "#6b7280" }}>{o.createdAt.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}</div>
              </div>
            </header>

            <section style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "#f8f9fb", lineHeight: 1.8 }}>
              <div style={{ fontWeight: 800 }}>{o.customerName}</div>
              <div dir="ltr" style={{ textAlign: "end", fontFamily: "monospace" }}>{o.customerPhone}{o.customerAltPhone ? ` / ${o.customerAltPhone}` : ""}</div>
              <div>{[GOV.get(o.governorate) ?? o.governorate, o.city, o.address, o.landmark].filter(Boolean).join("، ")}</div>
              {o.customerNotes ? <div style={{ color: "#6b7280" }}>ملاحظة: {o.customerNotes}</div> : null}
            </section>

            <table style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th className="num">الكمية</th>
                  {inv.showPrices ? <th className="num">السعر</th> : null}
                  {inv.showPrices ? <th className="num">الإجمالي</th> : null}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{l.name}</div>
                      {l.variantLabel ? <div style={{ color: "#6b7280", fontSize: ".9em" }}>{l.variantLabel}</div> : null}
                    </td>
                    <td className="num">{l.quantity}</td>
                    {inv.showPrices ? <td className="num">{formatEgp(l.unitPiasters)}</td> : null}
                    {inv.showPrices ? <td className="num">{formatEgp(l.unitPiasters * l.quantity)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>

            {inv.showPrices ? (
              <section style={{ marginTop: 10, marginInlineStart: "auto", width: thermal ? "100%" : "60%", lineHeight: 2 }}>
                <Row label="المجموع" value={formatEgp(o.subtotalPiasters)} />
                <Row label="الشحن" value={o.shippingPiasters ? formatEgp(o.shippingPiasters) : "مجاني"} />
                {o.codFeePiasters ? <Row label="رسوم التحصيل" value={formatEgp(o.codFeePiasters)} /> : null}
                {o.discountPiasters ? <Row label={`خصم${o.discountCode ? ` (${o.discountCode})` : ""}`} value={`- ${formatEgp(o.discountPiasters)}`} /> : null}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid var(--accent)", marginTop: 4, paddingTop: 4, fontWeight: 900, fontSize: "1.15em" }}>
                  <span>الإجمالي</span>
                  <span className="num">{formatEgp(o.totalPiasters)}</span>
                </div>
              </section>
            ) : null}

            <footer style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
              <div style={{ lineHeight: 1.9 }}>
                <div>
                  <b>الدفع:</b> {PAYMENT[o.paymentMethod] ?? o.paymentMethod} · {PAY_STATUS[o.paymentStatus] ?? o.paymentStatus}
                </div>
                {o.trackingNumber ? (
                  <div>
                    <b>الشحنة:</b> {[o.courierName, o.trackingNumber].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
                {inv.footerNote ? <div style={{ marginTop: 6, color: "var(--accent)", fontWeight: 700 }}>{inv.footerNote}</div> : null}
              </div>
              {qrs[idx] ? (
                <div style={{ textAlign: "center", fontSize: ".75em", color: "#6b7280" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrs[idx]} alt="رمز تتبع الطلب" style={{ width: thermal ? 72 : 84, height: thermal ? 72 : 84 }} />
                  <div>تتبع طلبك</div>
                </div>
              ) : null}
            </footer>
          </article>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
