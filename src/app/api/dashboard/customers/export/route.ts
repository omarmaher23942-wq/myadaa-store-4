// GET /api/dashboard/customers/export — تصدير عملاء المتجر إلى ملف يفتح في Excel، بنفس أرقام صفحة العملاء
// (محسوبة من الطلبات: المستلَم ومجموعه والجاري والمرتجع؛ بلا طلبات التجربة).
import { NextResponse } from "next/server";
import { getMerchantSession } from "@/server/auth";
import { customersForExport } from "@/server/repos/customers-list";
import { GOVERNORATES } from "@/lib/egypt";
import { csvResponse, egpCell, toCsv } from "@/server/csv";

export const dynamic = "force-dynamic";

const GOV = new Map(GOVERNORATES.map((g) => [g.code as string, g.name as string]));

export async function GET() {
  const session = await getMerchantSession();
  if (!session?.storeId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await customersForExport(session.storeId);

  const csv = toCsv(
    ["الاسم", "الموبايل", "موبايل بديل", "البريد", "المحافظة", "المدينة", "العنوان", "كل الطلبات", "طلبات مستلمة", "طلبات جارية", "مرتجعات", "مشتريات (مستلمة)", "آخر طلب", "أول ظهور", "محظور", "ملاحظاتك"],
    rows.map((c) => [
      c.name,
      c.phone,
      c.altPhone,
      c.email,
      c.governorate ? (GOV.get(c.governorate) ?? c.governorate) : "",
      c.city,
      c.address,
      c.orders,
      c.delivered,
      c.open,
      c.returned,
      egpCell(c.spentPiasters),
      c.lastOrderAt ? new Date(c.lastOrderAt) : null,
      new Date(c.createdAt),
      c.isBlocked ? "نعم" : "",
      c.notes,
    ])
  );
  return csvResponse("customers", csv);
}
