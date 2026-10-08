// app/api/dashboard/analytics/export/route.ts
// يُصدّر تقرير تحليلات شامل كملف CSV (متوافق مع Excel العربي عبر BOM).
//
// السبب: في السابق كان الزر في صفحة Analytics يشير إلى
// /dashboard/analytics/export كصفحة، لكن لا توجد route. الآن هو route
// handler حقيقي يُعيد attachment CSV.
import { NextResponse } from "next/server";
import { getMerchantSession } from "@/server/auth";
import {
  getConversionFunnelV2,
  getGeoHeatmap,
  getHourlyPeaks,
} from "@/server/repos/analytics-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: string): string {
  const needsQuotes = /[",\n]/.test(v);
  const cleaned = v.replace(/"/g, '""');
  return needsQuotes ? `"${cleaned}"` : cleaned;
}

export async function GET(req: Request) {
  const session = await getMerchantSession();
  if (!session || !session.storeId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  const days = Math.min(Math.max(parseInt(daysParam ?? "30", 10) || 30, 1), 365);

  const [funnel, geo, hourly] = await Promise.all([
    getConversionFunnelV2(session.storeId, days),
    getGeoHeatmap(session.storeId, days),
    getHourlyPeaks(session.storeId, days),
  ]);

  const lines: string[] = [];
  // BOM لإظهار العربية بشكل صحيح في Excel.
  lines.push("\uFEFF");
  lines.push(`تقرير أداء المتجر — آخر ${days} يوماً`);
  lines.push(`تاريخ التصدير: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("قمع التحويل");
  lines.push("المرحلة,العدد");
  lines.push(`زيارات المتجر,${funnel.visits}`);
  lines.push(`مشاهدات المنتجات,${funnel.productViews}`);
  lines.push(`إضافة للسلة,${funnel.atc}`);
  lines.push(`بدء الدفع,${funnel.checkoutStarted}`);
  lines.push(`طلبات مؤكدة,${funnel.confirmed}`);
  lines.push(`طلبات مسلمة,${funnel.delivered}`);
  lines.push("");

  lines.push("المبيعات حسب المحافظة");
  lines.push("المحافظة,عدد الطلبات,الإيرادات (ج.م)");
  for (const g of geo) {
    lines.push(
      [
        csvEscape(String(g.governorate ?? "")),
        String(g.ordersCount ?? 0),
        String((g.revenue ?? 0) / 100),
      ].join(",")
    );
  }
  lines.push("");

  lines.push("أوقات الذروة");
  lines.push("الساعة,عدد الطلبات");
  for (const h of hourly) {
    lines.push(`${h.hour},${h.count}`);
  }

  const csv = lines.join("\n");
  const filename = `analytics-${session.store?.subdomain ?? "store"}-${days}d-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}