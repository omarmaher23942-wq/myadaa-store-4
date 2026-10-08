// Footer.tsx — تذييل المتجر.
//
// السبب الجذري للإصلاح (التكرار المقرف):
// POLICY_LINKS و pages.showInFooter كلاهما يشملان (shipping, returns, privacy,
// terms)، فيظهر كل رابط مرتين. الحل: فلترة الصفحات لاستثناء ما هو مُغطى في
// POLICY_LINKS. كذلك إزالة تكرار الهاتف/واتساب عند تطابق الأرقام.
import Link from "next/link";
import {
  Facebook,
  Instagram,
  Phone,
  MessageCircle,
  Banknote,
  Smartphone,
  Wallet,
  ShieldCheck,
  Truck,
  RotateCcw,
  FileText,
  Package,
  Mail,
} from "lucide-react";
import type { StoreBlueprint } from "@/blueprint/schema";
import type { StoreFact } from "@/blueprint/facts";
import { Icon } from "./Icon";

const SW = 1.75;

// روابط السياسات الثابتة — مصدرها الوحيد POLICY_LINKS.
const POLICY_LINKS = [
  { href: "/pages/shipping", slug: "shipping", label: "سياسة الشحن", icon: Truck },
  { href: "/pages/returns", slug: "returns", label: "الاستبدال والاسترجاع", icon: RotateCcw },
  { href: "/pages/privacy", slug: "privacy", label: "سياسة الخصوصية", icon: FileText },
  { href: "/pages/terms", slug: "terms", label: "الشروط والأحكام", icon: FileText },
] as const;

const POLICY_SLUGS = new Set<string>(POLICY_LINKS.map((p) => p.slug));

// إزالة الأرقام المكررة (هاتف/واتساب) عبر تطبيع مبسط.
function normalizePhone(v: string): string {
  return v.replace(/\D/g, "");
}

export function Footer({
  footer,
  brand,
  channels,
  pages,
  payments,
  categories,
  facts = [],
}: {
  facts?: StoreFact[];
  footer: StoreBlueprint["footer"];
  brand: StoreBlueprint["brand"];
  channels: StoreBlueprint["channels"];
  pages: StoreBlueprint["pages"];
  payments: StoreBlueprint["payments"];
  categories: { id: string; name: string; slug: string }[];
}) {
  const year = new Date().getFullYear();

  // 1) الصفحات المفعّلة في الفوتر، مع استثناء ما هو موجود في POLICY_LINKS
  //    لتفادي التكرار المقرف.
  const uniqueEnabledPages = pages.filter(
    (p) => p.enabled && p.showInFooter && !POLICY_SLUGS.has(p.slug)
  );

  // 2) منع تكرار الهاتف/الواتساب عند تطابق الرقم.
  const phoneNorm = channels.phone ? normalizePhone(channels.phone) : "";
  const whatsappNorm = channels.whatsappNumber
    ? normalizePhone(channels.whatsappNumber)
    : "";
  const showPhone = Boolean(channels.phone);
  const showWhatsapp =
    Boolean(channels.whatsappNumber) && whatsappNorm !== phoneNorm;

  // 3) الأقسام التي لا تتكرر.
  const uniqueCategories = categories.slice(0, 7);

  return (
    <footer
      className="mt-20 border-t"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--card-foreground)",
      }}
      dir="rtl"
    >
      <div className="container-x grid gap-10 py-14 md:grid-cols-12">
        {/* العمود 1: الهوية + المزايا */}
        <div className="space-y-4 md:col-span-5">
          <p
            className="font-heading text-2xl font-black"
            style={{ color: "var(--card-foreground)" }}
          >
            {brand.name}
          </p>
          <p className="max-w-md text-xs leading-relaxed opacity-75">
            {footer.tagline || brand.tagline || brand.description}
          </p>

          {/* وعود المتجر الحقيقية فقط (من سياسته الحالية)، لا عبارات ثابتة. */}
          {facts.length ? (
            <ul className="flex flex-wrap gap-3 pt-1 text-[11px] font-bold opacity-85">
              {facts.slice(0, 3).map((f) => (
                <li key={f.key} className="flex items-center gap-1.5">
                  <Icon name={f.icon} className="size-3.5 text-[var(--primary)]" />
                  {f.title}
                </li>
              ))}
            </ul>
          ) : null}

          {footer.showChannels ? (
            <ul className="flex flex-wrap gap-2 pt-2">
              {channels.whatsappNumber ? (
                <li>
                  <a
                    href={`https://wa.me/2${channels.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="واتساب"
                    className="grid size-10 place-items-center rounded-xl border transition-colors hover:opacity-80"
                    style={{
                      background:
                        "color-mix(in srgb, var(--muted) 60%, transparent)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <MessageCircle
                      className="size-4"
                      strokeWidth={SW}
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ) : null}
              {channels.phone ? (
                <li>
                  <a
                    href={`tel:${channels.phone}`}
                    aria-label="اتصل بنا"
                    className="grid size-10 place-items-center rounded-xl border transition-colors hover:opacity-80"
                    style={{
                      background:
                        "color-mix(in srgb, var(--muted) 60%, transparent)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <Phone
                      className="size-4"
                      strokeWidth={SW}
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ) : null}
              {channels.instagramUsername ? (
                <li>
                  <a
                    href={`https://instagram.com/${channels.instagramUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="إنستجرام"
                    className="grid size-10 place-items-center rounded-xl border transition-colors hover:opacity-80"
                    style={{
                      background:
                        "color-mix(in srgb, var(--muted) 60%, transparent)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <Instagram
                      className="size-4"
                      strokeWidth={SW}
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ) : null}
              {channels.facebookUrl ? (
                <li>
                  <a
                    href={channels.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="فيسبوك"
                    className="grid size-10 place-items-center rounded-xl border transition-colors hover:opacity-80"
                    style={{
                      background:
                        "color-mix(in srgb, var(--muted) 60%, transparent)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <Facebook
                      className="size-4"
                      strokeWidth={SW}
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        {/* العمود 2: الأقسام */}
        {uniqueCategories.length > 0 ? (
          <nav className="md:col-span-3" aria-label="أقسام المتجر">
            <h3 className="mb-4 text-[11px] font-black uppercase tracking-wider opacity-70">
              أقسام المتجر
            </h3>
            <ul className="space-y-2.5 text-xs font-bold">
              {uniqueCategories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/c/${c.slug}`}
                    className="transition-opacity hover:opacity-70"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {/* العمود 3: خدمة العملاء (بدون تكرار) */}
        <nav className="md:col-span-2" aria-label="خدمة العملاء">
          <h3 className="mb-4 text-[11px] font-black uppercase tracking-wider opacity-70">
            خدمة العملاء
          </h3>
          <ul className="space-y-2.5 text-xs font-bold">
            <li>
              <Link
                href="/track"
                className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
              >
                <Package
                  className="size-3.5"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                تتبّع طلبك
              </Link>
            </li>
            {POLICY_LINKS.filter((l) => pages.some((p) => p.slug === l.slug)).map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
                  >
                    <Icon
                      className="size-3.5"
                      strokeWidth={SW}
                      aria-hidden="true"
                    />
                    {p.label}
                  </Link>
                </li>
              );
            })}
            {uniqueEnabledPages.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/pages/${p.slug}`}
                  className="transition-opacity hover:opacity-70"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* العمود 4: التواصل (بدون تكرار) */}
        <div className="md:col-span-2">
          <h3 className="mb-4 text-[11px] font-black uppercase tracking-wider opacity-70">
            تواصل معنا
          </h3>
          <ul className="space-y-2.5 text-xs font-bold">
            {showPhone ? (
              <li className="flex items-center gap-1.5">
                <Phone
                  className="size-3.5 shrink-0"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                <a
                  href={`tel:${channels.phone}`}
                  dir="ltr"
                  className="font-mono tabular-nums"
                >
                  {channels.phone}
                </a>
              </li>
            ) : null}
            {showWhatsapp ? (
              <li className="flex items-center gap-1.5">
                <MessageCircle
                  className="size-3.5 shrink-0"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                <a
                  href={`https://wa.me/2${channels.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="font-mono tabular-nums"
                >
                  {channels.whatsappNumber}
                </a>
              </li>
            ) : null}
            {channels.email ? (
              <li className="flex items-center gap-1.5">
                <Mail
                  className="size-3.5 shrink-0"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                <a
                  href={`mailto:${channels.email}`}
                  dir="ltr"
                  className="truncate font-mono"
                >
                  {channels.email}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {/* الشريط السفلي: الحقوق + وسائل الدفع */}
      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="container-x flex flex-wrap items-center justify-between gap-3 py-5">
          <p className="text-[11px] font-bold opacity-60">
            © {year} {brand.name}. جميع الحقوق محفوظة.
          </p>

          {footer.showPaymentIcons ? (
            <ul className="flex flex-wrap gap-2 text-[11px] font-black">
              {payments.cod.enabled ? (
                <li
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1"
                  style={{
                    background: "color-mix(in srgb, #16a34a 12%, transparent)",
                    borderColor: "color-mix(in srgb, #16a34a 30%, transparent)",
                    color: "#15803d",
                  }}
                >
                  <Banknote
                    className="size-3.5"
                    strokeWidth={SW}
                    aria-hidden="true"
                  />
                  دفع عند الاستلام
                </li>
              ) : null}
              {payments.vodafoneCash.enabled ? (
                <li
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1"
                  style={{
                    background: "color-mix(in srgb, #dc2626 12%, transparent)",
                    borderColor: "color-mix(in srgb, #dc2626 30%, transparent)",
                    color: "#b91c1c",
                  }}
                >
                  <Smartphone
                    className="size-3.5"
                    strokeWidth={SW}
                    aria-hidden="true"
                  />
                  فودافون كاش
                </li>
              ) : null}
              {payments.instapay.enabled ? (
                <li
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1"
                  style={{
                    background: "color-mix(in srgb, #7c3aed 12%, transparent)",
                    borderColor: "color-mix(in srgb, #7c3aed 30%, transparent)",
                    color: "#6d28d9",
                  }}
                >
                  <Wallet
                    className="size-3.5"
                    strokeWidth={SW}
                    aria-hidden="true"
                  />
                  InstaPay
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}