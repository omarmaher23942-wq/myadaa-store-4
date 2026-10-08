// lib/pusher-client.ts — عميل Pusher للمتصفح.
//
// ملاحظة معمارية:
// pusher-js مع authTransport:"ajax" يرسل الـ auth request كـ
// application/x-www-form-urlencoded. الـ route /api/pusher/auth
// مصمّم الآن ليقبل هذه الصيغة + JSON. لا حاجة لتغيير الـ transport.
//
// المبادئ:
//  - singleton واحد لكل tab.
//  - lazy init (لا يتصل حتى يحتاجه أول useRealtimeChannel).
//  - unsubscribe آمن (يحذف القناة إذا كانت آخر subscription عليها).
import Pusher, {
  type Channel,
  type PresenceChannel,
  type Members,
} from "pusher-js";

type ChannelName = string;
type EventCallback<T = unknown> = (data: T) => void;

type Subscription = {
  eventName: string;
  callback: EventCallback;
};

let pusherInstance: Pusher | null = null;
const subscriptions = new Map<ChannelName, Set<Subscription>>();

/**
 * الحصول على singleton Pusher. يُنشأ عند أول استدعاء.
 * يعيد null في حالة عدم توفر المفاتيح (dev mode بدون Pusher).
 */
export function getPusher(): Pusher | null {
  if (pusherInstance) return pusherInstance;
  if (typeof window === "undefined") return null;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[pusher-client] NEXT_PUBLIC_PUSHER_KEY or CLUSTER missing — real-time disabled."
      );
    }
    return null;
  }

  pusherInstance = new Pusher(key, {
    cluster,
    authEndpoint: "/api/pusher/auth",
    authTransport: "ajax",
    forceTLS: true,
    enabledTransports: ["ws", "wss"],
    activityTimeout: 30_000,
    pongTimeout: 10_000,
  });

  pusherInstance.connection.bind("error", (err: unknown) => {
    console.error("[pusher-client] connection error", err);
  });

  return pusherInstance;
}

/**
 * الاشتراك في قناة. يُعيد دالة unsubscribe.
 * آمنة للاستدعاء المتكرر — تُصفّي الاشتراكات المكررة.
 */
export function subscribe<T = unknown>(
  channelName: string,
  eventName: string,
  callback: EventCallback<T>
): () => void {
  const p = getPusher();
  if (!p) return () => {};

  let set = subscriptions.get(channelName);
  let channel: Channel | null = p.channel(channelName) as Channel | null;

  if (!channel) {
    channel = p.subscribe(channelName) as Channel;
  }

  if (!set) {
    set = new Set();
    subscriptions.set(channelName, set);
  }

  const sub: Subscription = {
    eventName,
    callback: callback as EventCallback,
  };
  set.add(sub);

  channel.bind(eventName, callback as EventCallback);

  return () => {
    const s = subscriptions.get(channelName);
    if (!s) return;
    s.delete(sub);
    channel?.unbind(eventName, callback as EventCallback);
    if (s.size === 0) {
      p.unsubscribe(channelName);
      subscriptions.delete(channelName);
    }
  };
}

/**
 * الاشتراك في presence channel — يُعيد كائن بمعاملات الأعضاء.
 */
export function subscribePresence(
  channelName: string,
  handlers: {
    onMemberAdded?: (member: { id: string; info?: unknown }) => void;
    onMemberRemoved?: (member: { id: string; info?: unknown }) => void;
    onSubscriptionSucceeded?: (members: Members) => void;
  }
): () => void {
  const p = getPusher();
  if (!p) return () => {};

  const channel = p.subscribe(channelName) as PresenceChannel;

  if (handlers.onSubscriptionSucceeded) {
    channel.bind(
      "pusher:subscription_succeeded",
      (members: Members) => handlers.onSubscriptionSucceeded?.(members)
    );
  }
  if (handlers.onMemberAdded) {
    channel.bind(
      "pusher:member_added",
      (member: { id: string; info?: unknown }) => handlers.onMemberAdded?.(member)
    );
  }
  if (handlers.onMemberRemoved) {
    channel.bind(
      "pusher:member_removed",
      (member: { id: string; info?: unknown }) => handlers.onMemberRemoved?.(member)
    );
  }

  return () => {
    channel.unbind_all();
    p.unsubscribe(channelName);
  };
}

/** حالة الاتصال الحالية. */
export function getConnectionState():
  | "connected"
  | "connecting"
  | "disconnected"
  | "unavailable"
  | "failed" {
  const p = getPusher();
  if (!p) return "unavailable";
  const s = p.connection.state;
  if (s === "connected") return "connected";
  if (s === "connecting") return "connecting";
  if (s === "disconnected") return "disconnected";
  if (s === "failed") return "failed";
  return "unavailable";
}

/** قطع الاتصال (يُستدعى عند logout). */
export function disconnect() {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
    subscriptions.clear();
  }
}