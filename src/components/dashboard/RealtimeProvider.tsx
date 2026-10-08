"use client";

// components/dashboard/RealtimeProvider.tsx — Provider موحّد للـ real-time.
//
// السبب الجذري:
// بدون provider، كل component يفتح اتصال Pusher خاص به → 5-10 اتصالات
// في نفس الصفحة، وتسريب ذاكرة عند التنقل.
//
// المبادئ:
//  - يُركّب مرة واحدة في dashboard/layout.tsx.
//  - يعرض حالة الاتصال (online/offline) في شريط خفيف.
//  - يجمع كل الإشعارات في notifications inbox عالمي.
//  - يوفر context للـ notifications عبر useNotifications().
//  - يدير RealtimeSoundManager داخلياً.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  WifiOff,
  Wifi,
  X,
  ShoppingCart,
  Wallet,
  Star,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRealtimeStatus, useRealtimeEvent } from "@/lib/realtime-hooks";
import { channels, type NotificationPayload } from "@/server/realtime/events";
import { getPusher } from "@/lib/pusher-client";
import { cn } from "@/lib/utils";
import { RealtimeSoundManager } from "./RealtimeSoundManager";

// ─── أنواع ──────────────────────────────────────────────────────────────────
export type RealtimeNotification = NotificationPayload & {
  read: boolean;
};

type Ctx = {
  notifications: RealtimeNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
};

const RealtimeCtx = createContext<Ctx>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  markRead: () => {},
  dismiss: () => {},
  clearAll: () => {},
});

export function useNotifications() {
  return useContext(RealtimeCtx);
}

// ─── Provider ───────────────────────────────────────────────────────────────
export function RealtimeProvider({
  merchantId,
  storeId,
  children,
}: {
  merchantId: string;
  storeId: string | null;
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const status = useRealtimeStatus();
  const reduce = useReducedMotion();

  // تهيئة Pusher عند mount.
  useEffect(() => {
    getPusher();
  }, []);

  // الاشتراك في قناة التاجر.
  useRealtimeEvent<NotificationPayload>(
    channels.merchant(merchantId),
    "notification",
    useCallback((data: NotificationPayload) => {
      const notif: RealtimeNotification = { ...data, read: false };
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      toast(data.title, {
        description: data.message,
        duration: 6000,
        action: data.deepLink
          ? {
              label: "افتح",
              onClick: () => {
                window.location.href = data.deepLink!;
              },
            }
          : undefined,
      });
    }, [])
  );

  // الاشتراك في أحداث المتجر (طلب جديد).
  useRealtimeEvent<{
    code: string;
    customerName: string;
    totalPiasters: number;
  }>(
    storeId ? channels.store(storeId) : null,
    "order:created",
    useCallback(
      (order) => {
        const notif: RealtimeNotification = {
          id: `order-${order.code}-${Date.now()}`,
          type: "success",
          title: `طلب جديد #${order.code}`,
          message: `${order.customerName} — ${(
            order.totalPiasters / 100
          ).toFixed(0)} ج.م`,
          deepLink: `/dashboard/orders`,
          at: new Date().toISOString(),
          read: false,
        };
        setNotifications((prev) => [notif, ...prev].slice(0, 50));
      },
      []
    )
  );

  // حفظ في localStorage عند كل تغيير.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `clp_notifications_${merchantId}`;
      const toSave = notifications.slice(0, 30);
      window.localStorage.setItem(key, JSON.stringify(toSave));
    } catch {
      /* ignore */
    }
  }, [notifications, merchantId]);

  // استرجاع من localStorage عند أول mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = `clp_notifications_${merchantId}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RealtimeNotification[];
      if (Array.isArray(parsed)) {
        setNotifications(
          parsed.filter((n) => n && typeof n.id === "string")
        );
      }
    } catch {
      /* ignore */
    }
  }, [merchantId]);

  const value = useMemo<Ctx>(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markAllRead: () =>
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
      markRead: (id) =>
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        ),
      dismiss: (id) =>
        setNotifications((prev) => prev.filter((n) => n.id !== id)),
      clearAll: () => setNotifications([]),
    }),
    [notifications]
  );

  return (
    <RealtimeCtx.Provider value={value}>
      {storeId ? <RealtimeSoundManager storeId={storeId} /> : null}

      <AnimatePresence>
        {status !== "connected" && status !== "unavailable" ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            role="status"
            aria-live="polite"
            className={cn(
              "sticky top-0 z-50 flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold",
              status === "connecting"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-200"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-200"
            )}
          >
            {status === "connecting" ? (
              <>
                <Wifi className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                جارٍ الاتصال بالتحديثات الحية…
              </>
            ) : (
              <>
                <WifiOff
                  className="size-3.5"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                فقدنا الاتصال — التحديثات مؤقتاً معطّلة
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {children}
    </RealtimeCtx.Provider>
  );
}

// ─── NotificationsCenter ────────────────────────────────────────────────────
/**
 * Panel منسدل يعرض آخر 50 إشعار. يوضع في الـ Topbar.
 */
export function NotificationsCenter() {
  const { notifications, unreadCount, markAllRead, dismiss, clearAll } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ICONS: Record<string, LucideIcon> = {
    info: Bell,
    success: ShoppingCart,
    warning: Wallet,
    error: Star,
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllRead();
        }}
        aria-label={`الإشعارات${
          unreadCount > 0 ? `، ${unreadCount} غير مقروء` : ""
        }`}
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-xl text-ink-2/80 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
      >
        <Bell className="size-4" strokeWidth={2.25} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute end-1 top-1 grid size-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 font-mono text-[9px] font-black text-white shadow ring-2 ring-space">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
              tabIndex={-1}
            />
            <motion.div
              role="dialog"
              aria-label="الإشعارات"
              initial={
                reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }
              }
              transition={{ duration: reduce ? 0 : 0.16 }}
              className="absolute end-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-edge/10 bg-space-2 shadow-2xl shadow-black/60"
            >
              <div className="flex items-center justify-between border-b border-edge/10 px-4 py-3">
                <p className="text-[12.5px] font-black text-ink">
                  الإشعارات
                </p>
                {notifications.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[10.5px] font-bold text-ink-3 transition-colors hover:text-ink"
                  >
                    مسح الكل
                  </button>
                ) : null}
              </div>

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Bell
                    className="size-5 text-ink-3"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <p className="text-[11.5px] text-ink-3">
                    لا توجد إشعارات حالياً
                  </p>
                </div>
              ) : (
                <ul className="max-h-[400px] overflow-y-auto">
                  {notifications.map((n) => {
                    const Icon = ICONS[n.type] ?? Bell;
                    const content = (
                      <div className="flex items-start gap-3 p-3">
                        <span
                          className={cn(
                            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                            n.type === "success" &&
                              "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
                            n.type === "warning" &&
                              "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                            n.type === "error" &&
                              "bg-rose-500/15 text-rose-600 dark:text-rose-300",
                            n.type === "info" &&
                              "bg-nova/15 text-nova-2"
                          )}
                        >
                          <Icon
                            className="size-3.5"
                            strokeWidth={2.25}
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11.5px] font-bold text-ink">
                            {n.title}
                          </p>
                          {n.message ? (
                            <p className="mt-0.5 line-clamp-2 text-[10.5px] text-ink-3">
                              {n.message}
                            </p>
                          ) : null}
                          <p className="mt-1 font-mono text-[9.5px] text-ink-3/70">
                            {new Date(n.at).toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );

                    return (
                      <li
                        key={n.id}
                        className={cn(
                          "relative border-b border-edge/5 last:border-0",
                          !n.read && "bg-nova/[0.04]"
                        )}
                      >
                        {n.deepLink ? (
                          <Link
                            href={n.deepLink}
                            onClick={() => setOpen(false)}
                            className="block transition-colors hover:bg-edge/[0.04]"
                          >
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dismiss(n.id);
                          }}
                          aria-label="حذف الإشعار"
                          className="absolute end-1 top-1 grid size-6 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-edge/10 hover:text-ink focus:opacity-100"
                        >
                          <X
                            className="size-3"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}