// /api/live — عدّاد "يشاهد الآن" للمتجر. المتجر من النطاق فقط، والزائر بمعرّف محدود الطول.
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { allow, clientIp } from "@/lib/ratelimit";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { isBot, isStoreOwner, visitorOf } from "@/server/visitor";

const WINDOW_MS = 5 * 60_000;

async function handle(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  if (!store || !isStorePubliclyVisible(store)) return NextResponse.json({ viewers: 0 });

  const key = `live:${store.id}`;
  try {
    // "يشاهد الآن" بعدد الأجهزة الحقيقية (نفس هوية التحليلات)، بلا برامج الفحص ولا صاحب المتجر.
    const counted = req.method === "POST" && !isBot(req.headers) && !isStoreOwner(req.headers);
    const vid = counted ? visitorOf(req.headers, store.id).id : undefined;
    if (vid && (await allow("track_events", `live:${store.id}:${clientIp(req.headers)}`))) {
      const pipe = redis.pipeline();
      pipe.zadd(key, { score: Date.now(), member: vid });
      pipe.zremrangebyscore(key, 0, Date.now() - WINDOW_MS);
      pipe.expire(key, 600);
      await pipe.exec();
    }
    const viewers = await redis.zcount(key, Date.now() - WINDOW_MS, "+inf");
    return NextResponse.json({ viewers });
  } catch {
    return NextResponse.json({ viewers: 0 });
  }
}

export const POST = handle;
export const GET = handle;
