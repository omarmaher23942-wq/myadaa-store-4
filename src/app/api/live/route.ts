// /api/live — عدّاد "يشاهد الآن" للمتجر. المتجر من النطاق فقط، والزائر بمعرّف محدود الطول.
import { NextResponse } from "next/server";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { allow, clientIp } from "@/lib/ratelimit";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";

const WINDOW_MS = 5 * 60_000;
const body = z.object({ vid: z.string().min(8).max(64).optional() });

async function handle(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  if (!store || !isStorePubliclyVisible(store)) return NextResponse.json({ viewers: 0 });

  const key = `live:${store.id}`;
  try {
    const parsed = req.method === "POST" ? body.safeParse(await req.json().catch(() => ({}))) : null;
    const vid = parsed?.success ? parsed.data.vid : undefined;
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
