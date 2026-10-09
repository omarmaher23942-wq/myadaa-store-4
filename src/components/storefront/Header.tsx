"use client";

// Header.tsx — رأس المتجر.
//
// السبب الجذري للإصلاح (تكرار "كل المنتجات"):
// header.nav.label و categories.name قد يتطابقان نصياً، فيظهر الرابط مرتين
// في الـ nav (مرة من nav، ومرة من categories). الحل: فلترة categories
// لإزالة أي قسم يتطابق اسمه مع أي nav.label.
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Menu,
  Search,
  ShoppingBag,
  X,
  MessageCircle,
  User,
  Package,
} from "lucide-react";
import { useCart } from "@/store/cart";
import { useHydrated } from "./CartView";
import { arCount, NOUN } from "@/lib/format";
import { hrefFor } from "@/lib/links";
import { cn } from "@/lib/utils";
import { CUSTOMER_ACCOUNTS } from "@/lib/edition";
import { useCopy, useStore } from "./StoreProvider";
import type { StoreBlueprint } from "@/blueprint/schema";

const SW = 1.75;
type Cat = { id: string; name: string; slug: string };

export function Header({
  header,
  brand,
  categories,
  channels = {},
}: {
  header: StoreBlueprint["header"];
  brand: StoreBlueprint["brand"];
  categories: Cat[];
  channels?: StoreBlueprint["channels"];
}) {
  // السلة محفوظة في المتصفح والخادم يرسم صفراً: العدد يظهر بعد التركيب فقط (وإلا hydration mismatch في كل صفحة).
  const hydrated = useHydrated();
  const cartCount = useCart((s) => s.count());
  const count = hydrated ? cartCount : 0;
  const openCart = useCart((s) => s.open);
  const { customer, design } = useStore();
  const t = useCopy();
  const surface = design.header.surface;
  const layout = header.variant;
  const logoH = { sm: "h-7", md: "h-8 sm:h-9", lg: "h-9 sm:h-11" }[design.header.logoSize];
  // بلا روابط مخصصة: «كل المنتجات» ثم أهم الأقسام، فلا يكون الشريط فارغاً أبداً.
  const navLinks = header.nav.length ? header.nav : [{ label: t("allProducts"), target: { type: "all_products" as const } }];
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // «طلباتي»: طلبات هذا الجهاز محفوظة بلا حساب؛ تظهر الأيقونة متى وُجد طلب، وبشارة للطلبات الجارية.
  const [myOrders, setMyOrders] = useState<{ total: number; active: number }>({ total: 0, active: 0 });
  useEffect(() => {
    let alive = true;
    fetch("/api/storefront/my-orders", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { total?: number; active?: number } | null) => alive && j && setMyOrders({ total: Number(j.total) || 0, active: Number(j.active) || 0 }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // إزالة الأقسام التي تطابق أي nav.label — تمنع ظهور "كل المنتجات" مرتين.
  const uniqueCategories = useMemo(() => {
    const taken = new Set(
      header.nav
        .map((n) => n.label.trim().toLowerCase())
        .filter(Boolean)
    );
    return categories.filter(
      (c) => !taken.has(c.name.trim().toLowerCase())
    );
  }, [header.nav, categories]);

  const hasCustomLogo =
    brand.logo?.url &&
    !brand.logo.url.includes("logo.png") &&
    !brand.logo.url.includes("colapia");

  const Logo = ({ compact = false }: { compact?: boolean }) => (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 font-heading leading-none"
      aria-label={brand.name}
    >
      {hasCustomLogo ? (
        <Image
          src={brand.logo!.url}
          alt={brand.name}
          width={140}
          height={40}
          priority
          className={cn(
            "w-auto object-contain",
            compact ? "h-7" : logoH
          )}
        />
      ) : (
        <span
          className={cn("font-black tracking-tight", design.header.logoSize === "lg" ? "text-2xl sm:text-3xl" : design.header.logoSize === "sm" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl")}
          style={{ color: "var(--foreground)" }}
        >
          {brand.name}
        </span>
      )}
    </Link>
  );

  return (
    <>
      <header
        className={cn(
          "s-header sticky top-0 z-40 border-b transition-all duration-300",
          surface === "glass" && (scrolled ? "shadow-sm backdrop-blur-xl" : "backdrop-blur-md"),
          surface === "solid" && scrolled && "shadow-sm",
          !scrolled && surface !== "bordered" && "border-transparent"
        )}
        style={{
          background:
            surface === "solid" || surface === "bordered"
              ? "var(--background)"
              : surface === "transparent" && !scrolled
                ? "transparent"
                : `color-mix(in srgb, var(--background) ${scrolled ? 88 : 60}%, transparent)`,
          borderColor: scrolled || surface === "bordered" ? "var(--border)" : "transparent",
          color: "var(--foreground)",
        }}
        dir="rtl"
      >
        <div className={cn("container-x flex h-16 items-center justify-between gap-3", layout === "centered_logo" && "md:grid md:h-20 md:grid-cols-[1fr_auto_1fr]")}>
          <div className={cn("flex items-center gap-3", layout === "centered_logo" && "md:order-2 md:justify-center")}>
            <button
              type="button"
              onClick={() => setMenu(true)}
              className={cn("-ms-2 grid size-10 place-items-center rounded-xl opacity-80 transition-opacity hover:opacity-100", layout !== "minimal" && "md:hidden")}
              aria-label={t("menu")}
              aria-expanded={menu}
            >
              <Menu className="size-5" strokeWidth={SW} aria-hidden="true" />
            </button>
            <Logo />
          </div>

          <nav
            className={cn("hidden items-center gap-6 text-[13px] font-bold opacity-90", layout !== "minimal" && "md:flex", layout === "centered_logo" && "md:order-1")}
            aria-label="التنقل الرئيسي"
          >
            {navLinks.map((n) => (
              <Link
                key={n.label}
                href={hrefFor(n.target)}
                className="py-1 transition-colors hover:opacity-80"
              >
                {n.label}
              </Link>
            ))}
            {header.showCategoriesMenu
              ? uniqueCategories
                  .slice(0, 4)
                  .map((c) => (
                    <Link
                      key={c.id}
                      href={`/c/${c.slug}`}
                      className="transition-colors hover:opacity-80"
                    >
                      {c.name}
                    </Link>
                  ))
              : null}
          </nav>

          <div className={cn("flex items-center gap-1.5", layout === "centered_logo" && "md:order-3 md:justify-end")}>
            {channels.whatsappNumber ? (
              <a
                href={`https://wa.me/2${channels.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden size-10 items-center justify-center rounded-xl text-emerald-500 transition-colors hover:bg-emerald-500/10 sm:inline-flex"
                aria-label="واتساب"
              >
                <MessageCircle
                  className="size-4.5"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => setSearch((v) => !v)}
              className="grid size-10 place-items-center rounded-xl opacity-80 transition-opacity hover:opacity-100"
              aria-label="بحث"
              aria-expanded={search}
            >
              <Search className="size-4.5" strokeWidth={SW} aria-hidden="true" />
            </button>

            {myOrders.total > 0 ? (
              <Link
                href="/track"
                className="relative grid size-10 place-items-center rounded-xl opacity-80 transition-opacity hover:opacity-100"
                aria-label={myOrders.active ? `طلباتي (${myOrders.active} جارية)` : "طلباتي"}
                title="طلباتي"
              >
                <Package className="size-4.5" strokeWidth={SW} aria-hidden="true" />
                {myOrders.active ? (
                  <span className="absolute end-1.5 top-1.5 size-2.5 rounded-full ring-2 ring-[var(--background)]" style={{ background: "var(--primary)" }} aria-hidden="true" />
                ) : null}
              </Link>
            ) : null}

            {CUSTOMER_ACCOUNTS ? (
<Link
              href={customer ? "/account" : "/account/login"}
              className="grid size-10 place-items-center rounded-xl transition-colors hover:bg-[var(--muted)]"
              aria-label={
                customer ? `حسابي (${customer.name})` : "تسجيل الدخول"
              }
              title={customer ? customer.name : "تسجيل الدخول"}
            >
              {customer?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={customer.avatarUrl}
                  alt=""
                  className="size-7 rounded-full border object-cover"
                  style={{ borderColor: "var(--border)" }}
                />
              ) : (
                <User className="size-4.5" strokeWidth={SW} aria-hidden="true" />
              )}
            </Link>
) : null}

            <button
              type="button"
              onClick={openCart}
              data-cart-icon
              className="relative grid size-10 place-items-center rounded-xl transition-transform active:scale-95"
              aria-label={`السلة${count > 0 ? ` — ${arCount(count, NOUN.piece)}` : ""}`}
            >
              <ShoppingBag
                className="size-5"
                strokeWidth={SW}
                aria-hidden="true"
              />
              {count > 0 ? (
                <span
                  className="absolute end-1 top-1 grid size-4.5 min-w-4.5 place-items-center rounded-full px-1 font-mono text-[10px] font-black tabular-nums shadow"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {count}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {search ? (
          <div
            className="border-t p-3"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <form action="/search" className="container-x">
              <div
                className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                }}
              >
                <Search
                  className="size-4 opacity-50"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                <input
                  name="q"
                  placeholder={t("searchPlaceholder")}
                  className="w-full bg-transparent text-xs font-bold outline-none"
                  style={{ color: "var(--foreground)" }}
                  autoFocus
                  aria-label="البحث"
                />
                <button
                  type="button"
                  onClick={() => setSearch(false)}
                  className="grid size-7 place-items-center rounded-md opacity-50 hover:opacity-100"
                  aria-label="إغلاق البحث"
                >
                  <X className="size-4" strokeWidth={SW} aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </header>

      {menu ? (
        <div
          className={cn("fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm", layout !== "minimal" && "md:hidden")}
          onClick={() => setMenu(false)}
          role="presentation"
        >
          <aside
            className="flex h-full w-4/5 max-w-xs flex-col justify-between border-s p-5 shadow-2xl"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--card-foreground)",
            }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="قائمة التنقل"
          >
            <div className="space-y-4 overflow-y-auto">
              <div
                className="flex items-center justify-between border-b pb-3"
                style={{ borderColor: "var(--border)" }}
              >
                <Logo compact />
                <button
                  type="button"
                  onClick={() => setMenu(false)}
                  className="grid size-9 place-items-center rounded-lg opacity-70 hover:opacity-100"
                  aria-label="إغلاق"
                >
                  <X className="size-5" strokeWidth={SW} aria-hidden="true" />
                </button>
              </div>

              {CUSTOMER_ACCOUNTS ? (
<Link
                href={customer ? "/account" : "/account/login"}
                onClick={() => setMenu(false)}
                className="flex items-center gap-2.5 rounded-xl border p-3 text-xs font-bold"
                style={{ borderColor: "var(--border)" }}
              >
                {customer?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={customer.avatarUrl}
                    alt=""
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  <User
                    className="size-4"
                    strokeWidth={SW}
                    aria-hidden="true"
                  />
                )}
                <span>
                  {customer ? `حسابي (${customer.name})` : "تسجيل الدخول"}
                </span>
              </Link>
) : null}

              <Link
                href="/track"
                onClick={() => setMenu(false)}
                className="mb-2 flex items-center gap-2 rounded-xl px-3 py-3 text-xs font-black transition-colors hover:bg-[var(--muted)]"
              >
                <Package className="size-4" strokeWidth={SW} aria-hidden="true" />
                {myOrders.total > 0 ? "طلباتي" : "تتبع طلبك"}
                {myOrders.active ? (
                  <span className="ms-auto rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                    {myOrders.active} جارية
                  </span>
                ) : null}
              </Link>

              <nav className="space-y-1" aria-label="روابط المتجر">
                {navLinks.map((n) => (
                  <Link
                    key={n.label}
                    href={hrefFor(n.target)}
                    onClick={() => setMenu(false)}
                    className="block rounded-xl px-3 py-3 text-xs font-bold transition-colors hover:bg-[var(--muted)]"
                  >
                    {n.label}
                  </Link>
                ))}

                {uniqueCategories.length > 0 ? (
                  <div
                    className="border-t pt-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="mb-1 block px-3 text-[10px] font-bold opacity-60">
                      أقسام المتجر
                    </span>
                    {uniqueCategories.map((c) => (
                      <Link
                        key={c.id}
                        href={`/c/${c.slug}`}
                        onClick={() => setMenu(false)}
                        className="block px-3 py-2.5 text-xs font-medium opacity-80 hover:opacity-100"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </nav>
            </div>

            {channels.whatsappNumber ? (
              <a
                href={`https://wa.me/2${channels.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <MessageCircle
                  className="size-4"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                واتساب المتجر
              </a>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}