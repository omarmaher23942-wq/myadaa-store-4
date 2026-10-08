// GET /api/dashboard/orders/export?status=&from=&to= — تصدير طلبات المتجر (بأصنافها) إلى ملف يفتح في Excel.
import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders } from "@/db/schema";
import { GOVERNORATES } from "@/lib/egypt";
import { csvResponse, egpCell, toCsv } from "@/server/csv";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { new: "جديد", confirmed: "مؤكد", preparing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", returned: "مرتجع", cancelled: "ملغي" };
const PAYMENT: Record<string, string> = { cod: "عند الاستلام", vodafone_cash: "فودافون كاش", instapay: "إنستاباي" };
const PAY_STATUS: Record<string, string> = { pending: "بانتظار الدفع", under_review: "قيد المراجعة", confirmed: "مدفوع", rejected: "مرفوض", refunded: "مسترد" };
const GOV = new Map(GOVERNORATES.map((g) => [g.code as string, g.name as string]));

export async function GET(req: Request) {
  const session = await getMerchantSession();
  if (!session?.storeId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const storeId = session.storeId;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const db = await getTenantDb(storeId);
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.storeId, storeId),
        eq(orders.isTest, false),
        status && STATUS[status] ? eq(orders.status, status as (typeof orders.status.enumValues)[number]) : undefined,
        from && !Number.isNaN(Date.parse(from)) ? gte(orders.createdAt, new Date(from)) : undefined,
        to && !Number.isNaN(Date.parse(to)) ? lte(orders.createdAt, new Date(to)) : undefined
      )
    )
    .orderBy(desc(orders.createdAt))
    .limit(10_000);

  const items = rows.length
    ? await db
        .select({ orderId: orderItems.orderId, name: orderItems.name, variant: orderItems.variantLabel, qty: orderItems.quantity })
        .from(orderItems)
        .where(and(eq(orderItems.storeId, storeId), inArray(orderItems.orderId, rows.map((r) => r.id))))
    : [];
  const byOrder = new Map<string, string[]>();
  for (const it of items) {
    const list = byOrder.get(it.orderId) ?? [];
    list.push(`${it.name}${it.variant ? ` (${it.variant})` : ""} × ${it.qty}`);
    byOrder.set(it.orderId, list);
  }

  const csv = toCsv(
    ["كود الطلب", "التاريخ", "الحالة", "العميل", "الموبايل", "المحافظة", "المدينة", "العنوان", "المنتجات", "المجموع", "الشحن", "رسوم التحصيل", "الخصم", "كود الخصم", "الإجمالي", "طريقة الدفع", "حالة الدفع", "شركة الشحن", "رقم الشحنة", "ملاحظات العميل"],
    rows.map((o) => [
      o.code,
      o.createdAt,
      STATUS[o.status] ?? o.status,
      o.customerName,
      o.customerPhone,
      GOV.get(o.governorate) ?? o.governorate,
      o.city,
      o.address,
      (byOrder.get(o.id) ?? []).join(" | "),
      egpCell(o.subtotalPiasters),
      egpCell(o.shippingPiasters),
      egpCell(o.codFeePiasters),
      egpCell(o.discountPiasters),
      o.discountCode,
      egpCell(o.totalPiasters),
      PAYMENT[o.paymentMethod] ?? o.paymentMethod,
      PAY_STATUS[o.paymentStatus] ?? o.paymentStatus,
      o.courierName,
      o.trackingNumber,
      o.customerNotes,
    ])
  );
  return csvResponse("orders", csv);
}
