// GET /api/dashboard/customers/export — تصدير عملاء المتجر إلى ملف يفتح في Excel.
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getMerchantSession } from "@/server/auth";
import { getTenantDb } from "@/db/tenant";
import { customers } from "@/db/schema";
import { GOVERNORATES } from "@/lib/egypt";
import { csvResponse, egpCell, toCsv } from "@/server/csv";

export const dynamic = "force-dynamic";

const GOV = new Map(GOVERNORATES.map((g) => [g.code as string, g.name as string]));

export async function GET() {
  const session = await getMerchantSession();
  if (!session?.storeId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await getTenantDb(session.storeId);
  const rows = await db.select().from(customers).where(eq(customers.storeId, session.storeId)).orderBy(desc(customers.lastOrderAt)).limit(20_000);

  const csv = toCsv(
    ["الاسم", "الموبايل", "موبايل بديل", "البريد", "المحافظة", "المدينة", "العنوان", "عدد الطلبات", "إجمالي المشتريات", "آخر طلب", "أول ظهور", "محظور"],
    rows.map((c) => [
      c.name,
      c.phone,
      c.altPhone,
      c.email,
      c.governorate ? GOV.get(c.governorate) ?? c.governorate : "",
      c.city,
      c.address,
      c.ordersCount,
      egpCell(c.totalSpentPiasters),
      c.lastOrderAt,
      c.createdAt,
      c.isBlocked ? "نعم" : "",
    ])
  );
  return csvResponse("customers", csv);
}
