// lib/realtime-hooks.ts — React hooks for real-time subscriptions.
//
// السبب الجذري:
// كل component كان يستدعي subscribe/unsubscribe يدوياً → أخطاء cleanup،
// stale closures، تسريبات ذاكرة عند unmount أثناء طلب.
//
// المبادئ:
//  - useRealtimeEvent: اشتراك في حدث واحد بقناة واحدة.
//  - useRealtimeChannel: اشتراك في عدة أحداث في قناة واحدة.
//  - usePresence: تتبع أعضاء presence channel.
//  - useRealtimeStatus: حالة الاتصال.
//  - كل hook يستخدم useRef للـ callback لتجنب إعادة الاشتراك عند تغيّر الـ callback.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getPusher,
  subscribe,
  subscribePresence,
  getConnectionState,
  type getPusher as _getPusher,
} from "./pusher-client";
import type {
  RealtimeEvent,
  OrderCreatedPayload,
  OrderStatusChangedPayload,
  CartAbandonedPayload,
  PaymentSubmittedPayload,
  ReviewPostedPayload,
  NotificationPayload,
} from "@/server/realtime/events";

// ─── useRealtimeEvent ────────────────────────────────────────────────────────
/**
 * اشتراك في حدث واحد على قناة محددة.
 * الـ callback يمكن أن يتغير بدون إعادة الاشتراك (يُحدَّث في ref).
 */
export function useRealtimeEvent<T = unknown>(
  channelName: string | null,
  eventName: string,
  callback: (data: T) => void,
  enabled = true
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || !channelName) return;
    const stableCallback = (data: T) => callbackRef.current(data);
    const unsubscribe = subscribe<T>(channelName, eventName, stableCallback);
    return unsubscribe;
  }, [channelName, eventName, enabled]);
}

// ─── useRealtimeChannel ──────────────────────────────────────────────────────
type ChannelHandlers = {
  "order:created"?: (data: OrderCreatedPayload) => void;
  "order:status-changed"?: (data: OrderStatusChangedPayload) => void;
  "order:shipped"?: (data: RealtimeEvent & { name: "order:shipped" } extends { data: infer D } ? D : never) => void;
  "order:delivered"?: (data: RealtimeEvent & { name: "order:delivered" } extends { data: infer D } ? D : never) => void;
  "cart:abandoned"?: (data: CartAbandonedPayload) => void;
  "payment:submitted"?: (data: PaymentSubmittedPayload) => void;
  "payment:confirmed"?: (data: RealtimeEvent & { name: "payment:confirmed" } extends { data: infer D } ? D : never) => void;
  "review:posted"?: (data: ReviewPostedPayload) => void;
  "build:progress"?: (data: RealtimeEvent & { name: "build:progress" } extends { data: infer D } ? D : never) => void;
  "build:completed"?: (data: RealtimeEvent & { name: "build:completed" } extends { data: infer D } ? D : never) => void;
  "trial:warning"?: (data: RealtimeEvent & { name: "trial:warning" } extends { data: infer D } ? D : never) => void;
  "conversation:message"?: (data: RealtimeEvent & { name: "conversation:message" } extends { data: infer D } ? D : never) => void;
  notification?: (data: NotificationPayload) => void;
  "inventory:low"?: (data: RealtimeEvent & { name: "inventory:low" } extends { data: infer D } ? D : never) => void;
};

/**
 * اشتراك في عدة أحداث على قناة واحدة.
 * مفيد لصفحة الطلبات (تستمع لـ order:created و order:status-changed معاً).
 */
export function useRealtimeChannel(
  channelName: string | null,
  handlers: ChannelHandlers,
  enabled = true
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !channelName) return;
    const unsubscribers: Array<() => void> = [];

    for (const [eventName, handler] of Object.entries(handlers)) {
      if (!handler) continue;
      const stable = (data: unknown) => {
        const h = (handlersRef.current as Record<string, ((d: unknown) => void) | undefined>)[eventName];
        h?.(data);
      };
      unsubscribers.push(subscribe(channelName, eventName, stable));
    }

    return () => {
      for (const u of unsubscribers) u();
    };
  }, [channelName, enabled]);
}

// ─── usePresence ─────────────────────────────────────────────────────────────
export type PresenceMember = {
  id: string;
  info?: { name?: string; avatarUrl?: string };
};

export function usePresence(channelName: string | null, enabled = true) {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || !channelName) {
      setMembers([]);
      setCount(0);
      return;
    }

    const unsubscribe = subscribePresence(channelName, {
      onSubscriptionSucceeded: (m) => {
        const list: PresenceMember[] = [];
        m.each((member: { id: string; info?: unknown }) => {
          list.push({
            id: member.id,
            info: (member.info as PresenceMember["info"]) ?? undefined,
          });
        });
        setMembers(list);
        setCount(list.length);
      },
      onMemberAdded: (member) => {
        setMembers((prev) => {
          if (prev.some((m) => m.id === member.id)) return prev;
          const next = [...prev, { id: member.id, info: member.info as PresenceMember["info"] }];
          setCount(next.length);
          return next;
        });
      },
      onMemberRemoved: (member) => {
        setMembers((prev) => {
          const next = prev.filter((m) => m.id !== member.id);
          setCount(next.length);
          return next;
        });
      },
    });

    return unsubscribe;
  }, [channelName, enabled]);

  return { members, count };
}

// ─── useRealtimeStatus ───────────────────────────────────────────────────────
export function useRealtimeStatus() {
  const [status, setStatus] = useState<ReturnType<typeof getConnectionState>>("unavailable");

  useEffect(() => {
    const p = getPusher();
    if (!p) return;

    const update = () => setStatus(getConnectionState());
    p.connection.bind("state_change", update);
    update();

    return () => {
      p.connection.unbind("state_change", update);
    };
  }, []);

  return status;
}

// ─── useLiveOrders (اختصار شائع) ────────────────────────────────────────────
/**
 * Hook جاهز للاستخدام في صفحة الطلبات.
 * يعيد أحدث طلب جديد + عدد الطلبات الجديدة غير المُقروءة.
 */
export function useLiveOrders(
  storeId: string | null,
  onNewOrder?: (order: OrderCreatedPayload) => void
) {
  const [latestOrder, setLatestOrder] = useState<OrderCreatedPayload | null>(null);
  const [newCount, setNewCount] = useState(0);

  const onNewOrderRef = useRef(onNewOrder);
  onNewOrderRef.current = onNewOrder;

  useRealtimeEvent<OrderCreatedPayload>(
    storeId ? `private-store-${storeId}` : null,
    "order:created",
    useCallback((order: OrderCreatedPayload) => {
      setLatestOrder(order);
      setNewCount((c) => c + 1);
      onNewOrderRef.current?.(order);
    }, [])
  );

  const clearCount = useCallback(() => setNewCount(0), []);
  const clearLatest = useCallback(() => setLatestOrder(null), []);

  return { latestOrder, newCount, clearCount, clearLatest };
}