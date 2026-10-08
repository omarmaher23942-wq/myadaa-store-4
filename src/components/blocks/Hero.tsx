// Hero — واجهة المتجر. ستة تخطيطات يختار منها المدير الفني حسب المتجر وصوره الفعلية:
//   split: نص وصورة جنباً إلى جنب مع صورة ثانية طافية | editorial: عنوان كبير ثم شريط صور عريض
//   collage: نص مع مجموعة صور متداخلة | product_spotlight: منتج بطل بسعره وزر شرائه
//   centered: هوية نصية قوية بخلفية ضوئية من ألوان المتجر | fullscreen: صورة كاملة بنص فوقها
// بلا حركة ظهور تعتمد على JavaScript: الواجهة أول ما يراه العميل ويجب أن تظهر فوراً (حركة CSS خفيفة فقط).
// كل النصوص من الذكاء الاصطناعي، وكل الشكل من تصميم المتجر (الخطافات .s-hero و.s-display و.s-btn...).
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { hrefFor } from "@/lib/links";
import { formatEgp } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { HeroSection } from "@/blueprint/schema";

export type HeroSpotlight = { slug: string; name: string; pricePiasters: number; compareAtPiasters: number | null; image?: string } | null;

type Layout = "split" | "editorial" | "collage" | "product_spotlight" | "centered" | "fullscreen";

function layoutOf(s: HeroSection, spotlight: HeroSpotlight): Layout {
  const imgs = s.images.length;
  const v = s.variant;
  const want: Layout =
    v === "editorial" || v === "collage" || v === "split" || v === "centered" || v === "fullscreen" || v === "product_spotlight"
      ? v
      : v === "cinematic" || v === "video"
        ? "fullscreen"
        : v === "carousel"
          ? "split"
          : "centered";
  // لا تخطيط يعتمد على صور غير موجودة.
  if (want === "product_spotlight" && !spotlight?.image) return imgs ? "split" : "centered";
  if (want === "collage" && imgs < 3) return imgs ? "split" : "centered";
  if ((want === "split" || want === "editorial" || want === "fullscreen") && !imgs) return "centered";
  return want;
}

function Ctas({ s, light }: { s: HeroSection; light?: boolean }) {
  if (!s.primaryCta && !s.secondaryCta) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      {s.primaryCta ? (
        <Link href={hrefFor(s.primaryCta.target)} className="s-btn min-w-40 !min-h-12 text-[15px]">
          {s.primaryCta.label}
          <ArrowLeft className="size-4" />
        </Link>
      ) : null}
      {s.secondaryCta ? (
        <Link href={hrefFor(s.secondaryCta.target)} className={cn("s-btn-ghost !min-h-12 text-[15px]", light && "!border-white/50 !text-white hover:!bg-white/10")}>
          {s.secondaryCta.label}
        </Link>
      ) : null}
    </div>
  );
}

function Copy({ s, center, light, size = "lg" }: { s: HeroSection; center?: boolean; light?: boolean; size?: "lg" | "xl" }) {
  return (
    <div className={cn("flex flex-col gap-4", center && "items-center text-center")}>
      {s.eyebrow ? <span className={cn("s-eyebrow", light && "!text-white/90")}>{s.eyebrow}</span> : null}
      <h1 className={cn("s-display font-heading", size === "xl" && "lg:!text-[5rem]", light && "!text-white")}>{s.headline}</h1>
      {s.subheadline ? <p className={cn("s-sub max-w-xl !text-base sm:!text-lg", center && "mx-auto", light && "!text-white !opacity-90")}>{s.subheadline}</p> : null}
      <div className={cn(center && "flex justify-center")}>
        <Ctas s={s} light={light} />
      </div>
    </div>
  );
}

export function Hero({ s, spotlight = null }: { s: HeroSection; spotlight?: HeroSpotlight }) {
  const layout = layoutOf(s, spotlight);
  const imgs = s.images;
  const pos = (i: number) => `${Math.round((imgs[i]?.focalX ?? 0.5) * 100)}% ${Math.round((imgs[i]?.focalY ?? 0.5) * 100)}%`;

  if (layout === "fullscreen") {
    return (
      <section className="s-hero relative isolate flex min-h-[78svh] items-end overflow-hidden" data-layout="fullscreen">
        <Image src={imgs[0]!.url} alt={imgs[0]!.alt || s.headline} fill priority sizes="100vw" className="-z-10 object-cover" style={{ objectPosition: pos(0) }} />
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: `linear-gradient(to top, rgb(0 0 0 / ${Math.max(0.35, s.overlayOpacity) + 0.25}), rgb(0 0 0 / ${s.overlayOpacity * 0.6}) 55%, transparent)` }} />
        <div className="container-x w-full pb-[clamp(2.5rem,8vw,6rem)] pt-32 s-rise">
          <div className="max-w-2xl">
            <Copy s={s} light size="xl" />
          </div>
        </div>
      </section>
    );
  }

  if (layout === "centered") {
    return (
      <section className="s-hero relative isolate overflow-hidden" data-layout="centered">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -top-24 start-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl rtl:translate-x-1/2" style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }} />
          <div className="absolute bottom-0 end-[10%] h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }} />
        </div>
        <div className="container-x py-[clamp(4.5rem,12vw,9rem)] s-rise">
          <div className="mx-auto max-w-3xl">
            <Copy s={s} center size="xl" />
          </div>
        </div>
      </section>
    );
  }

  if (layout === "editorial") {
    const strip = imgs.slice(0, 3);
    return (
      <section className="s-hero" data-layout="editorial">
        <div className="container-x pb-8 pt-[clamp(3rem,7vw,6rem)] s-rise">
          <div className="grid items-end gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-4">
              {s.eyebrow ? <span className="s-eyebrow">{s.eyebrow}</span> : null}
              <h1 className="s-display font-heading lg:!text-[5.2rem]">{s.headline}</h1>
            </div>
            <div className="flex flex-col gap-4 lg:pb-3">
              {s.subheadline ? <p className="s-sub !text-base">{s.subheadline}</p> : null}
              <Ctas s={s} />
            </div>
          </div>
        </div>
        <div className="container-x pb-[clamp(2rem,5vw,4rem)]">
          <div className={cn("grid gap-3 sm:gap-4", strip.length === 1 ? "grid-cols-1" : strip.length === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr]")}>
            {strip.map((im, i) => (
              <div key={i} className={cn("s-hero-media s-media relative !p-0", strip.length === 3 && i === 0 ? "col-span-2 !aspect-[16/10] md:col-span-1 md:!aspect-auto md:h-[26rem]" : "!aspect-[4/5] md:!aspect-auto md:h-[26rem]")}>
                <Image src={im.url} alt={im.alt || ""} fill priority={i === 0} sizes="(max-width: 768px) 100vw, 40vw" className="!absolute object-cover" style={{ objectPosition: pos(i) }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "collage") {
    const c = imgs.slice(0, 4);
    return (
      <section className="s-hero" data-layout="collage">
        <div className="container-x grid items-center gap-10 py-[clamp(3rem,7vw,6rem)] lg:grid-cols-2">
          <div className="s-rise">
            <Copy s={s} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {c.map((im, i) => (
              <div key={i} className={cn("s-hero-media s-media relative !p-0", i % 2 === 1 ? "translate-y-6 sm:translate-y-10" : "", i === 0 || i === 3 ? "!aspect-[4/5]" : "!aspect-square")}>
                <Image src={im.url} alt={im.alt || ""} fill priority={i < 2} sizes="(max-width: 1024px) 50vw, 25vw" className="!absolute object-cover" style={{ objectPosition: pos(i) }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "product_spotlight" && spotlight) {
    const href = `/p/${encodeURIComponent(spotlight.slug)}`;
    return (
      <section className="s-hero relative isolate overflow-hidden" data-layout="product_spotlight">
        <div aria-hidden="true" className="absolute inset-y-0 end-0 -z-10 w-full md:w-1/2" style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--primary) 16%, var(--background)), color-mix(in srgb, var(--accent) 12%, var(--background)))" }} />
        <div className="container-x grid items-center gap-8 py-[clamp(3rem,7vw,6rem)] md:grid-cols-2 md:gap-14">
          <div className="s-rise">
            <Copy s={s} />
          </div>
          <Link href={href} className="group relative mx-auto block w-full max-w-md">
            <div className="s-hero-media s-media relative !aspect-[4/5]">
              <Image src={spotlight.image!} alt={spotlight.name} fill priority sizes="(max-width: 768px) 90vw, 40vw" className="!static object-cover" />
            </div>
            <div className="s-card absolute -bottom-5 start-4 end-4 flex items-center justify-between gap-3 p-3.5 sm:start-6 sm:end-auto sm:min-w-64">
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{spotlight.name}</span>
                <span className="s-price mt-0.5 inline-block text-sm">{formatEgp(spotlight.pricePiasters)}</span>
              </span>
              <span className="s-btn !size-10 !min-h-0 !rounded-full !p-0" aria-hidden="true">
                <ArrowLeft className="size-4" />
              </span>
            </div>
          </Link>
        </div>
      </section>
    );
  }

  // split
  return (
    <section className="s-hero" data-layout="split">
      <div className="container-x grid items-center gap-8 py-[clamp(2.5rem,6vw,5.5rem)] md:grid-cols-2 md:gap-14">
        <div className="order-2 md:order-1 s-rise">
          <Copy s={s} />
        </div>
        <div className="relative order-1 md:order-2">
          <div className="s-hero-media s-media relative !aspect-[4/5] !p-0 sm:!aspect-[5/6]">
            <Image src={imgs[0]!.url} alt={imgs[0]!.alt || s.headline} fill priority sizes="(max-width: 768px) 100vw, 50vw" className="!absolute object-cover" style={{ objectPosition: pos(0) }} />
          </div>
          {imgs[1] ? (
            <div className="s-hero-media s-media absolute -bottom-6 -start-4 hidden w-40 !aspect-square !p-0 shadow-2xl ring-4 ring-[var(--background)] sm:block lg:w-52">
              <Image src={imgs[1].url} alt={imgs[1].alt || ""} fill sizes="13rem" className="!absolute object-cover" style={{ objectPosition: pos(1) }} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
