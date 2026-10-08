"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Store,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
  ExternalLink,
  FolderTree,
  TicketPercent,
  Truck,
  Star,
  Palette,
  Wand2,
  ShieldCheck,
  type LucideIcon,
  KeyRound,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { merchantLogoutAction } from "@/server/actions/auth";
import { cn, storeUrl, storeHost } from "@/lib/utils";
import { EDITION, INTEGRATIONS_NAV, PLATFORM_ONLY_NAV } from "@/lib/edition";
import { useNotifications } from "./RealtimeProvider";
import { StoreSwitcher, type SwitcherStore } from "./StoreSwitcher";

const SW = 1.75;

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: "orders" | "reviews" | "conversations";
};

type Props = {
  merchant: {
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
  };
  store: {
    name: string;
    subdomain: string;
    status: string;
  } | null;
  badges: {
    orders: number;
    trialDaysLeft: number | null;
  };
  allStores?: SwitcherStore[];
  pendingReviews?: number;
};

const ALL_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "الرئيسية",
    items: [
      { label: "نظرة عامة", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { label: "متجري", href: "/dashboard/store", icon: Store },
      { label: "التحليلات", href: "/dashboard/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "المبيعات",
    items: [
      { label: "الطلبات", href: "/dashboard/orders", icon: ShoppingCart, badgeKey: "orders" },
      { label: "العملاء", href: "/dashboard/customers", icon: Users },
      { label: "المراجعات", href: "/dashboard/reviews", icon: Star, badgeKey: "reviews" },
    ],
  },
  {
    title: "الكتالوج",
    items: [
      { label: "المنتجات", href: "/dashboard/products", icon: Package },
      { label: "الفئات", href: "/dashboard/categories", icon: FolderTree },
      { label: "أكواد الخصم", href: "/dashboard/discounts", icon: TicketPercent },
      { label: "الشحن", href: "/dashboard/shipping", icon: Truck },
      { label: "السياسات والضمان", href: "/dashboard/policies", icon: ShieldCheck },
    ],
  },
  {
    title: "التصميم",
    items: [
      { label: "تصميم المتجر", href: "/dashboard/design", icon: Wand2 },
      { label: "محرر المحتوى", href: "/dashboard/content", icon: Palette },
    ],
  },
  {
    title: "الحساب",
    items: [
      { label: "الإعدادات", href: "/dashboard/settings", icon: Settings },
      { label: INTEGRATIONS_NAV.label, href: INTEGRATIONS_NAV.href, icon: KeyRound },
      { label: "الفوترة", href: "/dashboard/billing", icon: CreditCard },
    ],
  },
];

const NAV_SECTIONS = ALL_SECTIONS.map((section) => ({
  ...section,
  items: section.items.filter((i) => !(PLATFORM_ONLY_NAV as readonly string[]).includes(i.href) || EDITION === "platform"),
}));

const MOBILE_NAV: NavItem[] = [
  { label: "الرئيسية", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "الطلبات", href: "/dashboard/orders", icon: ShoppingCart, badgeKey: "orders" },
  { label: "المنتجات", href: "/dashboard/products", icon: Package },
  { label: "التحليلات", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "المزيد", href: "#more", icon: Menu },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (href.includes("?")) href = href.split("?")[0]!;
  if (exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function DashboardSidebar(props: Props) {
  const pathname = usePathname() ?? "";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const reduce = useReducedMotion();

  const orderBadge = props.badges.orders;
  const close = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setDrawerOpen((v) => !v);
      }
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-e border-edge/[0.07] bg-space-2/55 backdrop-blur-2xl md:flex",
          drawerOpen && "md:hidden"
        )}
      >
        <SidebarContent
          {...props}
          pathname={pathname}
          orderBadge={orderBadge}
          close={close}
        />
      </aside>

      <nav
        aria-label="القائمة السريعة"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-edge/10 bg-space-2/95 backdrop-blur-2xl md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
      >
        <ul className="flex items-stretch justify-around gap-1 px-1 py-1.5">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href, item.exact);
            const badgeCount = item.badgeKey === "orders" ? orderBadge : 0;

            if (item.href === "#more") {
              return (
                <li key={item.href} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    aria-label="المزيد"
                    className="flex w-full flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-bold text-ink-3 transition-colors hover:bg-edge/5"
                  >
                    <Icon className="size-5" strokeWidth={SW} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex w-full flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-bold transition-colors",
                    active
                      ? "text-ink"
                      : "text-ink-3 hover:bg-edge/5 hover:text-ink"
                  )}
                >
                  <span className="relative">
                    <Icon
                      className={cn("size-5", active ? "text-nova-2" : "")}
                      strokeWidth={active ? 2.25 : SW}
                      aria-hidden="true"
                    />
                    {badgeCount > 0 ? (
                      <span className="absolute -end-1.5 -top-1 grid size-3.5 min-w-3.5 place-items-center rounded-full bg-rose-500 px-1 font-mono text-[8.5px] font-black text-white ring-2 ring-space-2">
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                  {active ? (
                    <motion.span
                      layoutId="mobile-nav-active"
                      className="absolute inset-x-2 -top-[1px] h-0.5 rounded-full bg-nova-2"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.18 }}
              onClick={close}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="قائمة لوحة التحكم"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 420, damping: 40, mass: 0.9 }
              }
              className="fixed inset-y-0 start-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-e border-edge/10 bg-space-2 md:hidden"
            >
              <button
                type="button"
                onClick={close}
                aria-label="إغلاق القائمة"
                className="absolute end-3 top-3 z-10 grid size-9 place-items-center rounded-lg text-ink-2/70 transition-colors hover:bg-edge/5 hover:text-ink"
              >
                <X className="size-4" strokeWidth={2.25} aria-hidden="true" />
              </button>
              <SidebarContent
                {...props}
                pathname={pathname}
                orderBadge={orderBadge}
                close={close}
                isMobile
              />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function SidebarContent({
  merchant,
  store,
  allStores,
  pendingReviews,
  pathname,
  orderBadge,
  close,
  isMobile,
}: Props & {
  pathname: string;
  orderBadge: number;
  close: () => void;
  isMobile?: boolean;
}) {
  const { notifications } = useNotifications();
  const pendingReviewsCount = pendingReviews ?? 0;

  const getBadge = (item: NavItem): number => {
    if (item.badgeKey === "orders") return orderBadge;
    if (item.badgeKey === "reviews") return pendingReviewsCount;
    if (item.badgeKey === "conversations") return notifications.length;
    return 0;
  };

  return (
    <>
      <div className="border-b border-edge/10 p-4">
        {allStores && allStores.length >= 2 ? (
          <StoreSwitcher
            currentStore={
              store
                ? {
                    id:
                      allStores.find((s) => s.subdomain === store.subdomain)?.id ??
                      "current",
                    name: store.name,
                    subdomain: store.subdomain,
                    status: store.status,
                  }
                : null
            }
            stores={allStores}
          />
        ) : (
          <Link
            href="/dashboard"
            onClick={close}
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
          >
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-nova to-aurora text-[14px] font-black text-white shadow-lg shadow-nova/30 ring-1 ring-white/20">
              {store ? store.name.charAt(0) : merchant.displayName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-ink">
                {store ? store.name : merchant.displayName}
              </p>
              {store ? (
                <p
                  dir="ltr"
                  className="truncate text-[10.5px] font-medium text-ink-3"
                >
                  {storeHost(store.subdomain)}
                </p>
              ) : (
                <p className="truncate text-[10.5px] text-ink-3">
                  بدون متجر بعد
                </p>
              )}
            </div>
          </Link>
        )}

        {store ? (
          <a
            href={storeUrl(store.subdomain)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-edge/10 bg-edge/[0.03] px-3 py-1.5 text-[11px] font-bold text-ink-2 transition-colors hover:bg-edge/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova"
          >
            <span>معاينة المتجر</span>
            <ExternalLink className="size-3" strokeWidth={2.25} aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <nav
        aria-label="القائمة الرئيسية"
        className="hide-scrollbar flex-1 space-y-5 overflow-y-auto p-3"
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-2.5 text-[10px] font-black uppercase tracking-wider text-ink-3/70">
              {section.title}
            </p>
            <ul className="isolate space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href, item.exact);
                const count = getBadge(item);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] font-bold transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova",
                        active ? "text-ink" : "text-ink-2/75 hover:bg-edge/[0.04] hover:text-ink"
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId={isMobile ? "drawer-nav-active" : "sidebar-nav-active"}
                          aria-hidden="true"
                          transition={{ type: "spring", stiffness: 420, damping: 36 }}
                          className="absolute inset-0 -z-10 rounded-xl border border-nova/25 bg-gradient-to-l from-nova/[0.18] via-nova/[0.08] to-aurora/[0.06] shadow-[0_8px_24px_-12px_rgb(var(--dash-glow)/0.7)]"
                        >
                          <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-gradient-to-b from-nova-2 to-aurora" />
                        </motion.span>
                      ) : null}

                      <Icon
                        strokeWidth={SW}
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          active
                            ? "text-nova-2"
                            : "text-ink-3 group-hover:text-ink-2"
                        )}
                        aria-hidden="true"
                      />

                      <span className="flex-1 truncate">{item.label}</span>

                      {count > 0 ? (
                        <span className="rounded-full bg-nova px-1.5 py-0.5 font-mono text-[10px] font-black text-white tabular-nums">
                          {count > 99 ? "99+" : count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-edge/10 p-3">
        <form action={merchantLogoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[11.5px] font-bold text-ink-2/60 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <LogOut strokeWidth={SW} className="size-4" aria-hidden="true" />
            <span>تسجيل الخروج</span>
          </button>
        </form>
      </div>
    </>
  );
}