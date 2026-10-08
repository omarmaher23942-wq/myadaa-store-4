// lib/pusher-server.ts — طبقة Pusher موحّدة للسيرفر.
//
// السبب الجذري:
// Pusher كان مضافاً في .env لكن غير مستخدم في أي مكان. الملف ده يعرّف
// عميل server-side واحد، وأحداث type-safe مشتركة مع العميل عبر src/server/realtime/events.
//
// المبادئ:
//  - صفر `any` — كل حدث له type صارم.
//  - فشل Pusher لا يكسر الطلب أبداً (best-effort، fire-and-forget مع log).
//  - يتعامل بأمان مع غياب المفاتيح (dev mode) — يسجّل warn ويتجاهل.
import "server-only";
import Pusher from "pusher";
import { log } from "@/lib/logger";
import { buildChannelName, type RealtimeEvent } from "@/server/realtime/events";

let client: Pusher | null = null;
let warnedMissing = false;

function getClient(): Pusher | null {
  if (client) return client;

  const rawEnv = process.env as Record<string, string | undefined>;
  const appId = rawEnv.PUSHER_APP_ID;
  const key = rawEnv.PUSHER_KEY;
  const secret = rawEnv.PUSHER_SECRET;
  const cluster = rawEnv.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    if (!warnedMissing) {
      warnedMissing = true;
      // لا نرمي خطأ: في dev mode قد يكون Pusher غير مفعّل.
      // في production، env validator سيرفض الإقلاع إذا كانت المفاتيح إلزامية.
      console.warn(
        "[pusher-server] Pusher credentials missing — real-time disabled."
      );
    }
    return null;
  }

  client = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
  return client;
}

/**
 * ينشر حدثاً في قناة محددة. best-effort: أي فشل يُسجَّل ولا يرمي.
 * الاستدعاء من Server Actions / Route Handlers / Workflows.
 */
export async function publishEvent<E extends RealtimeEvent["name"]>(
  eventName: E,
  channelKey: string,
  payload: Extract<RealtimeEvent, { name: E }>["data"],
  options: { reqId?: string; storeId?: string; merchantId?: string } = {}
): Promise<void> {
  const p = getClient();
  if (!p) return;

  const channel = buildChannelName(eventName, channelKey);

  try {
    await p.trigger(channel, eventName, {
      ...payload,
      _meta: {
        at: new Date().toISOString(),
        reqId: options.reqId,
        storeId: options.storeId,
        merchantId: options.merchantId,
      },
    });
  } catch (err) {
    // فشل Pusher لا يجب أن يكسر العملية الأصلية.
    await log.warn(
      "ops",
      "pusher_publish_failed",
      {
        reqId: options.reqId ?? undefined,
        storeId: options.storeId ?? undefined,
        merchantId: options.merchantId ?? undefined,
      },
      `فشل نشر الحدث ${eventName} على ${channel}`,
      err
    );
  }
}

/**
 * ينشر حدثاً لعدة قنوات دفعة واحدة (bulk).
 * مفيد للإشعارات الجماعية (broadcast).
 */
export async function publishBatch(
  events: Array<{
    eventName: RealtimeEvent["name"];
    channelKey: string;
    payload: unknown;
    options?: { reqId?: string; storeId?: string; merchantId?: string };
  }>
): Promise<void> {
  if (events.length === 0) return;
  await Promise.all(
    events.map((e) =>
      publishEvent(
        e.eventName,
        e.channelKey,
        e.payload as Extract<RealtimeEvent, { name: typeof e.eventName }>["data"],
        e.options
      )
    )
  );
}

/**
 * التحقق من التوقيع على قنوات presence/private.
 * يُستدعى من /api/pusher/auth.
 */
export function authorizeChannel(
  socketId: string,
  channel: string,
  userData?: { id: string; name?: string; avatarUrl?: string }
): { auth: string; channel_data?: string } | null {
  const p = getClient();
  if (!p) return null;

  try {
    if (channel.startsWith("presence-")) {
      return p.authorizeChannel(socketId, channel, {
        user_id: userData?.id ?? socketId,
        user_info: {
          name: userData?.name,
          avatarUrl: userData?.avatarUrl,
        },
      });
    }
    return p.authorizeChannel(socketId, channel);
  } catch {
    return null;
  }
}

export { getClient as getPusherClient };