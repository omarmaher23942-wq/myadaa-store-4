"use client";

// components/dashboard/CommandPalette.tsx — لوحة أوامر موحّدة (⌘K).
//
// السبب الجذري:
// التنقل بالماوس في داشبورد فيه 12+ صفحة مرهق. لوحة الأوامر تعطي التاجر
// قوة فورية: اكتب "طلبات" → Enter → في الصفحة.
//
// المبادئ:
//  - ⌘K / Ctrl+K لفتحها، Esc لإغلاقها.
//  - 5 مجموعات: تنقل، إجراءات سريعة، بحث، متجر، مساعدة.
//  - كل action يعرف deep link.
//  - بحث fuzzy على العربية والإنجليزية.
//  - لا يستدعي APIs إلا عند الحاجة.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Home,
  Store,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Plus,
  ExternalLink,
  MessageCircle,
  Search as SearchIcon,
  HelpCircle,
  Palette,
  Tag,
  Truck,
  Star,
  Sparkles,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { merchantLogoutAction } from "@/server/actions/auth";
import { EDITION } from "@/lib/edition";

const SW = 2.25;

type CmdItem = {
  id: string;
  group: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  keywords?: string[];
  action: () => void | Promise<void>;
};

const PLATFORM_ONLY_IDS = new Set(["nav-store", "nav-billing"]);

export function CommandPalette({ storeHref }: { storeHref?: string | null } = {}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  // ⌘K to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset query on close.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const nav = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const handleLogout = useCallback(async () => {
    setOpen(false);
    try {
      await merchantLogoutAction();
    } catch {
      toast.error("تعذر تسجيل الخروج");
    }
  }, []);

  const items: CmdItem[] = useMemo(
    () => [
      // ─── التنقل
      {
        id: "nav-home",
        group: "التنقل",
        label: "نظرة عامة",
        description: "الصفحة الرئيسية للداشبورد",
        icon: Home,
        keywords: ["home", "main", "الرئيسية"],
        action: () => nav("/dashboard"),
      },
      {
        id: "nav-store",
        group: "التنقل",
        label: "متجري",
        description: "تفاصيل وإعدادات المتجر",
        icon: Store,
        keywords: ["store", "shop"],
        action: () => nav("/dashboard/store"),
      },
      {
        id: "nav-orders",
        group: "التنقل",
        label: "الطلبات",
        description: "إدارة وتتبع الطلبات",
        icon: ShoppingCart,
        keywords: ["orders", "الاوردرات"],
        action: () => nav("/dashboard/orders"),
      },
      {
        id: "nav-products",
        group: "التنقل",
        label: "المنتجات",
        description: "كتالوج المنتجات والمخزون",
        icon: Package,
        keywords: ["products", "المنتجات"],
        action: () => nav("/dashboard/products"),
      },
      {
        id: "nav-customers",
        group: "التنقل",
        label: "العملاء",
        description: "قاعدة عملاء متجرك",
        icon: Users,
        keywords: ["customers", "العملاء"],
        action: () => nav("/dashboard/customers"),
      },
      {
        id: "nav-analytics",
        group: "التنقل",
        label: "التحليلات",
        description: "مؤشرات الأداء والتقارير",
        icon: BarChart3,
        keywords: ["analytics", "stats", "تحليلات"],
        action: () => nav("/dashboard/analytics"),
      },
      {
        id: "nav-design",
        group: "التنقل",
        label: "التصميم",
        description: "محرر التصميم الحي",
        icon: Palette,
        keywords: ["design", "editor", "تصميم"],
        action: () => nav("/dashboard/design"),
      },
      {
        id: "nav-settings",
        group: "التنقل",
        label: "الإعدادات",
        description: "إعدادات الحساب والمتجر",
        icon: Settings,
        keywords: ["settings", "إعدادات"],
        action: () => nav("/dashboard/settings"),
      },
      {
        id: "nav-billing",
        group: "التنقل",
        label: "الفوترة والتفعيل",
        description: "خطة الاشتراك والدفع",
        icon: CreditCard,
        keywords: ["billing", "payment", "دفع"],
        action: () => nav("/dashboard/billing"),
      },

      // ─── إجراءات سريعة
      {
        id: "action-new-product",
        group: "إجراءات سريعة",
        label: "أضف منتجاً جديداً",
        description: "فتح نموذج منتج جديد",
        icon: Plus,
        keywords: ["add", "new", "منتج جديد", "إضافة"],
        action: () => nav("/dashboard/products/new"),
      },
      {
        id: "action-new-discount",
        group: "إجراءات سريعة",
        label: "أنشئ كود خصم",
        description: "كود خصم جديد للعملاء",
        icon: Tag,
        keywords: ["discount", "coupon", "خصم"],
        action: () => nav("/dashboard/settings?tab=discounts"),
      },
      {
        id: "action-edit-shipping",
        group: "إجراءات سريعة",
        label: "عدّل أسعار الشحن",
        description: "مناطق الشحن لكل محافظة",
        icon: Truck,
        keywords: ["shipping", "شحن"],
        action: () => nav("/dashboard/settings?tab=shipping"),
      },
      {
        id: "action-reviews",
        group: "إجراءات سريعة",
        label: "راجع تقييمات العملاء",
        description: "اعتماد أو رفض التقييمات",
        icon: Star,
        keywords: ["reviews", "تقييمات"],
        action: () => nav("/dashboard/settings?tab=reviews"),
      },

      // ─── المتجر
      {
        id: "store-preview",
        group: "المتجر",
        label: "معاينة المتجر",
        description: "فتح المتجر في تبويب جديد",
        icon: ExternalLink,
        keywords: ["preview", "معاينة", "view"],
        action: () => {
          setOpen(false);
          window.open(storeHref || "/", "_blank");
        },
      },
      {
        id: "store-whatsapp",
        group: "المتجر",
        label: "افتح واتساب المتجر",
        description: "محادثة مباشرة مع العملاء",
        icon: MessageCircle,
        keywords: ["whatsapp", "واتساب"],
        action: () => {
          setOpen(false);
          window.open("https://wa.me/", "_blank");
        },
      },

      // ─── مساعدة
      {
        id: "help-guide",
        group: "مساعدة",
        label: "دليل البدء السريع",
        description: "افتح tour الجولة",
        icon: HelpCircle,
        keywords: ["help", "guide", "مساعدة"],
        action: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("clp:reopen-tour"));
        },
      },
      {
        id: "help-ai",
        group: "مساعدة",
        label: "اسأل نوفا (المساعد الذكي)",
        description: "مبيعاتك، مخزونك، منشور جاهز... (Ctrl+J)",
        icon: Sparkles,
        keywords: ["ai", "ذكاء اصطناعي", "نوفا", "nova"],
        action: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent("clp:open-copilot"));
        },
      },
    ].filter((i) => EDITION === "platform" || !PLATFORM_ONLY_IDS.has(i.id)),
    [nav, storeHref]
  );

  // Grouping.
  const grouped = useMemo(() => {
    const map = new Map<string, CmdItem[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="لوحة الأوامر"
      className="fixed inset-0 z-[90] grid place-items-start justify-center bg-black/70 px-4 pt-24 backdrop-blur-md"
      loop
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-edge/15 bg-space-2 text-ink shadow-2xl shadow-black/60">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-edge/10 px-4 py-3.5">
          <SearchIcon
            className="size-4 shrink-0 text-ink-3"
            strokeWidth={SW}
            aria-hidden="true"
          />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="ابحث أو اكتب أمراً…"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none placeholder:font-normal placeholder:text-ink-3"
          />
          <kbd
            className="shrink-0 rounded-md border border-edge/10 bg-edge/[0.05] px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink-3"
            dir="ltr"
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <Command.List className="max-h-[420px] overflow-y-auto p-2">
          <Command.Empty className="grid place-items-center px-4 py-12 text-center">
            <p className="text-sm font-bold text-ink-3">لا نتائج مطابقة</p>
            <p className="mt-1 text-[11px] text-ink-3/70">
              جرّب كلمات مختلفة أو ابحث في اسم صفحة
            </p>
          </Command.Empty>

          {grouped.map(([groupName, groupItems]) => (
            <Command.Group
              key={groupName}
              heading={groupName}
              className="[&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-3"
            >
              {groupItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.description ?? ""} ${(item.keywords ?? []).join(" ")}`}
                    onSelect={() => {
                      void item.action();
                    }}
                    className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors data-[selected=true]:bg-nova/20 data-[selected=true]:text-white"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-edge/10 bg-edge/[0.03] text-ink-2 group-data-[selected=true]:border-nova-2/40 group-data-[selected=true]:bg-nova/20 group-data-[selected=true]:text-white">
                      <Icon className="size-3.5" strokeWidth={SW} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold">
                        {item.label}
                      </p>
                      {item.description ? (
                        <p className="mt-0.5 truncate text-[10.5px] text-ink-3">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}

          {/* Logout — في النهاية دائماً */}
          <Command.Group
            heading=""
            className="mt-2 border-t border-edge/5 pt-2"
          >
            <Command.Item
              value="logout signout تسجيل الخروج"
              onSelect={handleLogout}
              className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-rose-600 dark:text-rose-300 transition-colors data-[selected=true]:bg-rose-500/15"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10">
                <LogOut className="size-3.5" strokeWidth={SW} aria-hidden="true" />
              </span>
              <span className="text-[12.5px] font-bold">تسجيل الخروج</span>
            </Command.Item>
          </Command.Group>
        </Command.List>

        {/* Footer hints */}
        <div className="flex items-center justify-between gap-3 border-t border-edge/10 bg-edge/[0.02] px-4 py-2.5 text-[10px] text-ink-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded bg-edge/5 px-1 font-mono" dir="ltr">
                ↑↓
              </kbd>
              التنقل
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded bg-edge/5 px-1 font-mono" dir="ltr">
                ↵
              </kbd>
              فتح
            </span>
          </div>
          <span className="font-mono" dir="ltr">
            {items.length} أمر
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}