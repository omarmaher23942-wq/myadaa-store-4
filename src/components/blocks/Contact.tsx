// Contact — بطاقات تواصل (هاتف، واتساب، إنستاباي).
import { Phone, MessageCircle, Wallet, MapPin } from "lucide-react";
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";
import type { Ctx } from "./_shared";
import type * as S from "@/blueprint/schema";

type ContactSection = ReturnType<typeof S.contactSection.parse> & {
  address?: string;
  subtitle?: string;
};

type ContactChannels = {
  phone?: string;
  whatsappNumber?: string;
  instapayAddress?: string;
};

export function Contact({ s, ctx }: { s: ContactSection; ctx: Ctx }) {
  const channels = (ctx.channels ?? {}) as ContactChannels;
  const hasAny =
    channels.phone || channels.whatsappNumber || channels.instapayAddress;
  if (!hasAny) return null;

  const cards = [
    channels.phone
      ? {
          icon: Phone,
          title: "الهاتف المباشر",
          value: channels.phone,
          href: `tel:${channels.phone}`,
          ltr: true,
        }
      : null,
    channels.whatsappNumber
      ? {
          icon: MessageCircle,
          title: "واتساب المتجر",
          value: channels.whatsappNumber,
          href: `https://wa.me/2${channels.whatsappNumber}`,
          ltr: true,
          external: true,
        }
      : null,
    (channels as { instapayAddress?: string }).instapayAddress
      ? {
          icon: Wallet,
          title: "إنستاباي",
          value: (channels as { instapayAddress?: string }).instapayAddress!,
          href: undefined,
          ltr: true,
        }
      : null,
  ].filter(Boolean) as Array<{
    icon: typeof Phone;
    title: string;
    value: string;
    href?: string;
    ltr?: boolean;
    external?: boolean;
  }>;

  return (
    <SectionShell s={s}>
      <SectionHeading
        title={s.title || "تواصل معنا"}
        subtitle={s.subtitle}
        sectionId={s.id}
      />
      <ul className="grid gap-3 sm:grid-cols-2" dir="rtl">
        {cards.map((c) => {
          const Icon = c.icon;
          const Inner = (
            <>
              <span
                className="grid size-11 shrink-0 place-items-center rounded-2xl"
                style={{
                  background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                  color: "var(--primary)",
                }}
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black">{c.title}</p>
                <p
                  dir={c.ltr ? "ltr" : undefined}
                  className="mt-0.5 truncate font-mono text-sm font-bold opacity-80"
                >
                  {c.value}
                </p>
              </div>
            </>
          );

          return (
            <li key={c.title}>
              {c.href ? (
                <a
                  href={c.href}
                  {...(c.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="flex items-center gap-3 rounded-3xl border p-5 shadow-xs transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    color: "var(--card-foreground)",
                  }}
                >
                  {Inner}
                </a>
              ) : (
                <div
                  className="flex items-center gap-3 rounded-3xl border p-5 shadow-xs"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    color: "var(--card-foreground)",
                  }}
                >
                  {Inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {s.address ? (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-3xl border p-5 text-xs leading-relaxed"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--card-foreground)",
          }}
        >
          <MapPin
            className="mt-0.5 size-4 shrink-0"
            style={{ color: "var(--primary)" }}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span>{s.address}</span>
        </div>
      ) : null}
    </SectionShell>
  );
}