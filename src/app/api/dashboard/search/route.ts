// GET /api/dashboard/search?q= — بحث لوحة الأوامر في طلبات المتجر ومنتجاته وعملائه.
import { NextResponse } from "next/server";
import { getMerchantSession } from "@/server/auth";
import { dashboardSearch } from "@/server/repos/dashboard-search";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const session = await getMerchantSession();
  if (!session?.storeId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ hits: await dashboardSearch(session.storeId, q) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
