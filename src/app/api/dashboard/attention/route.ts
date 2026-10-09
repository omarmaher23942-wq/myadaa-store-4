// GET /api/dashboard/attention?since=ISO — نبض لوحة التاجر: ما يحتاج انتباهه الآن، والطلبات التي وصلت منذ since.
// تسأله اللوحة دورياً من أي صفحة، فيعمل تنبيه الطلب الجديد وشارات القائمة بلا خدمة وقت فعلي.
import { NextResponse } from "next/server";
import { getMerchantSession } from "@/server/auth";
import { attentionSnapshot } from "@/server/repos/attention";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
/** أقصى عمر مقبول لـ since: تبويب نام طويلاً يبدأ خطاً جديداً بدل أن يعيد تنبيهات قديمة. */
const MAX_SINCE_AGE_MS = 6 * 3600e3;

export async function GET(req: Request) {
  const session = await getMerchantSession();
  if (!session?.storeId) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const raw = new URL(req.url).searchParams.get("since");
  const parsed = raw ? new Date(raw) : null;
  const since =
    parsed && !Number.isNaN(parsed.getTime()) && Date.now() - parsed.getTime() < MAX_SINCE_AGE_MS ? parsed : null;

  try {
    return NextResponse.json(await attentionSnapshot(session.storeId, since), { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
