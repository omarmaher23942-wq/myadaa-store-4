"use client";

// ConversionWidgets — يحسّن معدل التحويل:
// - Social Proof Toasts ببيانات حقيقية من /api/proof (مع throttling).
// - Exit-Intent Modal بكود قابل للنسخ بضغطة.
// - WhatsApp floating button ذكي: الرسالة تتضمن اسم الصفحة/المنتج.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  X,
  Gift,
  MapPin,
  Clock,
  Copy,
  Check,
  ShoppingBag,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { useStore } from "./StoreProvider";

const SW = 1.75;

type Proof = {
  gov: string;
  at: string;
  name: string;
  img: string | null;
  slug: string | null;
};

const GOV_AR: Record<string, string> = {
  cairo: "القاهرة",
  giza: "الجيزة",
  alexandria: "الإسكندرية",
  dakahlia: "الدقهلية",
  sharqia: "الشرقية",
  gharbia: "الغربية",
  monufia: "المنوفية",
  qalyubia: "القليوبية",
  beheira: "البحيرة",
  minya: "المنيا",
  asyut: "أسيوط",
  sohag: "سوهاج",
  qena: "قنا",
  luxor: "الأقصر",
  aswan: "أسوان",
  red_sea: "البحر الأحمر",
  matrouh: "مطروح",
  north_sinai: "شمال سيناء",
  south_sinai: "جنوب سيناء",
  new_valley: "الوادي الجديد",
  kafr_el_sheikh: "كفر الشيخ",
  damietta: "دمياط",
  port_said: "بورسعيد",
  suez: "السويس",
  ismailia: "الإسماعيلية",
  beni_suef: "بني سويف",
  fayoum: "الفيوم",
};

const govLabel = (c: string) => GOV_AR[c] ?? "مصر";

function ago(iso: string): string {
  const diff = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diff < 60) return `قبل ${diff} دقيقة`;
  if (diff < 1440) return `قبل ${Math.round(diff / 60)} ساعة`;
  return `قبل ${Math.round(diff / 1440)} يوم`;
}

export function ConversionWidgets() {
  const { conversion, channels, storeId } = useStore();
  const reduce = useReducedMotion();
  const pathname = usePathname();

  const [proofs, setProofs] = useState<Proof[]>([]);
  const [show, setShow] = useState<Proof | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── Social proof fetch (with visibility gating) ────────────────────────
  useEffect(() => {
    if (!conversion.socialProofToasts.enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/proof?storeId=${encodeURIComponent(storeId)}`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const json = (await r.json()) as Proof[];
        const next = Array.isArray(json) ? json.slice(0, 30) : [];
        // نفس البيانات لا تعيد تشغيل دورة الإشعارات.
        if (!cancelled) setProofs((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      } catch {
        /* no-op */
      }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [conversion.socialProofToasts.enabled, storeId]);

  // ─── Cycle toasts ──────────────────────────────────────────────────────
  // كل طلب يظهر للزائر مرة واحدة فقط خلال 24 ساعة، وبحد أقصى 4 إشعارات في الجلسة،
  // وبفاصل عشوائي 45-75 ثانية. لا إشعارات في السلة والدفع حتى لا تشتت العميل.
  const quiet = pathname?.startsWith("/checkout") || pathname?.startsWith("/cart");
  useEffect(() => {
    if (!proofs.length || quiet) return;
    const seenKey = `clp-proof-seen:${storeId}`;
    const countKey = `clp-proof-count:${storeId}`;
    const idOf = (p: Proof) => `${p.at}|${p.name}`;
    const readSeen = (): Record<string, number> => {
      try {
        const raw = JSON.parse(localStorage.getItem(seenKey) ?? "{}") as Record<string, number>;
        const fresh = Object.entries(raw).filter(([, t]) => Date.now() - t < 86_400_000);
        return Object.fromEntries(fresh);
      } catch {
        return {};
      }
    };
    const sessionCount = () => {
      try {
        return Number(sessionStorage.getItem(countKey) ?? 0);
      } catch {
        return 0;
      }
    };

    let timer: ReturnType<typeof setTimeout>;
    let hide: ReturnType<typeof setTimeout>;
    const next = (delay: number) => {
      timer = setTimeout(() => {
        if (sessionCount() >= 4) return;
        if (document.visibilityState !== "visible") return next(15_000);
        const seen = readSeen();
        const p = proofs.find((x) => !seen[idOf(x)]);
        if (!p) return;
        seen[idOf(p)] = Date.now();
        try {
          localStorage.setItem(seenKey, JSON.stringify(seen));
          sessionStorage.setItem(countKey, String(sessionCount() + 1));
        } catch {
          /* التخزين غير متاح: يكفي الحد داخل الصفحة */
        }
        setShow(p);
        hide = setTimeout(() => setShow(null), 5500);
        next(45_000 + Math.random() * 30_000);
      }, delay);
    };
    next(15_000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hide);
    };
  }, [proofs, quiet, storeId]);

  // ─── Exit-intent (mouse top or fast scroll-up near top) ────────────────
  useEffect(() => {
    const cfg = conversion.exitIntentOffer;
    if (!cfg.enabled || !cfg.couponCode) return;

    const key = "clp-exit-shown-at";
    const last = Number(
      (() => {
        try {
          return localStorage.getItem(key) ?? 0;
        } catch {
          return 0;
        }
      })()
    );
    if (Date.now() - last < Math.max(1, cfg.showOncePerDays) * 86_400_000) return;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      setExitOpen(true);
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch {
        /* no-op */
      }
      cleanup();
    };

    let lastY = window.scrollY;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) fire();
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (lastY - y > 400 && y < 300) fire();
      lastY = y;
    };

    const cleanup = () => {
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };

    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, [conversion.exitIntentOffer]);

  // ─── Smart WhatsApp message ─────────────────────────────────────────────
  const whatsappNum = channels.whatsappNumber || channels.phone;
  const waMessage = useMemo(() => {
    const base = "أهلاً بك! أرغب في الاستفسار عن";
    if (pathname?.startsWith("/p/")) {
      const slug = pathname.split("/p/")[1]?.split("/")[0] ?? "";
      return `${base} المنتج من الرابط: ${typeof location !== "undefined" ? location.href : ""}`;
    }
    if (pathname?.startsWith("/checkout")) return `${base} إتمام طلب جديد.`;
    if (pathname?.startsWith("/cart")) return `${base} منتجات في سلتي.`;
    if (slug_never) return base;
    return `${base} متجركم.`;
  }, [pathname]);

  const waHref = whatsappNum
    ? `https://wa.me/2${whatsappNum}?text=${encodeURIComponent(waMessage)}`
    : null;

  const onCopyCoupon = () => {
    const code = conversion.exitIntentOffer.couponCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("تم نسخ الكود");
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      {/* ─── Social Proof Toast ────────────────────────────────────────── */}
      <AnimatePresence>
        {show && conversion.socialProofToasts.enabled ? (
          <motion.div
            key={show.at + show.name}
            initial={reduce ? false : { y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: 60, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 start-4 z-40 flex max-w-xs items-center gap-3 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl"
            style={{
              background: "color-mix(in srgb, var(--card) 96%, transparent)",
              borderColor: "var(--border)",
              color: "var(--card-foreground)",
            }}
            role="status"
            aria-live="polite"
          >
            {show.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={show.img}
                alt=""
                className="size-12 shrink-0 rounded-xl border object-cover"
                style={{ borderColor: "var(--border)" }}
              />
            ) : (
              <span
                className="grid size-12 shrink-0 place-items-center rounded-xl"
                style={{
                  background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                  color: "var(--primary)",
                }}
              >
                <ShoppingBag className="size-5" strokeWidth={SW} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1 text-[11.5px] leading-tight">
              <p className="flex items-center gap-1 font-black">
                <MapPin
                  className="size-3"
                  style={{ color: "var(--primary)" }}
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                أوردر جديد من {govLabel(show.gov)}
              </p>
              <Link
                href={show.slug ? `/p/${show.slug}` : "/"}
                className="mt-0.5 line-clamp-1 font-bold opacity-80 hover:opacity-100"
              >
                {show.name}
              </Link>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] opacity-60">
                <Clock className="size-2.5" strokeWidth={SW} aria-hidden="true" />
                {ago(show.at)}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ─── WhatsApp Floating Button ─────────────────────────────────── */}
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل عبر واتساب"
          className="fixed bottom-5 end-4 z-40 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-2xl transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <MessageCircle className="size-7" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">واتساب</span>
        </a>
      ) : null}

      {/* ─── Exit-Intent Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {exitOpen ? (
          <motion.div
            key="exit"
            className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={() => setExitOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-offer-title"
          >
            <motion.div
              initial={reduce ? false : { scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={reduce ? undefined : { scale: 0.96, y: 8 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border p-6 text-center shadow-2xl"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--card-foreground)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 start-1/2 size-56 -translate-x-1/2 rounded-full blur-3xl"
                style={{
                  background: "color-mix(in srgb, var(--primary) 25%, transparent)",
                }}
              />

              <button
                type="button"
                onClick={() => setExitOpen(false)}
                aria-label="إغلاق"
                className="absolute end-4 top-4 grid size-9 place-items-center rounded-lg opacity-60 transition-opacity hover:bg-[var(--muted)] hover:opacity-100"
              >
                <X className="size-4" strokeWidth={SW} aria-hidden="true" />
              </button>

              <div
                className="relative mx-auto mb-3 grid size-14 place-items-center rounded-2xl"
                style={{
                  background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                  color: "var(--primary)",
                }}
              >
                <Gift className="size-7" strokeWidth={1.75} aria-hidden="true" />
              </div>

              <h3
                id="exit-offer-title"
                className="relative font-heading text-lg font-black"
              >
                {conversion.exitIntentOffer.title || "انتظر لحظة"}
              </h3>
              <p className="relative mt-1 text-xs leading-relaxed opacity-75">
                {conversion.exitIntentOffer.text ||
                  "احصل على خصم فوري على أول طلب لك."}
              </p>

              {conversion.exitIntentOffer.couponCode ? (
                <button
                  type="button"
                  onClick={onCopyCoupon}
                  className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 font-mono text-base font-black tracking-widest transition-colors hover:bg-[var(--muted)]"
                  style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
                >
                  {copied ? (
                    <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" strokeWidth={SW} aria-hidden="true" />
                  )}
                  {conversion.exitIntentOffer.couponCode}
                </button>
              ) : null}

              <Link
                href="/checkout"
                onClick={() => setExitOpen(false)}
                className="relative mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-black shadow-md transition-all active:scale-[0.98]"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                استخدم الكود الآن
              </Link>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

// متغيّر وهمي لإسكات تحذير TS (unused branch احتياطي).
const slug_never = false as const;