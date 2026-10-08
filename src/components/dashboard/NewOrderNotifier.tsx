"use client";

// NewOrderNotifier — يراقب طلبات جديدة كل 30 ثانية:
// - يشغّل صوتًا لطيفاً (Web Audio → MP3 fallback).
// - toast قابل للنقر للانتقال للطلبات.
// - يحفظ lastCheckAt في ref فقط (لا localStorage) لتجنب تكرار التنبيه.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { newOrdersSinceAction } from "@/server/actions/dashboard-extras";

const POLL_MS = 30_000;
const SOUND_FALLBACK = "/sounds/order.mp3";

function playOrderSound() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) throw new Error("AudioContext not available");
    const ctx = new Ctor();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.5);

    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    new Audio(SOUND_FALLBACK).play().catch(() => {});
  }
}

export function NewOrderNotifier() {
  const since = useRef(new Date().toISOString());
  const busy = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const notify = (n: number) => {
      playOrderSound();
      toast.success(
        n === 1
          ? "وصلك طلب جديد في المتجر"
          : `وصلك ${n.toLocaleString("ar-EG")} طلبات جديدة`,
        {
          duration: 8_000,
          icon: <ShoppingCart className="size-4" aria-hidden="true" />,
          action: {
            label: "عرض الطلبات",
            onClick: () => router.push("/dashboard/orders?status=new"),
          },
        }
      );
      router.refresh();
    };

    const check = async () => {
      if (busy.current || document.hidden) return;
      busy.current = true;
      const checkAt = new Date().toISOString();
      try {
        const n = await newOrdersSinceAction(since.current);
        since.current = checkAt;
        if (n > 0) notify(n);
      } catch {
        /* silent — لا نزعج التاجر بفشل الشبكة */
      } finally {
        busy.current = false;
      }
    };

    const iv = setInterval(check, POLL_MS);
    return () => clearInterval(iv);
  }, [router]);

  return null;
}