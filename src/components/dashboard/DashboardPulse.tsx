"use client";

// DashboardPulse — نبض لوحة التاجر: مصدر واحد لكل ما يتغير وحده في اللوحة.
//  - يسأل /api/dashboard/attention كل 20 ثانية (وكل دقيقة والتبويب في الخلفية)، وفوراً عند العودة للتبويب،
//    أو عودة الإنترنت، أو تغيير الصفحة، أو حدث Pusher إن كان مفعّلاً على المنصة.
//  - يغذّي شارات القائمة، ومركز «ما يحتاج انتباهك»، وعدّاد عنوان التبويب.
//  - عند وصول طلب جديد في أي صفحة: نغمة (إن لم تُكتم) وإشعار يفتح الطلب، ويحدّث صفحة الطلبات والنظرة العامة.
// يعمل بالطريقة نفسها في المنصة وفي مشروع التاجر الخاص (لا يعتمد على أي خدمة وقت فعلي).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { useRealtimeEvent } from "@/lib/realtime-hooks";
import { channels } from "@/server/realtime/events";
import type { AttentionCounts, AttentionSnapshot, ArrivedOrder } from "@/server/repos/attention";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { arCount, NOUN } from "@/lib/format";
import {
  isOrderSoundEnabled,
  playOrderChime,
  setOrderSoundEnabled,
  unlockOrderChime,
} from "@/lib/order-chime";

const VISIBLE_MS = 20_000;
const HIDDEN_MS = 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const LOG_MAX = 20;
const LOG_TTL_MS = 48 * 3600e3;

export const ZERO_COUNTS: AttentionCounts = {
  newOrders: 0,
  ordersToHandle: 0,
  receipts: 0,
  pendingReviews: 0,
  outOfStock: 0,
  lowStock: 0,
  variantsOut: 0,
  abandoned: 0,
};

type PulseCtx = {
  counts: AttentionCounts;
  /** هل وصلت أرقام حقيقية من الخادم (لا تُعرض شارات قبلها). */
  ready: boolean;
  /** الطلبات التي وصلت أثناء فتح اللوحة (آخر 48 ساعة على هذا الجهاز). */
  arrivals: ArrivedOrder[];
  unseenArrivals: number;
  markArrivalsSeen: () => void;
  clearArrivals: () => void;
  online: boolean;
  soundOn: boolean;
  toggleSound: () => void;
  /** سؤال فوري (بعد إجراء يغيّر الأعداد، مثل تأكيد طلب أو اعتماد تقييم). */
  refresh: () => void;
};

const Ctx = createContext<PulseCtx>({
  counts: ZERO_COUNTS,
  ready: false,
  arrivals: [],
  unseenArrivals: 0,
  markArrivalsSeen: () => {},
  clearArrivals: () => {},
  online: true,
  soundOn: true,
  toggleSound: () => {},
  refresh: () => {},
});

export const useDashboardPulse = () => useContext(Ctx);

/** لأي مكوّن بعد إجراء يغيّر ما يحتاج انتباه التاجر: يطلب من النبض تحديث الأعداد فوراً. */
export function requestPulse(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("clp:pulse"));
}

type StoredLog = { at: number; seen: boolean; order: ArrivedOrder }[];

function readLog(key: string): StoredLog {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as StoredLog;
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - LOG_TTL_MS;
    return parsed.filter((e) => e && typeof e.at === "number" && e.at > cutoff && typeof e.order?.id === "string");
  } catch {
    return [];
  }
}

function writeLog(key: string, log: StoredLog) {
  try {
    localStorage.setItem(key, JSON.stringify(log.slice(0, LOG_MAX)));
  } catch {
    /* التخزين ممتلئ أو محظور: السجل يبقى في الذاكرة */
  }
}

const TITLE_PREFIX = /^\(\d+\+?\)\s*/;

export function DashboardPulse({
  storeId,
  initial,
  initialAt,
  children,
}: {
  storeId: string | null;
  initial: AttentionCounts | null;
  initialAt: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [counts, setCounts] = useState<AttentionCounts>(initial ?? ZERO_COUNTS);
  const [ready, setReady] = useState(initial !== null);
  const [log, setLog] = useState<StoredLog>([]);
  const [online, setOnline] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  const since = useRef<string | null>(initialAt);
  const seen = useRef(new Set<string>());
  const inflight = useRef(false);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const logKey = storeId ? `clp_arrivals_${storeId}` : null;

  // سجل الطلبات الواصلة على هذا الجهاز + تفضيل الصوت.
  useEffect(() => {
    setSoundOn(isOrderSoundEnabled());
    if (!logKey) return;
    const stored = readLog(logKey);
    for (const e of stored) seen.current.add(e.order.id);
    setLog(stored);
  }, [logKey]);

  useEffect(() => {
    if (logKey) writeLog(logKey, log);
  }, [log, logKey]);

  const announce = useCallback(
    (fresh: ArrivedOrder[]) => {
      if (isOrderSoundEnabled()) playOrderChime();
      const first = fresh[0]!;
      if (fresh.length === 1) {
        toast.success(`طلب جديد من ${first.customerName}`, {
          description: `${formatEgp(first.totalPiasters)} · ${governorateName(first.governorate)} · ${first.code}`,
          duration: 10_000,
          action: { label: "افتح الطلب", onClick: () => router.push(`/dashboard/orders/${first.id}`) },
        });
      } else {
        toast.success(`وصلك ${arCount(fresh.length, NOUN.newOrder)}`, {
          description: fresh.map((o) => o.customerName).slice(0, 3).join("، "),
          duration: 10_000,
          action: { label: "عرض الطلبات", onClick: () => router.push("/dashboard/orders?status=new") },
        });
      }
      const p = pathRef.current;
      if (p === "/dashboard" || p === "/dashboard/orders") router.refresh();
    },
    [router]
  );

  const poll = useCallback(async () => {
    if (!storeId || inflight.current) return;
    inflight.current = true;
    try {
      const q = since.current ? `?since=${encodeURIComponent(since.current)}` : "";
      const res = await fetch(`/api/dashboard/attention${q}`, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const snap = (await res.json()) as AttentionSnapshot;
      failures.current = 0;
      since.current = snap.at;
      setCounts(snap.counts);
      setReady(true);
      const fresh = snap.arrived.filter((o) => !seen.current.has(o.id));
      if (fresh.length) {
        for (const o of fresh) seen.current.add(o.id);
        setLog((prev) => [...fresh.map((order) => ({ at: Date.now(), seen: false, order })), ...prev].slice(0, LOG_MAX));
        announce(fresh);
      }
    } catch {
      failures.current += 1;
    } finally {
      inflight.current = false;
    }
  }, [storeId, announce]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const base = document.hidden ? HIDDEN_MS : VISIBLE_MS;
    const delay = Math.min(base * 2 ** failures.current, MAX_BACKOFF_MS);
    timer.current = setTimeout(async () => {
      await poll();
      schedule();
    }, delay);
  }, [poll]);

  const refresh = useCallback(() => {
    void poll().then(schedule);
  }, [poll, schedule]);

  // الحلقة: أول سؤال فوري إن لم تأت أرقام من الخادم، ثم دورياً.
  useEffect(() => {
    if (!storeId) return;
    if (initial === null) void poll();
    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // initial يُقرأ مرة واحدة عند التركيب.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, poll, schedule]);

  // العودة للتبويب أو للإنترنت أو طلب صريح من مكوّن آخر: سؤال فوري.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    const onOnline = () => {
      setOnline(true);
      failures.current = 0;
      refresh();
    };
    const onOffline = () => setOnline(false);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("clp:pulse", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("clp:pulse", refresh);
    };
  }, [refresh]);

  // بعد التنقل (غالباً بعد حفظ أو تغيير حالة): أعداد محدّثة دون انتظار الدورة.
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    refresh();
  }, [pathname, refresh]);

  // Pusher (على المنصة إن كان مضبوطاً) يسرّع اكتشاف الطلب فقط؛ الأرقام من الخادم دائماً.
  useRealtimeEvent(storeId ? channels.store(storeId) : null, "order:created", refresh);

  // المتصفح يسمح بالصوت بعد أول تفاعل فقط.
  useEffect(() => {
    const unlock = () => {
      unlockOrderChime();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // عدّاد الطلبات الجديدة في عنوان التبويب: «(3) الطلبات · Colapia».
  const titleCount = counts.newOrders;
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(TITLE_PREFIX, "");
      // أثناء التنقل يضع Next عنواناً فارغاً لحظياً: لا نكتب فيه «(3) » وحده فيتراكم الرقم مرتين.
      if (!base.trim()) return;
      const want = titleCount > 0 ? `(${titleCount > 99 ? "99+" : titleCount}) ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    // Next يبث العنوان أحياناً داخل body (metadata متدفقة) ويضيفه للـ head عند التنقل: نراقب الاثنين.
    const mo = new MutationObserver(() => {
      watch();
      apply();
    });
    const watch = () => {
      mo.observe(document.head, { childList: true, subtree: true, characterData: true });
      document.querySelectorAll("title").forEach((t) => mo.observe(t, { childList: true, subtree: true, characterData: true }));
    };
    watch();
    apply();
    const late = window.setTimeout(apply, 800);
    return () => {
      mo.disconnect();
      window.clearTimeout(late);
      document.title = document.title.replace(TITLE_PREFIX, "");
    };
  }, [titleCount]);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      setOrderSoundEnabled(next);
      if (next) {
        unlockOrderChime();
        playOrderChime();
      }
      toast(next ? "نغمة الطلب الجديد مفعّلة" : "نغمة الطلب الجديد مكتومة", { duration: 2500 });
      return next;
    });
  }, []);

  const value = useMemo<PulseCtx>(
    () => ({
      counts,
      ready,
      arrivals: log.map((e) => e.order),
      unseenArrivals: log.filter((e) => !e.seen).length,
      markArrivalsSeen: () => setLog((prev) => (prev.some((e) => !e.seen) ? prev.map((e) => ({ ...e, seen: true })) : prev)),
      clearArrivals: () => setLog([]),
      online,
      soundOn,
      toggleSound,
      refresh,
    }),
    [counts, ready, log, online, soundOn, toggleSound, refresh]
  );

  return (
    <Ctx.Provider value={value}>
      {!online ? (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warn/15 px-4 py-1.5 text-center text-[11.5px] font-bold text-warn"
        >
          <WifiOff className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          أنت غير متصل بالإنترنت. ستتحدث اللوحة وحدها فور عودة الاتصال.
        </div>
      ) : null}
      {children}
    </Ctx.Provider>
  );
}
