// /api/track — استقبال أحداث التحليلات الذاتية دفعةً واحدة.
// المتجر يُحسم من النطاق (x-store-subdomain من الـ middleware) لا من جسم الطلب،
// فلا يستطيع أحد حقن أحداث أو مشاهدات في متجر آخر.
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { analyticsEvents, products } from "@/db/schema";
import { allow, clientIp } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { isBot, isStoreOwner, visitorOf } from "@/server/visitor";

const uuid = z.string().uuid();

const schema = z.object({
  vid: z.string().min(8).max(64).optional(),
  sid: z.string().min(8).max(64),
  events: z
    .array(
      z.object({
        name: z.enum(["page_view", "product_view", "add_to_cart", "begin_checkout", "purchase", "search"]),
        props: z.record(z.unknown()).optional(),
        path: z.string().max(300).optional(),
        referrer: z.string().max(500).optional(),
        utm: z.string().max(100).nullable().optional(),
        device: z.enum(["mobile", "tablet", "desktop"]).optional(),
        t: z.number(),
      })
    )
    .min(1)
    .max(50),
});

const productIdOf = (props?: Record<string, unknown>) => {
  const v = props?.productId;
  return typeof v === "string" && uuid.safeParse(v).success ? v : undefined;
};

export async function POST(req: Request) {
  const sub = req.headers.get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  if (!store || !isStorePubliclyVisible(store)) return NextResponse.json({ ok: false }, { status: 404 });

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { sid, events } = body.data;

  // لا نحسب برامج الفحص ولا صاحب المتجر وهو يتصفح متجره.
  if (isBot(req.headers) || isStoreOwner(req.headers)) return NextResponse.json({ ok: true });
  if (!(await allow("track_events", `${store.id}:${clientIp(req.headers)}`))) {
    return NextResponse.json({ ok: true });
  }
  // هوية الجهاز من الخادم لا من المتصفح: الزيارة تُحسب للجهاز مرة واحدة في اليوم.
  const visitor = visitorOf(req.headers, store.id);
  const vid = visitor.id;
  const db = await getTenantDb(store.id);

  // نقبل فقط معرّفات منتجات تخص هذا المتجر.
  const candidateIds = Array.from(
    new Set(events.map((e) => productIdOf(e.props)).filter((x): x is string => !!x))
  );
  const ownIds = candidateIds.length
    ? new Set(
        (
          await db
            .select({ id: products.id })
            .from(products)
            .where(and(eq(products.storeId, store.id), inArray(products.id, candidateIds)))
        ).map((r) => r.id)
      )
    : new Set<string>();

  await db.insert(analyticsEvents).values(
    events.map((e) => {
      const pid = productIdOf(e.props);
      return {
        storeId: store.id,
        visitorId: vid,
        sessionId: sid,
        name: e.name,
        path: e.path,
        referrer: e.referrer,
        utmSource: e.utm ?? undefined,
        device: e.device,
        productId: pid && ownIds.has(pid) ? pid : undefined,
        props: e.props,
      };
    })
  );

  const viewed = events
    .map((e) => (e.name === "product_view" ? productIdOf(e.props) : undefined))
    .filter((id): id is string => !!id && ownIds.has(id));

  const pipe = redis.pipeline();
  pipe.zadd(`live:${store.id}`, { score: Date.now(), member: vid });
  pipe.zremrangebyscore(`live:${store.id}`, 0, Date.now() - 5 * 60_000);
  pipe.expire(`live:${store.id}`, 600);
  for (const pid of viewed) pipe.incr(`pv:${store.id}:${pid}`);
  await pipe.exec();

  // ترحيل عدادات المشاهدة لقاعدة البيانات بشكل متقطع لتقليل الكتابة.
  if (viewed.length && Math.random() < 0.3) {
    for (const pid of new Set(viewed)) {
      const n = await redis.getdel<number>(`pv:${store.id}:${pid}`);
      if (n) {
        await db
          .update(products)
          .set({ viewCount: sql`${products.viewCount} + ${n}` })
          .where(and(eq(products.id, pid), eq(products.storeId, store.id)));
      }
    }
  }

  const res = NextResponse.json({ ok: true });
  if (visitor.setCookie) res.headers.append("Set-Cookie", visitor.setCookie);
  return res;
}
