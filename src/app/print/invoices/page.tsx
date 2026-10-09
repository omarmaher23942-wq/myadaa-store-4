// /print/invoices?ids=a,b,c — فواتير الطلبات للطباعة أو الحفظ PDF (فاتورة لكل صفحة).
// الخادم يجهّز البيانات فقط؛ الرسم وإعدادات الفاتورة (المقاس واللون والشعار والملاحظة ورمز QR) في المتصفح،
// فيظهر أي تعديل على الفاتورة فوراً ويُحفظ في الخلفية.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import QRCode from "qrcode";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders } from "@/db/schema";
import { readBlueprintFresh } from "@/lib/tenant";
import { GOVERNORATES } from "@/lib/egypt";
import { storeUrl } from "@/lib/utils";
import { InvoiceSheets, type InvoiceOrder } from "./InvoiceSheets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الفواتير", robots: { index: false, follow: false } };

const GOV = new Map(GOVERNORATES.map((g) => [g.code as string, g.name as string]));
const UUID = /^[0-9a-f-]{36}$/i;

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
    readBlueprintFresh(store.id),
  ]);
  const ordered = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is (typeof rows)[number] => Boolean(r));
  // رمز QR يُجهَّز دائماً، وإظهاره قرار في الإعدادات.
  const qrs = await Promise.all(
    ordered.map((o) => QRCode.toDataURL(storeUrl(store.subdomain, `/track?code=${encodeURIComponent(o.code)}`), { margin: 0, width: 160 }).catch(() => ""))
  );

  const data: InvoiceOrder[] = ordered.map((o, i) => ({
    id: o.id,
    code: o.code,
    date: o.createdAt.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }),
    customerName: o.customerName,
    phones: [o.customerPhone, o.customerAltPhone].filter(Boolean).join(" / "),
    address: [GOV.get(o.governorate) ?? o.governorate, o.city, o.address, o.landmark].filter(Boolean).join("، "),
    notes: o.customerNotes ?? null,
    lines: items
      .filter((it) => it.orderId === o.id)
      .map((it) => ({ id: it.id, name: it.name, variant: it.variantLabel ?? null, qty: it.quantity, unit: it.unitPiasters })),
    subtotal: o.subtotalPiasters,
    shipping: o.shippingPiasters,
    codFee: o.codFeePiasters,
    discount: o.discountPiasters,
    discountCode: o.discountCode ?? null,
    total: o.totalPiasters,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    shipment: [o.courierName, o.trackingNumber].filter(Boolean).join(" · ") || null,
    qr: qrs[i] ?? "",
  }));

  return (
    <InvoiceSheets
      orders={data}
      autoPrint={sp.print === "1"}
      initial={bp.invoice}
      brand={{
        name: bp.brand.name,
        logo: bp.brand.logo?.url ?? null,
        primary: bp.theme.palette.primary,
        contact: [bp.channels.phone, bp.channels.whatsappNumber !== bp.channels.phone ? bp.channels.whatsappNumber : null, storeUrl(store.subdomain).replace(/^https?:\/\//, "")]
          .filter(Boolean)
          .join(" · "),
      }}
    />
  );
}
