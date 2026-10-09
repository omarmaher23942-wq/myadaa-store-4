// design.ts — يترجم «الحمض النووي للتصميم» (bp.design) إلى CSS حقيقي للمتجر.
//
// المكوّنات لا تعرف شكل أي متجر: تستخدم خطافات ثابتة (.s-card، .s-btn، .s-media، .s-price،
// .s-badge، .s-icon، .s-title، .s-eyebrow، .s-section، .s-input، .s-chip) ومتغيرات CSS.
// هذا الملف يكتب لكل متجر قواعده الخاصة لتلك الخطافات، ثم يضيف «جلد» الذكاء الاصطناعي المنقّى.
// النتيجة: نفس المكوّنات، وشكل مختلف جذرياً لكل متجر، دون أن ينكسر التخطيط أبداً.
import type { Design, StoreBlueprint } from "./schema";
import { designSchema } from "./schema";
import { sanitizeSkinCss } from "./skin";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function rgb(hex: string | undefined, fallback = "15 23 42"): string {
  if (!hex || !HEX.test(hex)) return fallback;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const CONTAINER = { narrow: "68rem", normal: "78rem", wide: "90rem" } as const;
const SECTION_Y = { airy: "clamp(4rem, 9vw, 8rem)", balanced: "clamp(3rem, 6vw, 6rem)", compact: "clamp(2rem, 4vw, 4rem)" } as const;
const RATIO = { square: "1 / 1", portrait: "4 / 5", tall: "3 / 4", landscape: "4 / 3" } as const;
const BTN_H = { sm: "2.5rem", md: "2.875rem", lg: "3.25rem" } as const;

function shadow(level: number, tint: string): string {
  const t = rgb(tint);
  switch (level) {
    case 0:
      return "none";
    case 1:
      return `0 1px 2px rgb(${t} / .05), 0 2px 10px -4px rgb(${t} / .10)`;
    case 2:
      return `0 2px 4px rgb(${t} / .04), 0 10px 24px -10px rgb(${t} / .18)`;
    case 3:
      return `0 4px 8px rgb(${t} / .05), 0 22px 44px -18px rgb(${t} / .28)`;
    default:
      return `0 8px 16px rgb(${t} / .06), 0 36px 70px -24px rgb(${t} / .38)`;
  }
}

function surface(d: Design): string {
  const p = "var(--primary)";
  const a = "var(--accent)";
  switch (d.surface.background) {
    case "soft_gradient":
      return `background-image:linear-gradient(180deg,color-mix(in srgb,${p} 7%,var(--background)) 0,var(--background) 34rem)`;
    case "radial_glow":
      return `background-image:radial-gradient(60rem 30rem at 100% -10%,color-mix(in srgb,${p} 14%,transparent),transparent 70%),radial-gradient(50rem 26rem at 0% 0%,color-mix(in srgb,${a} 12%,transparent),transparent 70%)`;
    case "mesh":
      return `background-image:radial-gradient(40rem 30rem at 85% 5%,color-mix(in srgb,${p} 16%,transparent),transparent 65%),radial-gradient(36rem 28rem at 10% 30%,color-mix(in srgb,${a} 14%,transparent),transparent 65%),radial-gradient(44rem 30rem at 60% 80%,color-mix(in srgb,${p} 9%,transparent),transparent 70%);background-attachment:fixed`;
    case "paper":
      return "background-image:radial-gradient(color-mix(in srgb,var(--foreground) 5%,transparent) .6px,transparent .6px);background-size:4px 4px";
    case "dots":
      return `background-image:radial-gradient(color-mix(in srgb,${p} 16%,transparent) 1.2px,transparent 1.2px);background-size:22px 22px`;
    case "grid":
      return "background-image:linear-gradient(color-mix(in srgb,var(--foreground) 5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--foreground) 5%,transparent) 1px,transparent 1px);background-size:40px 40px";
    case "lines":
      return `background-image:repeating-linear-gradient(135deg,color-mix(in srgb,${p} 6%,transparent) 0 1px,transparent 1px 18px)`;
    case "waves":
      return `background-image:radial-gradient(120% 60% at 50% 0,color-mix(in srgb,${p} 10%,transparent),transparent 60%),repeating-radial-gradient(circle at 50% -40%,transparent 0 38px,color-mix(in srgb,${p} 5%,transparent) 38px 39px)`;
    default:
      return "";
  }
}

function buttonRules(d: Design, S: string): string {
  const base = `${S} .s-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:var(--btn-h);padding-inline:1.4rem;border-radius:var(--r-btn);font-weight:var(--btn-weight);font-size:.9rem;transition:transform var(--motion-fast) var(--motion-ease),filter var(--motion-fast),background-color var(--motion-base),box-shadow var(--motion-base);border:1.5px solid transparent;cursor:pointer}${S} .s-btn:active{transform:scale(.98)}${S} .s-btn:focus-visible{outline:2px solid var(--primary);outline-offset:2px}${S} .s-btn[disabled]{opacity:.5;cursor:not-allowed}`;
  const fill = {
    solid: `${S} .s-btn{background:var(--primary);color:var(--primary-foreground)}${S} .s-btn:hover{filter:brightness(1.08)}`,
    gradient: `${S} .s-btn{background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--accent) 70%,var(--primary)));color:var(--primary-foreground);box-shadow:0 10px 24px -12px color-mix(in srgb,var(--primary) 70%,transparent)}${S} .s-btn:hover{filter:brightness(1.07) saturate(1.05)}`,
    outline: `${S} .s-btn{background:transparent;color:var(--foreground);border-color:var(--foreground)}${S} .s-btn:hover{background:var(--foreground);color:var(--background)}`,
    soft: `${S} .s-btn{background:color-mix(in srgb,var(--primary) 14%,var(--background));color:var(--primary)}${S} .s-btn:hover{background:var(--primary);color:var(--primary-foreground)}`,
    glass: `${S} .s-btn{background:color-mix(in srgb,var(--primary) 82%,transparent);color:var(--primary-foreground);backdrop-filter:blur(10px);border-color:color-mix(in srgb,var(--primary-foreground) 20%,transparent)}${S} .s-btn:hover{background:var(--primary)}`,
  }[d.button.fill];
  const ghost = `${S} .s-btn-ghost{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:var(--btn-h);padding-inline:1.25rem;border-radius:var(--r-btn);font-weight:var(--btn-weight);font-size:.9rem;border:1.5px solid color-mix(in srgb,var(--foreground) 22%,transparent);color:var(--foreground);background:transparent;transition:background-color var(--motion-base),border-color var(--motion-base)}${S} .s-btn-ghost:hover{border-color:var(--foreground);background:color-mix(in srgb,var(--foreground) 5%,transparent)}`;
  return base + fill + ghost;
}

function cardRules(d: Design, S: string): string {
  const c = d.card;
  const imgBg = {
    none: "transparent",
    muted: "var(--muted)",
    tint: "color-mix(in srgb,var(--primary) 7%,var(--background))",
    gradient: "linear-gradient(160deg,var(--muted),color-mix(in srgb,var(--primary) 9%,var(--muted)))",
  }[c.imageBg];
  let css =
    `${S} .s-card{background:var(--card);color:var(--card-foreground);border-radius:var(--r-card);border:var(--border-w) solid var(--border);box-shadow:var(--elev);transition:transform var(--motion-base) var(--motion-ease),box-shadow var(--motion-base),border-color var(--motion-base)}` +
    `${S} .s-media{position:relative;overflow:hidden;aspect-ratio:var(--card-ratio);border-radius:var(--r-img);background:${imgBg};padding:var(--img-pad)}` +
    `${S} .s-media img{width:100%;height:100%;object-fit:var(--card-fit);transition:transform var(--motion-slow) var(--motion-ease),opacity var(--motion-base)}` +
    `${S} .s-card-info{text-align:${c.align === "center" ? "center" : "start"}}` +
    `${S} .s-hero-media.s-media{border-radius:var(--r-card);background:var(--muted)}${S} .s-hero-media.s-media img{object-fit:cover}`;
  css += {
    lift: `${S} .s-card:hover{transform:translateY(-4px);box-shadow:var(--elev-hover)}`,
    zoom: `${S} .s-card:hover .s-media img{transform:scale(1.06)}`,
    swap: `${S} .s-card .s-media img+img{position:absolute;inset:var(--img-pad);width:calc(100% - var(--img-pad) * 2);height:calc(100% - var(--img-pad) * 2);opacity:0}${S} .s-card:hover .s-media img+img{opacity:1}`,
    glow: `${S} .s-card:hover{border-color:color-mix(in srgb,var(--primary) 55%,var(--border));box-shadow:0 0 0 1px color-mix(in srgb,var(--primary) 35%,transparent),0 18px 40px -18px color-mix(in srgb,var(--primary) 55%,transparent)}`,
    none: "",
  }[c.hover];
  css += {
    plain: `${S} .s-price{font-weight:700;color:var(--card-foreground)}`,
    bold: `${S} .s-price{font-weight:900;color:var(--card-foreground)}`,
    pill: `${S} .s-price{font-weight:800;background:color-mix(in srgb,var(--primary) 12%,transparent);color:var(--primary);padding:.15rem .6rem;border-radius:999px}`,
    accent: `${S} .s-price{font-weight:900;color:var(--primary)}`,
    underline: `${S} .s-price{font-weight:800;color:var(--card-foreground);text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:3px;text-underline-offset:5px}`,
  }[c.priceStyle];
  css += {
    pill: `${S} .s-badge{border-radius:999px;padding:.2rem .6rem}`,
    tag: `${S} .s-badge{border-radius:.35rem;padding:.2rem .5rem}`,
    corner: `${S} .s-badge{border-radius:0 0 .75rem 0;padding:.3rem .65rem}`,
    ribbon: `${S} .s-badge{border-radius:0;padding:.25rem .75rem;clip-path:polygon(0 0,100% 0,92% 50%,100% 100%,0 100%)}`,
  }[c.badge];
  css += `${S} .s-badge{font-size:.68rem;font-weight:800;background:var(--accent);color:var(--accent-foreground)}${S} .s-badge[data-tone=sale]{background:var(--danger);color:#fff}${S} .s-badge[data-tone=muted]{background:color-mix(in srgb,var(--foreground) 75%,transparent);color:var(--background)}${S} .s-card[data-out] .s-media img{filter:grayscale(.6);opacity:.75}`;
  return css;
}

/** طابع البطاقة العام الذي اختاره المدير الفني (theme.productCardStyle). */
function cardStyleRules(style: StoreBlueprint["theme"]["productCardStyle"], S: string): string {
  switch (style) {
    case "minimal":
      return `${S} .s-card{background:transparent;border-color:transparent;box-shadow:none}${S} .s-card .s-card-info{padding-inline:.15rem}`;
    case "bordered":
      return `${S} .s-card{box-shadow:none;border-width:max(var(--border-w),1px)}`;
    case "editorial":
      return `${S} .s-card{background:transparent;border-color:transparent;box-shadow:none}${S} .s-card .s-card-info{padding-inline:0;gap:.35rem}${S} .s-card h3{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1rem}`;
    case "overlay":
      return `${S} .s-card-overlay .s-card-info-overlay{position:absolute;inset-inline:0;bottom:0;color:#fff;background:linear-gradient(to top,rgb(0 0 0 / .78),rgb(0 0 0 / .25) 70%,transparent)}${S} .s-card-overlay .s-price{color:#fff}${S} .s-card-overlay .s-media{border-radius:var(--r-card)}`;
    case "glass":
      return `${S} .s-card{background:color-mix(in srgb,var(--card) 62%,transparent);backdrop-filter:blur(14px) saturate(1.2);border-color:color-mix(in srgb,var(--foreground) 10%,transparent)}`;
    case "floating":
      return `${S} .s-card{border-color:transparent;box-shadow:var(--elev-hover)}${S} .s-card .s-media{margin:.5rem .5rem 0}`;
    case "brutalist":
      return `${S} .s-card{border:2px solid var(--foreground);box-shadow:5px 5px 0 var(--foreground);border-radius:0}${S} .s-card:hover{box-shadow:8px 8px 0 var(--foreground);transform:translate(-2px,-2px)}${S} .s-card .s-media{border-radius:0}`;
    default:
      return "";
  }
}

function iconRules(d: Design, S: string): string {
  const tone = {
    primary: "color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,transparent)",
    accent: "color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent)",
    foreground: "color:var(--foreground);background:color-mix(in srgb,var(--foreground) 7%,transparent)",
    soft: "color:var(--foreground);background:var(--muted)",
  }[d.icon.tone];
  const frame = {
    none: "background:transparent!important;width:auto;height:auto",
    circle: "border-radius:999px",
    squircle: "border-radius:32%",
    square: "border-radius:.5rem",
    outline: "background:transparent!important;border:1.5px solid currentColor;border-radius:999px",
  }[d.icon.frame];
  return `${S} .s-icon{display:inline-grid;place-items:center;width:3rem;height:3rem;flex-shrink:0;${tone};${frame}}${S} .s-icon svg,${S} svg.s-stroke{stroke-width:var(--icon-stroke)}`;
}

function headingRules(d: Design, S: string): string {
  const align = d.layout.headingAlign === "center";
  let css =
    `${S} :where(h1,h2,h3){font-weight:var(--heading-weight);letter-spacing:var(--heading-tracking);line-height:1.2}` +
    `${S} .s-title{font-size:calc(clamp(1.5rem,1.1rem + 1.6vw,2.4rem) * var(--heading-scale));text-wrap:balance}` +
    `${S} .s-display{font-size:calc(clamp(2.1rem,1.3rem + 3.6vw,4.4rem) * var(--heading-scale));line-height:1.08;text-wrap:balance}` +
    `${S} .s-eyebrow{display:inline-flex;align-items:center;gap:.5rem;font-size:.75rem;font-weight:800;color:var(--primary);letter-spacing:.02em}` +
    `${S} .s-head{display:flex;flex-direction:column;gap:.5rem;margin-bottom:clamp(1.5rem,3vw,2.5rem);${align ? "align-items:center;text-align:center" : ""}}` +
    (align ? `${S} .s-head>div{justify-content:center}${S} .s-head .s-title{justify-content:center}${S} .s-head .s-sub{margin-inline:auto}` : "") +
    `${S} .s-sub{max-width:40rem;opacity:.75;font-size:.95rem;line-height:1.8}`;
  css += {
    plain: "",
    eyebrow: `${S} .s-eyebrow::before{content:"";width:1.5rem;height:2px;border-radius:2px;background:currentColor}`,
    underline: `${S} .s-head .s-title::after{content:"";display:block;width:3.5rem;height:4px;border-radius:4px;margin-top:.75rem;background:linear-gradient(90deg,var(--primary),var(--accent));${align ? "margin-inline:auto" : ""}}`,
    ornament: `${S} .s-head .s-title{display:flex;align-items:center;gap:1rem}${S} .s-head .s-title::before,${S} .s-head .s-title::after{content:"";flex:1;max-width:5rem;height:1px;background:color-mix(in srgb,var(--foreground) 25%,transparent)}`,
    split: `${S} .s-head{border-bottom:1px solid color-mix(in srgb,var(--foreground) 12%,transparent);padding-bottom:1rem}`,
  }[d.heading.style];
  return css;
}

function rhythmRules(d: Design, S: string): string {
  const alt = d.surface.rhythm === "bands" ? "color-mix(in srgb,var(--primary) 7%,var(--background))" : "color-mix(in srgb,var(--muted) 80%,transparent)";
  let css = `${S} .s-section{padding-block:var(--section-y);position:relative}${S} .s-section[data-tone=alt]{background:${d.surface.rhythm === "flat" ? "transparent" : alt}}${S} .s-section[data-tone=ink]{background:var(--foreground);color:var(--background)}${S} .s-section[data-tone=ink] :where(h1,h2,h3,.s-title){color:var(--background)}${S} .s-section[data-tone=brand]{background:var(--primary);color:var(--primary-foreground)}${S} .s-section[data-tone=brand] :where(h1,h2,h3,.s-title,.s-eyebrow){color:var(--primary-foreground)}`;
  if (d.surface.rhythm !== "flat") {
    css += {
      none: "",
      line: `${S} .s-section+.s-section{border-top:1px solid color-mix(in srgb,var(--foreground) 9%,transparent)}`,
      curve: `${S} .s-section[data-tone=alt]{border-start-start-radius:clamp(1.5rem,5vw,4rem);border-start-end-radius:clamp(1.5rem,5vw,4rem)}`,
      slant: `${S} .s-section[data-tone=alt]{clip-path:polygon(0 2.5rem,100% 0,100% 100%,0 100%);padding-top:calc(var(--section-y) + 2.5rem)}`,
      wave: `${S} .s-section[data-tone=alt]{-webkit-mask:radial-gradient(1.6rem at 50% 0,#0000 98%,#000) 50% 0/3.2rem 100%;mask:radial-gradient(1.6rem at 50% 0,#0000 98%,#000) 50% 0/3.2rem 100%;padding-top:calc(var(--section-y) + 1.2rem)}`,
    }[d.surface.divider];
  }
  return css;
}

/** متغيرات وقواعد التصميم + جلد الذكاء الاصطناعي، كلها محصورة في نطاق المتجر. */
/**
 * نظام الحركة: CSS فقط (لا يختفي أي نص لو تأخر الجافاسكربت). المستوى والعمق يأتيان من data-motion
 * وdata-depth على غلاف المتجر، والحركة كلها تتوقف لمن طلب تقليل الحركة من جهازه.
 */
function motionRules(S: string): string {
  const C = `${S}[data-motion="cinematic"]`;
  const L = `${S}:is([data-motion="cinematic"],[data-motion="lively"])`;
  const D = `${S}[data-depth="on"]`;
  return [
    // عنوان يتكشف كلمة كلمة (سينمائي).
    `@keyframes s-word{from{opacity:0;transform:translateY(.55em) rotate(1.5deg);filter:blur(10px)}to{opacity:1;transform:none;filter:blur(0)}}`,
    `${C} .s-kinetic .s-w{display:inline-block;animation:s-word .95s var(--motion-ease) both;animation-delay:calc(var(--i,0) * 70ms + 120ms)}`,
    `${S}:not([data-motion="cinematic"]) .s-kinetic .s-w{display:inline}`,
    // صورة الواجهة تتنفس ببطء، وصورة طافية تسبح في مكانها.
    `@keyframes s-kenburns{from{transform:scale(1.14)}to{transform:scale(1)}}`,
    `${C} .s-hero[data-layout="fullscreen"] img{animation:s-kenburns 16s cubic-bezier(.2,.6,.3,1) both}`,
    `@keyframes s-float{from{transform:translate3d(0,0,0) rotate(-1.5deg)}to{transform:translate3d(0,-14px,0) rotate(1.5deg)}}`,
    `${C} .s-float{animation:s-float 6.5s ease-in-out infinite alternate}`,
    // ظهور متتابع لعناصر الواجهة الثانوية (حيوي وسينمائي).
    `${L} .s-hero .s-rise{animation:none}${L} .s-hero .s-copy>*:not(.s-kinetic){animation:s-rise .8s var(--motion-ease) both}`,
    `${L} .s-hero .s-copy>*:nth-child(2){animation-delay:.14s}${L} .s-hero .s-copy>*:nth-child(3){animation-delay:.32s}${L} .s-hero .s-copy>*:nth-child(4){animation-delay:.46s}`,
    `${S}[data-motion="lively"] .s-hero .s-copy>.s-kinetic{animation:s-rise .8s var(--motion-ease) .06s both}`,
    // عمق مع التمرير (المتصفحات الداعمة فقط؛ غيرها يرى صورة ثابتة).
    `@keyframes s-parallax{from{transform:translate3d(0,-5%,0) scale(1.12)}to{transform:translate3d(0,5%,0) scale(1.12)}}`,
    `@supports (animation-timeline: view()){${D} .s-parallax{animation:s-parallax linear both;animation-timeline:view();animation-range:cover}}`,
    // شريط تقدم القراءة بلون المتجر.
    `@keyframes s-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}`,
    `${S} .s-progress{display:none}`,
    `@supports (animation-timeline: scroll()){${L} .s-progress{display:block;position:fixed;inset-inline:0;top:0;height:3px;z-index:60;background:linear-gradient(90deg,var(--accent),var(--primary));transform-origin:right;animation:s-progress linear both;animation-timeline:scroll(root)}}`,
    // ميل ثلاثي الأبعاد مع المؤشر ولمعة تتبعه (المتغيرات يكتبها DepthController).
    `@media (hover:hover) and (pointer:fine){${D} [data-tilt]{transform:perspective(1100px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateY(var(--tilt-lift,0px));transition:transform .6s var(--motion-ease);will-change:transform}${D} .s-card[data-tilt]:hover{--tilt-lift:-5px}` +
      `${D} [data-tilt].is-tilting{transition:transform .08s linear}` +
      `${D} [data-tilt]::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:2;background:radial-gradient(520px circle at var(--gx,50%) var(--gy,50%),rgb(255 255 255/.24),transparent 45%);opacity:var(--go,0);transition:opacity .45s}}`,
    // واجهة «المدار»: صور المنتجات تدور في حلقة ثلاثية الأبعاد.
    `@keyframes s-orbit{from{transform:rotateX(-10deg) rotateY(0)}to{transform:rotateX(-10deg) rotateY(-360deg)}}`,
    `${S} .s-orbit{perspective:1400px}${S} .s-orbit-ring{position:relative;transform-style:preserve-3d;animation:s-orbit 38s linear infinite}`,
    `${S} .s-orbit:hover .s-orbit-ring{animation-play-state:paused}`,
    `${S} .s-orbit-item{position:absolute;inset:0;margin:auto;transform:rotateY(calc(var(--i) * 360deg / var(--n))) translateZ(var(--rz))}`,
    `${S} .s-orbit::after{content:"";position:absolute;inset:auto 15% 4% 15%;height:18%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--foreground) 22%,transparent),transparent);filter:blur(6px);z-index:-1}`,
    `@media (prefers-reduced-motion:reduce){${S} .s-orbit-ring{animation:none}${S} .s-kinetic .s-w{animation:none!important;opacity:1!important;filter:none!important;transform:none!important}${S} [data-tilt]{transform:none!important}${S} .s-parallax{animation:none!important;transform:none!important}}`,
  ].join("");
}

export function designStyleSheet(bp: Pick<StoreBlueprint, "design" | "customCss" | "theme">, S = ".storefront"): string {
  const parsed = designSchema.safeParse(bp.design ?? {});
  const d = parsed.success ? parsed.data : designSchema.parse({});
  const tint = d.elevation.tint ?? bp.theme.palette.foreground;
  const vars = [
    `--container:${CONTAINER[d.layout.container]}`,
    `--section-y:${SECTION_Y[d.layout.density]}`,
    `--heading-weight:${d.type.headingWeight}`,
    `--heading-tracking:${d.type.headingTracking}em`,
    `--heading-scale:${d.type.headingScale}`,
    `--leading:${d.type.bodyLeading}`,
    `--r-card:${d.shape.card}px`,
    `--r-btn:${d.shape.button}px`,
    `--r-input:${d.shape.input}px`,
    `--r-img:${Math.min(d.shape.image, d.shape.card)}px`,
    `--r-chip:${d.shape.chip}px`,
    `--border-w:${d.elevation.border}px`,
    `--elev:${shadow(d.elevation.level, tint)}`,
    `--elev-hover:${shadow(Math.min(4, d.elevation.level + 1), tint)}`,
    `--card-ratio:${RATIO[d.card.ratio]}`,
    `--card-fit:${d.card.fit}`,
    `--img-pad:${d.card.imagePad}px`,
    `--btn-h:${BTN_H[d.button.size]}`,
    `--btn-weight:${d.button.weight}`,
    `--icon-stroke:${d.icon.stroke}`,
  ].join(";");

  const bg = surface(d);
  const grain = d.surface.grain
    ? `${S}::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.035;background-image:radial-gradient(var(--foreground) .5px,transparent .5px);background-size:3px 3px}`
    : "";
  const css =
    `${S}{${vars};line-height:var(--leading)${bg ? `;${bg}` : ""}}` +
    `${S} .container-x{max-width:var(--container)}` +
    `${S} .s-input{border-radius:var(--r-input)}${S} .s-chip{border-radius:var(--r-chip)}` +
    grain +
    headingRules(d, S) +
    buttonRules(d, S) +
    cardRules(d, S) +
    cardStyleRules(bp.theme.productCardStyle, S) +
    iconRules(d, S) +
    rhythmRules(d, S) +
    motionRules(S) +
    `@keyframes s-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}${S} .s-rise{animation:s-rise .7s var(--motion-ease) both}` +
    `@media (prefers-reduced-motion:reduce){${S} *{transition-duration:0s!important;animation-duration:0s!important}}`;

  return css + sanitizeSkinCss(bp.customCss, S);
}
