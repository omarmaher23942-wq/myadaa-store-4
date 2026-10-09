// /api/storefront/my-orders — ملخص طلبات هذا الجهاز في متجر النطاق الحالي (لشارة «طلباتي» في رأس المتجر).
// الجهاز يُعرف بـ cookie الخادم وحده، فلا يمكن قراءة طلبات جهاز آخر.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { listDeviceOrders } from "@/server/repos/orders";
import { VISITOR_COOKIE } from "@/server/visitor";

export const dynamic = "force-dynamic";

const ACTIVE = new Set(["new", "confirmed", "preparing", "shipped"]);

export async function GET(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  const device = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!store || !isStorePubliclyVisible(store) || !device || !/^d-[0-9a-f]{32}$/.test(device))
    return NextResponse.json({ total: 0, active: 0 }, { headers: { "Cache-Control": "no-store" } });
  const rows = await listDeviceOrders(store.id, device, 50);
  return NextResponse.json(
    { total: rows.length, active: rows.filter((r) => ACTIVE.has(r.status)).length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
