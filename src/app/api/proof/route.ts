// /api/proof — الإثبات الاجتماعي الحقيقي (طلبات حديثة) لمتجر النطاق الحالي فقط، بكاش دقيقتين.
import { NextResponse } from "next/server";
import { cached, rkeys } from "@/lib/redis";
import { recentOrderProof } from "@/server/repos/catalog";
import { getStoreBySubdomain, getBlueprintOrNull, isStorePubliclyVisible } from "@/lib/tenant";

export async function GET(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  if (!store || !isStorePubliclyVisible(store)) return NextResponse.json([]);

  const bp = await getBlueprintOrNull(store.id);
  const c = bp?.conversion.socialProofToasts;
  if (!c?.enabled) return NextResponse.json([]);

  const rows = await cached(rkeys.recentOrdersProof(store.id), 120, () =>
    recentOrderProof(store.id, c.lookbackHours, c.minOrdersToShow)
  );
  return NextResponse.json(rows);
}
