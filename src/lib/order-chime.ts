"use client";

// order-chime.ts — نغمة الطلب الجديد في لوحة التاجر، وتفضيل كتمها (محفوظ في المتصفح).
// المتصفحات تمنع الصوت قبل أول تفاعل من المستخدم، فيُفتح سياق الصوت عند أول نقرة/لمسة ويُعاد استخدامه،
// فتعمل النغمة حتى والتبويب في الخلفية.

const PREF_KEY = "clp_order_sound_enabled";
const FALLBACK = "/sounds/order.mp3";

let ctx: AudioContext | null = null;

function audioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/** يُستدعى من أول تفاعل للمستخدم ليصبح تشغيل النغمة لاحقاً مسموحاً. */
export function unlockOrderChime(): void {
  const Ctor = audioCtor();
  if (!Ctor) return;
  try {
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function isOrderSoundEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setOrderSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    /* وضع التصفح الخاص: يبقى التفضيل للجلسة فقط */
  }
}

/** نغمتان صاعدتان قصيرتان (نصف ثانية). */
export function playOrderChime(): void {
  try {
    if (!ctx || ctx.state === "closed") throw new Error("locked");
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.5);
    gain.connect(ctx.destination);

    const a = ctx.createOscillator();
    a.type = "sine";
    a.frequency.setValueAtTime(587.33, now);
    a.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    a.connect(gain);
    a.start(now);
    a.stop(now + 0.3);

    const b = ctx.createOscillator();
    b.type = "triangle";
    b.frequency.setValueAtTime(880, now + 0.15);
    b.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);
    b.connect(gain);
    b.start(now + 0.15);
    b.stop(now + 0.5);
  } catch {
    new Audio(FALLBACK).play().catch(() => {});
  }
}
