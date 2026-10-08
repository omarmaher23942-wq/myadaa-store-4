"use client";

// RealtimeSoundManager — تنبيه صوتي فوري عند وصول أوردر جديد.
//
// السبب الجذري:
// التاجر يفوّت طلبات مهمة لأن الداشبورد بدون صوت تنبيه حي.
//
// المبادئ:
//  - Web Audio API (بدون ملفات صوتية إضافية)، مع fallback إلى MP3.
//  - يحترم prefers-reduced-motion وuser preference (localStorage).
//  - يستمع لحدث order:created عبر useRealtimeEvent.
//  - لا يُشغّل الصوت إذا الصفحة hidden (يوفر البطارية).
//  - زر كتم/تشغيل في الـ topbar عبر CustomEvent.
import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useRealtimeEvent } from "@/lib/realtime-hooks";
import { channels, type OrderCreatedPayload } from "@/server/realtime/events";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SOUND_PREF_KEY = "clp_order_sound_enabled";
const SOUND_FALLBACK = "/sounds/order.mp3";
const SW = 1.75;

/**
 * يشغّل نغمة قصيرة (880Hz → 1174Hz) لمدة 0.5 ثانية.
 */
function playOrderChime() {
  if (typeof window === "undefined") return;

  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) throw new Error("AudioContext unavailable");

    const ctx = new Ctor();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.5);

    window.setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // fallback: MP3
    new Audio(SOUND_FALLBACK).play().catch(() => {});
  }
}

export function RealtimeSoundManager({
  storeId,
}: {
  storeId: string;
}) {
  const [enabled, setEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const unlockRef = useRef(false);

  // استرجاع التفضيل من localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SOUND_PREF_KEY);
      if (raw === "0") setEnabled(false);
    } catch {
      /* ignore */
    }
  }, []);

  // تفعيل AudioContext عند أول تفاعل من المستخدم (متطلب المتصفحات).
  useEffect(() => {
    if (unlockRef.current) return;
    const unlock = () => {
      unlockRef.current = true;
      setAudioUnlocked(true);
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // الاستماع لحدث order:created.
  useRealtimeEvent<OrderCreatedPayload>(
    channels.store(storeId),
    "order:created",
    useCallback(
      (payload) => {
        if (!enabled) return;
        if (typeof document !== "undefined" && document.hidden) return;
        if (!audioUnlocked) return;

        playOrderChime();

        toast.success(`طلب جديد — ${payload.customerName}`, {
          description: `${payload.totalPiasters / 100} ج.م · ${payload.governorate}`,
          duration: 8000,
        });
      },
      [enabled, audioUnlocked]
    )
  );

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      try {
        localStorage.setItem(SOUND_PREF_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      toast.info(next ? "تنبيه الطلبات مفعّل" : "تنبيه الطلبات مكتوم");
      return next;
    });
  }, []);

  // نستمع لحدث خارجي من الـ topbar لتبديل الصوت.
  useEffect(() => {
    const handler = () => toggle();
    window.addEventListener("clp:toggle-sound", handler);
    return () => window.removeEventListener("clp:toggle-sound", handler);
  }, [toggle]);

  return null;
}

/**
 * زر كتم/تشغيل الصوت — يوضع في الـ topbar.
 */
export function SoundToggleButton() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SOUND_PREF_KEY);
      if (raw === "0") setEnabled(false);
    } catch {
      /* ignore */
    }
  }, []);

  const onClick = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(SOUND_PREF_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    toast.info(next ? "تنبيه الطلبات مفعّل" : "تنبيه الطلبات مكتوم");
    window.dispatchEvent(new CustomEvent("clp:toggle-sound"));
  }, [enabled]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={enabled ? "كتم تنبيه الطلبات" : "تفعيل تنبيه الطلبات"}
      aria-pressed={enabled}
      title={enabled ? "كتم تنبيه الطلبات" : "تفعيل تنبيه الطلبات"}
      className={cn(
        "grid size-10 place-items-center rounded-xl text-ink-2/80 transition-colors hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova",
        enabled ? "" : "opacity-50"
      )}
    >
      {enabled ? (
        <Volume2 className="size-4" strokeWidth={SW} aria-hidden="true" />
      ) : (
        <VolumeX className="size-4" strokeWidth={SW} aria-hidden="true" />
      )}
    </button>
  );
}