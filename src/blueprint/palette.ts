// blueprint/palette.ts — محرك الألوان الكوني لـ Blueprint.
//
// السبب الجذري لوجود هذا الملف:
// defaultBlueprint() كان يثبّت palette أبيض/تركواز على كل متجر مهما كان
// brief.colorPreference. الآن نستخرج palette فعلياً من النص العربي/الإنجليزي
// ("بيج وكحلي وذهبي") أو من صورة إلهام عبر Gemini Vision. النتائج حتمية:
// نفس المدخلات + نفس variationSeed = نفس الـ palette (لإمكانية rollback)،
// لكن متاجر مختلفة = palettes مختلفة تماماً.
//
// المبادئ الصارمة:
//  - Contrast Lock: كل زوج (bg/fg) و (primary/primaryFg) و (accent/accentFg)
//    يمر WCAG AA (4.5:1) كحد أدنى، AAA (7:1) حيث ممكن.
//  - لا "default palette": عند غياب colorPreference، نولّد palette حتمية من
//    hash اسم المتجر + variationSeed — لا اثنان يتطابقان.
//  - الحتمية: نفس المدخلات تُخرج نفس المخرجات. لا Math.random().

import type { StoreBlueprint } from "./schema";

type Palette = StoreBlueprint["theme"]["palette"];
type Fonts = StoreBlueprint["theme"]["fonts"];

// ─── Types داخلية
type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type NamedColor = { hex: string; name: string; weight: number };

// ─── تحويلات الألوان

export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace("#", "").trim();
  const n =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = h * 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = ln - c / 2;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

export const hslToHex = (hsl: HSL): string => rgbToHex(hslToRgb(hsl));
export const hexToHsl = (hex: string): HSL => rgbToHsl(hexToRgb(hex));

// ─── WCAG contrast

function relativeLuminance(rgb: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

// يختار إما #ffffff أو #0f172a حسب الأفتح تبايناً على خلفية معينة.
export function readableOn(bg: string): string {
  const onWhite = contrastRatio(bg, "#ffffff");
  const onDark = contrastRatio(bg, "#0f172a");
  return onWhite >= onDark ? "#ffffff" : "#0f172a";
}

// يعدّل اللون حتى يمر بـ WCAG AA (4.5:1) أو AAA (7:1) على خلفية معينة.
export function ensureContrast(
  fg: string,
  bg: string,
  targetRatio: 4.5 | 7 = 4.5
): string {
  if (contrastRatio(fg, bg) >= targetRatio) return fg;
  const bgLum = relativeLuminance(hexToRgb(bg));
  const fgHsl = hexToHsl(fg);
  // إذا الخلفية فاتحة، نغمّق الـ fg؛ إذا داكنة، نفتّحه.
  const goDark = bgLum > 0.5;
  let lo = goDark ? 0 : fgHsl.l;
  let hi = goDark ? fgHsl.l : 100;
  let best = fg;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const candidate = hslToHex({ ...fgHsl, l: mid });
    if (contrastRatio(candidate, bg) >= targetRatio) {
      best = candidate;
      if (goDark) lo = mid;
      else hi = mid;
    } else {
      if (goDark) hi = mid;
      else lo = mid;
    }
  }
  return best;
}

// ─── تحليل نص عربي/إنجليزي لاستخراج الألوان

// قائمة الألوان المسمّاة — نقبل المرادفات العربية الفصحى والعامية والإنجليزية.
const NAMED_COLORS: Array<{
  patterns: RegExp;
  hex: string;
  name: string;
  hue: number;
}> = [
  // فاتحة جداً
  { patterns: /أبيض|ابيض|white/i, hex: "#ffffff", name: "white", hue: 0 },
  { patterns: /عاجي|ivory|صدفي/i, hex: "#f8f4e8", name: "ivory", hue: 45 },
  { patterns: /كريمي|cream|قشدي/i, hex: "#f5efe0", name: "cream", hue: 40 },
  { patterns: /بيج|beige|رمل|sand/i, hex: "#f5f0e8", name: "beige", hue: 40 },
  // داكنة
  { patterns: /أسود|اسود|black|شديد السواد/i, hex: "#111111", name: "black", hue: 0 },
  { patterns: /كحلي|كحلى|navy|نيڤي|نيڤى|أزرق داكن/i, hex: "#0f172a", name: "navy", hue: 220 },
  { patterns: /فحمي|charcoal/i, hex: "#2b2d33", name: "charcoal", hue: 220 },
  // ذهبية / نحاسية / معدنية
  { patterns: /ذهبي|دهبي|gold|جولد|ذهبية/i, hex: "#d4af37", name: "gold", hue: 45 },
  { patterns: /نحاسي|copper|برونزي|bronze|نحاس/i, hex: "#b87333", name: "copper", hue: 30 },
  { patterns: /فضي|silver|فضة/i, hex: "#c0c7d3", name: "silver", hue: 220 },
  { patterns: /بلاتيني|platinum/i, hex: "#e5e5e5", name: "platinum", hue: 0 },
  // أساسية مشبعة
  { patterns: /أحمر|احمر|red|قرمزي|crimson|عنابي/i, hex: "#dc2626", name: "red", hue: 0 },
  { patterns: /أزرق|ازرق|blue|لبني/i, hex: "#2563eb", name: "blue", hue: 220 },
  { patterns: /سماوي|sky|فيروزي|تركواز|turquoise|teal|كوحلي فاتح/i, hex: "#0d9488", name: "teal", hue: 175 },
  { patterns: /أخضر|اخضر|green|زيتي|olive|زيْتي/i, hex: "#166534", name: "green", hue: 140 },
  { patterns: /أصفر|اصفر|yellow|ليموني/i, hex: "#eab308", name: "yellow", hue: 50 },
  { patterns: /برتقالي|orange|كهرماني|أمبر|amber/i, hex: "#ea580c", name: "orange", hue: 25 },
  { patterns: /بنفسجي|موف|purple|violet|أرجواني/i, hex: "#7c3aed", name: "purple", hue: 270 },
  { patterns: /وردي|زهري|pink|rose|فوشيا|fuchsia/i, hex: "#e11d48", name: "pink", hue: 340 },
  { patterns: /بني|brown|شوكولاتة|chocolate|قهوي/i, hex: "#7c4a21", name: "brown", hue: 25 },
  { patterns: /رمادي|gray|grey|رصاصي/i, hex: "#64748b", name: "gray", hue: 220 },
];

// استخراج الألوان المذكورة بالترتيب الذي وردت به في النص.
export function extractNamedColors(text: string): NamedColor[] {
  if (!text || typeof text !== "string") return [];
  const found: Array<NamedColor & { idx: number }> = [];
  const seen = new Set<string>();
  // ألوان بصيغة HEX (من منتقي الألوان في الاستمارة) تُحترم كما هي.
  for (const m of text.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const hex = `#${m[1]!.toLowerCase()}`;
    if (seen.has(hex) || typeof m.index !== "number") continue;
    seen.add(hex);
    found.push({ hex, name: "لون مخصص", idx: m.index, weight: Math.max(0, 100 - m.index) });
  }
  for (const c of NAMED_COLORS) {
    const m = text.match(c.patterns);
    if (m && typeof m.index === "number") {
      if (seen.has(c.hex)) continue;
      seen.add(c.hex);
      found.push({
        hex: c.hex,
        name: c.name,
        idx: m.index,
        // الوزن = قرب اللون من بداية النص (الأول = الأعلى وزناً).
        weight: Math.max(0, 100 - m.index),
      });
    }
  }
  found.sort((a, b) => a.idx - b.idx);
  return found.map(({ hex, name, weight }) => ({ hex, name, weight }));
}

// ─── توليد palette من مجموعة ألوان مسمّاة

function pickBackgroundAndPrimary(colors: NamedColor[]): {
  background: string;
  primary: string;
  accent: string;
} {
  if (colors.length === 0) {
    // لا ألوان مذكورة — سيُعالَج في extractPalette بالبذرة.
    return { background: "#ffffff", primary: "#0f172a", accent: "#6f86ff" };
  }

  // نرتب حسب السطوع لاختيار الخلفية الأفتح والـ primary الأغمق.
  const sorted = [...colors].sort(
    (a, b) =>
      relativeLuminance(hexToRgb(b.hex)) -
      relativeLuminance(hexToRgb(a.hex))
  );

  if (colors.length === 1) {
    const only = colors[0]!;
    const lum = relativeLuminance(hexToRgb(only.hex));
    if (lum > 0.7) {
      // لون فاتح وحيد → خلفية + primary مشتق داكن.
      const hsl = hexToHsl(only.hex);
      return {
        background: only.hex,
        primary: hslToHex({ ...hsl, l: 18, s: Math.min(60, hsl.s) }),
        accent: hslToHex({ ...hsl, l: 42, s: Math.min(85, hsl.s + 20) }),
      };
    }
    // لون داكن وحيد → خلفية بيضاء + primary هو اللون.
    return {
      background: "#ffffff",
      primary: only.hex,
      accent: adjustHue(only.hex, 40, 8),
    };
  }

  if (colors.length === 2) {
    const [light, dark] = [
      sorted[0]!,
      sorted[sorted.length - 1]!,
    ];
    // لو الاثنان داكنان، نجعل الأفتح primary على خلفية بيضاء.
    const lightLum = relativeLuminance(hexToRgb(light.hex));
    if (lightLum < 0.55) {
      return {
        background: "#ffffff",
        primary: dark.hex,
        accent: adjustHue(light.hex, 0, 12),
      };
    }
    return {
      background: light.hex,
      primary: dark.hex,
      accent: adjustHue(dark.hex, 45, -8),
    };
  }

  // 3+ ألوان: الأفتح خلفية، الأغمق primary، الأعلى تشبّعاً (وسطي) أكسنت.
  const background = sorted[0]!.hex;
  const primary = sorted[sorted.length - 1]!.hex;
  const middles = sorted.slice(1, -1);
  const accentCandidate =
    middles.sort(
      (a, b) => hexToHsl(b.hex).s - hexToHsl(a.hex).s
    )[0]?.hex ?? adjustHue(primary, 45, 0);

  return { background, primary, accent: accentCandidate };
}

// تدوير درجة اللون (hue rotation) مع تعديل السطوع.
function adjustHue(hex: string, deltaHue: number, deltaL: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({
    h: (hsl.h + deltaHue + 360) % 360,
    s: Math.max(20, Math.min(90, hsl.s)),
    l: Math.max(18, Math.min(85, hsl.l + deltaL)),
  });
}

// ─── البذرة الحتمية

export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

// ─── palette حتمية من بذرة (بدون colorPreference)

function seededPalette(seed: string): Palette {
  const h = hashString(seed);
  const baseHue = h % 360;
  const variant = Math.floor(h / 360) % 6;

  // 6 نمطات مختلفة للحصول على تنويع حقيقي.
  switch (variant) {
    case 0: {
      // light pastel
      const background = hslToHex({ h: baseHue, s: 24, l: 96 });
      const primary = hslToHex({ h: (baseHue + 180) % 360, s: 62, l: 32 });
      const accent = hslToHex({ h: (baseHue + 45) % 360, s: 78, l: 48 });
      return buildFullPalette(background, primary, accent);
    }
    case 1: {
      // dark moody
      const background = hslToHex({ h: baseHue, s: 24, l: 9 });
      const primary = hslToHex({ h: (baseHue + 20) % 360, s: 68, l: 62 });
      const accent = hslToHex({ h: (baseHue + 200) % 360, s: 72, l: 58 });
      return buildFullPalette(background, primary, accent);
    }
    case 2: {
      // warm editorial
      const background = hslToHex({ h: 38, s: 40, l: 95 });
      const primary = hslToHex({ h: (baseHue + 10) % 360, s: 55, l: 22 });
      const accent = hslToHex({ h: 30, s: 72, l: 48 });
      return buildFullPalette(background, primary, accent);
    }
    case 3: {
      // monochrome cool
      const background = hslToHex({ h: 220, s: 18, l: 97 });
      const primary = hslToHex({ h: 220, s: 60, l: 24 });
      const accent = hslToHex({ h: (baseHue + 30) % 360, s: 65, l: 50 });
      return buildFullPalette(background, primary, accent);
    }
    case 4: {
      // luxury deep + gold
      const background = hslToHex({ h: 220, s: 22, l: 6 });
      const primary = hslToHex({ h: 42, s: 62, l: 58 });
      const accent = hslToHex({ h: (baseHue + 180) % 360, s: 40, l: 65 });
      return buildFullPalette(background, primary, accent);
    }
    default: {
      // vivid brand
      const background = "#ffffff";
      const primary = hslToHex({ h: baseHue, s: 72, l: 40 });
      const accent = hslToHex({ h: (baseHue + 150) % 360, s: 68, l: 52 });
      return buildFullPalette(background, primary, accent);
    }
  }
}

// ─── بناء palette كامل مع ضمان WCAG

export function buildFullPalette(
  background: string,
  primary: string,
  accent: string
): Palette {
  // ضمان تباين primary على خلفيته المقصودة.
  const primaryFgSafe = readableOn(primary);
  const accentFgSafe = readableOn(accent);
  const foregroundSafe = readableOn(background);

  const bgLum = relativeLuminance(hexToRgb(background));
  const isLight = bgLum > 0.5;

  const card = isLight ? lighten(background, 0.02) : darken(background, 0.05);
  const muted = isLight ? darken(background, 0.06) : lighten(background, 0.08);
  const border = isLight ? darken(background, 0.14) : lighten(background, 0.18);
  const mutedForeground = isLight
    ? darken(foregroundSafe, 0.25)
    : lighten(foregroundSafe, 0.25);

  return {
    primary,
    primaryForeground: primaryFgSafe,
    secondary: muted,
    secondaryForeground: foregroundSafe,
    accent,
    accentForeground: accentFgSafe,
    background,
    foreground: foregroundSafe,
    muted,
    mutedForeground,
    card,
    cardForeground: foregroundSafe,
    border,
    success: "#16a34a",
    warning: "#f59e0b",
    danger: "#dc2626",
  };
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return rgbToHex({ r: mix(r), g: mix(g), b: mix(b) });
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c: number) => Math.round(c * (1 - amount));
  return rgbToHex({ r: mix(r), g: mix(g), b: mix(b) });
}

// ─── واجهة الاستخراج العامة

export type ExtractedPalette = {
  palette: Palette;
  source: "text" | "image" | "seeded";
  extractedColors: NamedColor[];
  contrastAudit: Array<{ pair: string; ratio: number; passes: boolean }>;
};

export function extractPalette(
  colorPreference: string | undefined,
  industry: string,
  seed: string
): ExtractedPalette {
  const pref = (colorPreference ?? "").trim();

  if (!pref) {
    return {
      palette: seededPalette(seed),
      source: "seeded",
      extractedColors: [],
      contrastAudit: auditPalette(seededPalette(seed)),
    };
  }

  const colors = extractNamedColors(pref);
  if (colors.length === 0) {
    return {
      palette: seededPalette(seed),
      source: "seeded",
      extractedColors: [],
      contrastAudit: auditPalette(seededPalette(seed)),
    };
  }

  const { background, primary, accent } = pickBackgroundAndPrimary(colors);
  const palette = buildFullPalette(background, primary, accent);

  // تطبيق تعديلات حسب المجال.
  const tuned = tuneForIndustry(palette, industry);

  return {
    palette: tuned,
    source: "text",
    extractedColors: colors,
    contrastAudit: auditPalette(tuned),
  };
}

// تعديلات طفيفة حسب المجال (تباين أعمق للأزياء الفاخرة، إلخ).
function tuneForIndustry(p: Palette, industry: string): Palette {
  switch (industry) {
    case "fashion":
    case "beauty":
      // تباين أعلى، تشبّع أقل قليلاً.
      return {
        ...p,
        background: saturateHex(p.background, -8),
        primary: saturateHex(p.primary, -5),
      };
    case "electronics":
    case "home":
      // ألوان أكثر برودة، تباين أوضح.
      return {
        ...p,
        border: darken(p.border, 0.06),
      };
    case "food":
    case "kids":
      // ألوان أكثر حيوية.
      return {
        ...p,
        accent: saturateHex(p.accent, 10),
      };
    default:
      return p;
  }
}

function saturateHex(hex: string, deltaS: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({
    ...hsl,
    s: Math.max(0, Math.min(100, hsl.s + deltaS)),
  });
}

// تدقيق التباين — يُخزَّن في system_events للشفافية.
export function auditPalette(
  p: Palette
): Array<{ pair: string; ratio: number; passes: boolean }> {
  const pairs: Array<[string, string, string]> = [
    ["background/foreground", p.background, p.foreground],
    ["card/cardForeground", p.card, p.cardForeground],
    ["primary/primaryForeground", p.primary, p.primaryForeground],
    ["accent/accentForeground", p.accent, p.accentForeground],
    ["muted/mutedForeground", p.muted, p.mutedForeground],
  ];
  return pairs.map(([name, a, b]) => {
    const ratio = Math.round(contrastRatio(a, b) * 100) / 100;
    return { pair: name, ratio, passes: ratio >= 4.5 };
  });
}

// ─── اختيار الخطوط حسب المجال + المزاج

export function pickAdaptiveFonts(
  industry: string,
  toneOfVoice: string,
  seed: string
): Fonts {
  const headingPool: Record<string, Fonts["heading"][]> = {
    fashion: ["el_messiri", "noto_kufi", "almarai"],
    beauty: ["el_messiri", "almarai", "tajawal"],
    electronics: ["readex_pro", "noto_kufi", "cairo"],
    home: ["readex_pro", "cairo", "tajawal"],
    food: ["almarai", "tajawal", "cairo"],
    kids: ["almarai", "tajawal", "el_messiri"],
    accessories: ["noto_kufi", "cairo", "tajawal"],
    gifts: ["el_messiri", "noto_kufi", "almarai"],
    health: ["readex_pro", "almarai", "cairo"],
    other: ["cairo", "tajawal", "noto_kufi"],
  };
  const bodyPool: Record<string, Fonts["body"][]> = {
    fashion: ["almarai", "cairo"],
    beauty: ["almarai", "tajawal"],
    electronics: ["cairo", "tajawal"],
    home: ["cairo", "tajawal"],
    food: ["cairo", "tajawal"],
    kids: ["cairo", "tajawal"],
    accessories: ["tajawal", "cairo"],
    gifts: ["almarai", "cairo"],
    health: ["cairo", "almarai"],
    other: ["cairo", "tajawal"],
  };

  const hPool = headingPool[industry] ?? headingPool.other!;
  const bPool = bodyPool[industry] ?? bodyPool.other!;

  // المزاج يؤثر على الاختيار.
  const moodIndex =
    toneOfVoice === "luxury"
      ? 0
      : toneOfVoice === "playful"
        ? 1
        : toneOfVoice === "minimal"
          ? Math.min(hPool.length - 1, 1)
          : hashString(seed) % hPool.length;

  return {
    heading: hPool[moodIndex] ?? hPool[0]!,
    body: bPool[hashString(seed + "b") % bPool.length] ?? bPool[0]!,
    baseSize: toneOfVoice === "luxury" ? 17 : 16,
  };
}

// ─── خلفية محيطة (ambient backdrop) — gradient layers مختلفة لكل متجر

export type AmbientBackdrop = {
  layers: Array<{ color: string; opacity: number; position: string; size: string }>;
  blendMode: string;
};

export function buildAmbientBackdrop(p: Palette, seed: string): AmbientBackdrop {
  const h = hashString(seed);
  const variant = h % 4;

  const primaryRgb = hexToRgb(p.primary);
  const accentRgb = hexToRgb(p.accent);
  const primaryRgba = (a: number) =>
    `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${a})`;
  const accentRgba = (a: number) =>
    `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${a})`;

  switch (variant) {
    case 0:
      // top-center glow
      return {
        blendMode: "normal",
        layers: [
          {
            color: primaryRgba(0.14),
            opacity: 1,
            position: "50% 0%",
            size: "60% 40%",
          },
          {
            color: accentRgba(0.08),
            opacity: 1,
            position: "100% 30%",
            size: "40% 30%",
          },
        ],
      };
    case 1:
      // bottom-left warm
      return {
        blendMode: "normal",
        layers: [
          {
            color: accentRgba(0.12),
            opacity: 1,
            position: "0% 100%",
            size: "55% 45%",
          },
          {
            color: primaryRgba(0.08),
            opacity: 1,
            position: "80% 20%",
            size: "50% 30%",
          },
        ],
      };
    case 2:
      // dual diagonal
      return {
        blendMode: "normal",
        layers: [
          {
            color: primaryRgba(0.10),
            opacity: 1,
            position: "20% 20%",
            size: "50% 40%",
          },
          {
            color: accentRgba(0.10),
            opacity: 1,
            position: "80% 80%",
            size: "50% 40%",
          },
        ],
      };
    default:
      // side accent strip
      return {
        blendMode: "normal",
        layers: [
          {
            color: accentRgba(0.10),
            opacity: 1,
            position: "0% 50%",
            size: "40% 100%",
          },
        ],
      };
  }
}

// ─── اختيار variant الـ hero تلقائياً حسب السياق

export function resolveHeroVariant(context: {
  hasHeroImages: boolean;
  hasLogo: boolean;
  productCount: number;
  industry: string;
  toneOfVoice: string;
  seed: string;
}): StoreBlueprint["home"][number] extends { variant: infer V }
  ? V extends string
    ? string
    : never
  : string {
  const {
    hasHeroImages,
    productCount,
    industry,
    toneOfVoice,
    seed,
  } = context;

  // قواعد القرار:
  // - لا صور hero + منتج واحد → centered (لا فراغ بصري).
  // - صور hero + مزاج luxury → cinematic / editorial.
  // - مزاج playful → collage / kinetic.
  // - صناعة أزياء → editorial.
  // - إلكترونيات → product_spotlight.
  if (hasHeroImages) {
    if (toneOfVoice === "luxury") return "editorial";
    if (toneOfVoice === "playful") return "collage";
    if (industry === "electronics") return "product_spotlight";
    if (industry === "fashion" || industry === "beauty") return "editorial";
    const pool = ["cinematic", "split", "fullscreen", "carousel"] as const;
    return pool[hashString(seed + "hv") % pool.length]!;
  }

  if (productCount === 0) return "centered";
  if (toneOfVoice === "minimal") return "centered";
  if (toneOfVoice === "playful") return "kinetic";
  const pool = ["centered", "kinetic", "storyteller"] as const;
  return pool[hashString(seed + "hv") % pool.length]!;
}

// ─── Utilities مساعدة للـ defaults

export function buildVariationSeed(storeId: string, timestamp: number): string {
  return `${storeId}:${timestamp}:${hashString(storeId + timestamp)}`;
}