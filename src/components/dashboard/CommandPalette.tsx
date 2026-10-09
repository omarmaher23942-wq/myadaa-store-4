"use client";

// CommandPalette — «ابحث أو انتقل» (Ctrl/⌘+K، أو زر البحث على الموبايل).
//  - بحث حي في طلبات المتجر (بالكود أو موبايل العميل أو اسمه) ومنتجاته (بالعربية أو الفرانكو) وعملائه.
//  - انتقال لأي صفحة في اللوحة (من خريطة الصفحات نفسها التي تبني القائمة الجانبية).
//  - إجراءات سريعة حقيقية فقط: منتج جديد، كود خصم، معاينة المتجر ونسخ رابطه، الثيم، النغمة، نوفا، الجولة.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  LogOut,
  Moon,
  Package,
  Plus,
  Search as SearchIcon,
  ShoppingCart,
  Sparkles,
  TicketPercent,
  Users,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { merchantLogoutAction } from "@/server/actions/auth";
import { normalizeArabic } from "@/lib/arabic";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";
import { arCount, NOUN } from "@/lib/format";
import { orderStatusLabel, orderStatusTone, TONE_CHIP } from "@/lib/order-status";
import type { SearchHit } from "@/server/repos/dashboard-search";
import { NAV_ITEMS } from "./nav";
import { useDashboardPulse } from "./DashboardPulse";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string[];
  run: () => void;
};

/** يفتح لوحة الأوامر من أي مكان (زر البحث في الشريط العلوي مثلاً). */
export function openCommandPalette(): void {
  window.dispatchEvent(new Event("clp:open-palette"));
}

const norm = (s: string) => normalizeArabic(s);

const GROUP =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:text-ink-3";

function matches(c: Cmd, q: string): boolean {
  if (!q) return true;
  const hay = norm([c.label, c.hint ?? "", ...(c.keywords ?? [])].join(" "));
  return q.split(" ").every((w) => hay.includes(w));
}

export function CommandPalette({ storeHref, hasStore }: { storeHref: string | null; hasStore: boolean }) {
  const router = useRouter();
  const { soundOn, toggleSound } = useDashboardPulse();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState("");
  const abort = useRef<AbortController | null>(null);
  // تُعرض داخل غلاف اللوحة (.dash) لترث توكنات ثيمها؛ البوابة الافتراضية (body) خارجه.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => setContainer(document.querySelector<HTMLElement>(".dash")), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("clp:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("clp:open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) return;
    setQuery("");
    setHits([]);
    setSearched("");
    abort.current?.abort();
  }, [open]);

  // بحث الخادم بعد توقف الكتابة 200 مللي ثانية؛ الطلب الأقدم يُلغى.
  useEffect(() => {
    const q = query.trim();
    if (!hasStore || q.length < 2) {
      abort.current?.abort();
      setHits([]);
      setSearching(false);
      setSearched("");
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits);
        setSearched(q);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setHits([]);
        setSearched(q);
      } finally {
        if (abort.current === ctl) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, hasStore]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const pages: Cmd[] = useMemo(
    () => NAV_ITEMS.map((n) => ({ id: `nav:${n.href}`, label: n.label, hint: n.hint, icon: n.icon, keywords: n.keywords, run: () => go(n.href) })),
    [go]
  );

  const actions: Cmd[] = useMemo(() => {
    const list: Cmd[] = [];
    if (hasStore) {
      list.push(
        { id: "new-product", label: "أضف منتجاً جديداً", icon: Plus, keywords: ["منتج جديد", "new product", "اضافه"], run: () => go("/dashboard/products/new") },
        { id: "pending-orders", label: "الطلبات بانتظار التأكيد", icon: ShoppingCart, keywords: ["جديد", "تاكيد", "new orders"], run: () => go("/dashboard/orders?status=new") },
        { id: "new-discount", label: "أنشئ كود خصم", icon: TicketPercent, keywords: ["كوبون", "خصم", "coupon"], run: () => go("/dashboard/discounts") }
      );
    }
    if (storeHref) {
      list.push(
        {
          id: "preview",
          label: "افتح متجري",
          hint: "في تبويب جديد",
          icon: ExternalLink,
          keywords: ["معاينه", "preview", "متجر"],
          run: () => {
            setOpen(false);
            window.open(storeHref, "_blank", "noopener");
          },
        },
        {
          id: "copy-link",
          label: "انسخ رابط متجري",
          hint: "لمشاركته على واتساب أو فيسبوك",
          icon: Copy,
          keywords: ["رابط", "لينك", "link", "share"],
          run: async () => {
            setOpen(false);
            try {
              await navigator.clipboard.writeText(storeHref);
              toast.success("نُسخ رابط متجرك");
            } catch {
              toast.error("تعذر النسخ تلقائياً", { description: storeHref });
            }
          },
        }
      );
    }
    list.push(
      {
        id: "theme",
        label: "بدّل بين الوضع الفاتح والداكن",
        icon: Moon,
        keywords: ["ثيم", "theme", "dark", "light", "ليلي"],
        run: () => {
          setOpen(false);
          window.dispatchEvent(new Event("clp:toggle-theme"));
        },
      },
      {
        id: "sound",
        label: soundOn ? "اكتم نغمة الطلب الجديد" : "شغّل نغمة الطلب الجديد",
        icon: Volume2,
        keywords: ["صوت", "نغمه", "sound", "mute"],
        run: () => {
          setOpen(false);
          toggleSound();
        },
      }
    );
    if (hasStore) {
      list.push({
        id: "nova",
        label: "اسأل نوفا",
        hint: "مساعدك يجيب من بيانات متجرك (Ctrl+J)",
        icon: Sparkles,
        keywords: ["ai", "ذكاء", "مساعد", "nova"],
        run: () => {
          setOpen(false);
          window.dispatchEvent(new Event("clp:open-copilot"));
        },
      });
    }
    list.push({
      id: "tour",
      label: "جولة سريعة في اللوحة",
      icon: HelpCircle,
      keywords: ["مساعده", "شرح", "help", "tour"],
      run: () => {
        setOpen(false);
        window.dispatchEvent(new Event("clp:reopen-tour"));
      },
    });
    return list;
  }, [go, hasStore, storeHref, soundOn, toggleSound]);

  const q = norm(query.trim());
  const shownPages = pages.filter((c) => matches(c, q));
  const shownActions = actions.filter((c) => matches(c, q));
  const showLogout = !q || "تسجيل الخروج logout".includes(q) || norm("تسجيل الخروج").includes(q);
  const waiting = searching && query.trim() !== searched;
  const nothing = !waiting && hits.length === 0 && shownPages.length === 0 && shownActions.length === 0 && !showLogout;

  const hitRow = (h: SearchHit) => {
    if (h.kind === "order") {
      return (
        <Item key={`o:${h.id}`} value={`o:${h.id}`} icon={ShoppingCart} onSelect={() => go(`/dashboard/orders/${h.id}`)}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold" dir="ltr" style={{ textAlign: "right" }}>
              {h.title}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-ink-3">{h.sub}</span>
          </span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-black", TONE_CHIP[orderStatusTone(h.status)])}>
            {orderStatusLabel(h.status)}
          </span>
          <span className="shrink-0 text-[12px] font-black tabular-nums">{formatEgp(h.totalPiasters)}</span>
        </Item>
      );
    }
    if (h.kind === "product") {
      return (
        <Item key={`p:${h.id}`} value={`p:${h.id}`} icon={Package} image={h.image} onSelect={() => go(`/dashboard/products/${h.id}`)}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold">{h.title}</span>
            <span className="mt-0.5 block truncate text-[11px] text-ink-3">
              {h.status === "active" ? "منشور" : h.status === "draft" ? "مسودة" : "مخفي"} · {h.sub}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-black tabular-nums">{formatEgp(h.pricePiasters)}</span>
        </Item>
      );
    }
    return (
      <Item key={`c:${h.id}`} value={`c:${h.id}`} icon={Users} onSelect={() => go(`/dashboard/orders?q=${encodeURIComponent(h.sub)}`)}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold">{h.title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-3" dir="ltr" style={{ textAlign: "right" }}>
            {h.sub}
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-bold text-ink-3">
          {h.ordersCount > 0 ? `${arCount(h.ordersCount, NOUN.order)} · عرض طلباته` : "عرض طلباته"}
        </span>
      </Item>
    );
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="ابحث أو انتقل"
      container={container ?? undefined}
      shouldFilter={false}
      loop
      overlayClassName="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
      contentClassName="fixed inset-x-3 top-[max(4rem,10dvh)] z-[91] mx-auto max-w-xl"
    >
      <div dir="rtl" className="dash-palette overflow-hidden rounded-2xl border border-edge/15 bg-space-2 text-ink shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3 border-b border-edge/10 px-4 py-3.5">
          {waiting ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-nova-2" aria-hidden="true" />
          ) : (
            <SearchIcon className="size-4 shrink-0 text-ink-3" strokeWidth={2.25} aria-hidden="true" />
          )}
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={hasStore ? "ابحث برقم طلب أو موبايل عميل أو اسم منتج…" : "ابحث عن صفحة أو أمر…"}
            className="min-w-0 flex-1 bg-transparent text-[14px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-3"
          />
          <kbd className="hidden shrink-0 rounded-md border border-edge/10 bg-edge/[0.05] px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink-3 sm:block" dir="ltr">
            Esc
          </kbd>
        </div>

        <Command.List className="max-h-[min(60dvh,440px)] overflow-y-auto overscroll-contain p-2">
          {nothing ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[13px] font-bold text-ink-2">لا نتائج لـ «{query.trim()}»</p>
              <p className="mt-1 text-[11.5px] text-ink-3">جرّب كود الطلب كاملاً مثل CLP-1042، أو آخر 4 أرقام من موبايل العميل.</p>
            </div>
          ) : null}

          {hits.length > 0 ? (
            <Command.Group heading="في متجرك" className={GROUP}>{hits.map(hitRow)}</Command.Group>
          ) : waiting ? (
            <div className="space-y-1.5 p-1" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-edge/[0.04]" />
              ))}
            </div>
          ) : null}

          {shownPages.length > 0 ? (
            <Command.Group heading="انتقل إلى" className={GROUP}>
              {shownPages.map((c) => (
                <Item key={c.id} value={c.id} icon={c.icon} onSelect={c.run}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold">{c.label}</span>
                    {c.hint ? <span className="mt-0.5 block truncate text-[11px] text-ink-3">{c.hint}</span> : null}
                  </span>
                </Item>
              ))}
            </Command.Group>
          ) : null}

          {shownActions.length > 0 ? (
            <Command.Group heading="إجراءات" className={GROUP}>
              {shownActions.map((c) => (
                <Item key={c.id} value={c.id} icon={c.icon} onSelect={c.run}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold">{c.label}</span>
                    {c.hint ? <span className="mt-0.5 block truncate text-[11px] text-ink-3">{c.hint}</span> : null}
                  </span>
                </Item>
              ))}
            </Command.Group>
          ) : null}

          {showLogout ? (
            <Command.Group className="mt-1 border-t border-edge/[0.06] pt-1">
              <Item
                value="logout"
                icon={LogOut}
                danger
                onSelect={() => {
                  setOpen(false);
                  void merchantLogoutAction().catch(() => toast.error("تعذر تسجيل الخروج"));
                }}
              >
                <span className="text-[12.5px] font-bold">تسجيل الخروج</span>
              </Item>
            </Command.Group>
          ) : null}
        </Command.List>

        <div className="hidden items-center gap-4 border-t border-edge/10 bg-edge/[0.02] px-4 py-2.5 text-[11px] text-ink-3 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded bg-edge/[0.06] px-1 font-mono" dir="ltr">
              ↑↓
            </kbd>
            للتنقل
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded bg-edge/[0.06] px-1 font-mono" dir="ltr">
              Enter
            </kbd>
            للفتح
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}

function Item({
  value,
  icon: Icon,
  image,
  danger,
  onSelect,
  children,
}: {
  value: string;
  icon: LucideIcon;
  image?: string | null;
  danger?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "group flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
        danger ? "text-bad data-[selected=true]:bg-bad/10" : "data-[selected=true]:bg-nova/12"
      )}
    >
      {image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" onError={() => setBroken(true)} className="size-8 shrink-0 rounded-lg border border-edge/10 object-cover" />
      ) : (
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg border",
            danger
              ? "border-bad/20 bg-bad/10"
              : "border-edge/10 bg-edge/[0.03] text-ink-2 group-data-[selected=true]:border-nova/30 group-data-[selected=true]:text-nova-2"
          )}
        >
          <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      {children}
    </Command.Item>
  );
}
