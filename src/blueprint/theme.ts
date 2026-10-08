import type { Theme, Palette, AmbientBackdrop } from "./schema";

const RADIUS: Record<Theme["radius"], string> = {
  none: "0px",
  sm: "0.375rem",
  md: "0.625rem",
  lg: "0.875rem",
  xl: "1.25rem",
  full: "9999px",
};

const SHADOW: Record<Theme["shadow"], string> = {
  none: "none",
  soft: "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)",
  medium: "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
  dramatic: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  cinematic: "0 25px 50px -12px rgb(0 0 0 / 0.25), 0 8px 16px -8px rgb(0 0 0 / 0.15)",
};

const MOTION: Record<Theme["motion"], { fast: string; base: string; slow: string; ease: string }> = {
  minimal: { fast: "80ms", base: "140ms", slow: "220ms", ease: "cubic-bezier(.2,.8,.2,1)" },
  subtle: { fast: "120ms", base: "200ms", slow: "360ms", ease: "cubic-bezier(.22,1,.36,1)" },
  balanced: { fast: "140ms", base: "240ms", slow: "420ms", ease: "cubic-bezier(.22,1,.36,1)" },
  expressive: { fast: "180ms", base: "360ms", slow: "640ms", ease: "cubic-bezier(.16,1,.3,1)" },
  cinematic: { fast: "220ms", base: "480ms", slow: "900ms", ease: "cubic-bezier(.16,1,.3,1)" },
};

export const FONT_VAR: Record<Theme["fonts"]["heading"], string> = {
  cairo: "var(--font-cairo)",
  tajawal: "var(--font-tajawal)",
  ibm_plex_arabic: "var(--font-ibm-plex-arabic)",
  almarai: "var(--font-almarai)",
  changa: "var(--font-changa)",
  el_messiri: "var(--font-el-messiri)",
  readex_pro: "var(--font-readex-pro)",
  noto_kufi: "var(--font-noto-kufi)",
};

const FONT_FALLBACK = `system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif`;
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const VAR_NAME_RE = /^--[a-z0-9-]+$/i;

function pick<V>(map: Record<string, V>, key: unknown, fallback: string): V {
  return map[String(key)] ?? (map[fallback] as V);
}

function parseHex(input: unknown): [number, number, number] | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (!HEX_RE.test(v)) return null;
  let h = v.slice(1);
  if (h.length <= 4) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgb(hex: string) {
  const c = parseHex(hex);
  return c ? c.join(" ") : "15 23 42";
}

function safeValue(v: string) {
  return String(v ?? "").replace(/[<>{};\\]/g, "").replace(/\/\*|\*\//g, "").trim();
}

function isColorDark(hex: string): boolean {
  const c = parseHex(hex);
  if (!c) return false;
  const yiq = (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;
  return yiq < 140;
}

function ensureStrictContrast(bgHex: string, preferredFgHex?: string): string {
  const darkBg = isColorDark(bgHex);
  if (darkBg) {
    if (preferredFgHex && !isColorDark(preferredFgHex)) return preferredFgHex;
    return "#ffffff";
  } else {
    if (preferredFgHex && isColorDark(preferredFgHex)) return preferredFgHex;
    return "#090d1a";
  }
}

// ─── استخراج palette من نص عربي/إنجليزي
type RGB = [number, number, number];

const NAMED_COLOR_MAP: Array<{ re: RegExp; hex: string }> = [
  { re: /أبيض|ابيض|white/i, hex: "#ffffff" },
  { re: /عاجي|ivory/i, hex: "#f8f4e8" },
  { re: /كريمي|cream/i, hex: "#f5efe0" },
  { re: /بيج|beige|رمل|sand/i, hex: "#f5f0e8" },
  { re: /أسود|اسود|black/i, hex: "#111111" },
  { re: /كحلي|كحلى|navy|نيڤي|نيڤى/i, hex: "#0f172a" },
  { re: /فحمي|charcoal/i, hex: "#2b2d33" },
  { re: /ذهبي|دهبي|gold|جولد/i, hex: "#d4af37" },
  { re: /نحاسي|copper|bronze|نحاس/i, hex: "#b87333" },
  { re: /فضي|silver/i, hex: "#c0c7d3" },
  { re: /بلاتيني|platinum/i, hex: "#e5e5e5" },
  { re: /أحمر|احمر|red|crimson|عنابي/i, hex: "#dc2626" },
  { re: /أزرق|ازرق|blue|لبني/i, hex: "#2563eb" },
  { re: /سماوي|sky|فيروزي|تركواز|turquoise|teal/i, hex: "#0d9488" },
  { re: /أخضر|اخضر|green|زيتي|olive/i, hex: "#166534" },
  { re: /أصفر|اصفر|yellow|ليموني/i, hex: "#eab308" },
  { re: /برتقالي|orange|كهرماني|amber/i, hex: "#ea580c" },
  { re: /بنفسجي|موف|purple|violet|أرجواني/i, hex: "#7c3aed" },
  { re: /وردي|زهري|pink|rose|فوشيا|fuchsia/i, hex: "#e11d48" },
  { re: /بني|brown|chocolate|قهوي/i, hex: "#7c4a21" },
  { re: /رمادي|gray|grey|رصاصي/i, hex: "#64748b" },
];

function luminance(rgb: RGB): number {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * c(rgb[0]) + 0.7152 * c(rgb[1]) + 0.0722 * c(rgb[2]);
}

function hexToRgbTuple(hex: string): RGB {
  const c = parseHex(hex);
  return c ? [c[0], c[1], c[2]] : [15, 23, 42];
}

function rgbToHex(rgb: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}

function hslFromRgb(rgb: RGB): { h: number; s: number; l: number } {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = h * 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

function rgbFromHsl(h: number, s: number, l: number): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = ln - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function buildPaletteFromColors(background: string, primary: string, accent: string): Palette {
  const bgLum = luminance(hexToRgbTuple(background));
  const isLight = bgLum > 0.5;
  const fg = isLight ? "#0f172a" : "#ffffff";

  const lighten = (hex: string, amt: number): string => {
    const [r, g, b] = hexToRgbTuple(hex);
    const mix = (v: number) => Math.round(v + (255 - v) * amt);
    return rgbToHex([mix(r), mix(g), mix(b)]);
  };
  const darken = (hex: string, amt: number): string => {
    const [r, g, b] = hexToRgbTuple(hex);
    const mix = (v: number) => Math.round(v * (1 - amt));
    return rgbToHex([mix(r), mix(g), mix(b)]);
  };

  const card = isLight ? lighten(background, 0.02) : darken(background, 0.05);
  const muted = isLight ? darken(background, 0.06) : lighten(background, 0.08);
  const border = isLight ? darken(background, 0.14) : lighten(background, 0.18);

  return {
    background,
    foreground: fg,
    primary,
    primaryForeground: ensureStrictContrast(primary),
    secondary: muted,
    secondaryForeground: fg,
    accent,
    accentForeground: ensureStrictContrast(accent),
    muted,
    mutedForeground: isLight ? "#64748b" : "#94a3b8",
    card,
    cardForeground: fg,
    border,
    success: "#16a34a",
    warning: "#f59e0b",
    danger: "#dc2626",
  };
}

// ─── استخراج palette من نص عربي
export function extractPaletteFromText(text: string): Palette {
  const found: Array<{ hex: string; idx: number }> = [];
  for (const entry of NAMED_COLOR_MAP) {
    const m = text.match(entry.re);
    if (m && typeof m.index === "number") {
      found.push({ hex: entry.hex, idx: m.index });
    }
  }

  if (found.length === 0) {
    // fallback — palette محايدة
    return buildPaletteFromColors("#ffffff", "#0f172a", "#6f86ff");
  }

  found.sort((a, b) => a.idx - b.idx);
  const dedup: string[] = [];
  for (const f of found) if (!dedup.includes(f.hex)) dedup.push(f.hex);

  const sorted = [...dedup].sort(
    (a, b) => luminance(hexToRgbTuple(b)) - luminance(hexToRgbTuple(a))
  );

  let background = "#ffffff";
  let primary = "#0f172a";
  let accent = "#6f86ff";

  if (sorted.length === 1) {
    const only = sorted[0]!;
    if (luminance(hexToRgbTuple(only)) > 0.75) {
      background = only;
      const hsl = hslFromRgb(hexToRgbTuple(only));
      primary = rgbToHex(rgbFromHsl(hsl.h, Math.min(60, hsl.s), 18));
      accent = rgbToHex(rgbFromHsl((hsl.h + 45) % 360, Math.min(85, hsl.s + 20), 45));
    } else {
      primary = only;
      accent = rgbToHex(rgbFromHsl((hslFromRgb(hexToRgbTuple(only)).h + 45) % 360, 60, 55));
    }
  } else if (sorted.length === 2) {
    background = sorted[0]!;
    primary = sorted[1]!;
    accent = rgbToHex(rgbFromHsl((hslFromRgb(hexToRgbTuple(primary)).h + 45) % 360, 65, 50));
    if (luminance(hexToRgbTuple(background)) < 0.55) {
      background = "#ffffff";
    }
  } else {
    background = sorted[0]!;
    primary = sorted[sorted.length - 1]!;
    accent = sorted[1]!;
  }

  return buildPaletteFromColors(background, primary, accent);
}

// ─── استخراج palette من صورة (Gemini Vision)
export async function extractPaletteFromImage(
  imageUrl: string,
  apiKey: string
): Promise<Palette> {
  if (!apiKey) {
    return buildPaletteFromColors("#ffffff", "#0f172a", "#6f86ff");
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL && !/^gemini-(1\.|2\.0)/.test(process.env.GEMINI_MODEL) ? process.env.GEMINI_MODEL : "gemini-3.8-flash"}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "حلل هذه الصورة وأخرج فقط JSON بثلاثة ألوان HEX: background (الأفتح), primary (الأغمق), accent (الأكثر تشبعاً). الشكل: {\"background\":\"#hex\",\"primary\":\"#hex\",\"accent\":\"#hex\"}. لا أي نص آخر.",
                },
                { file_data: { file_uri: imageUrl } },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) {
      return buildPaletteFromColors("#ffffff", "#0f172a", "#6f86ff");
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(txt) as {
      background?: string;
      primary?: string;
      accent?: string;
    };

    if (!parsed.background || !parsed.primary || !parsed.accent) {
      return buildPaletteFromColors("#ffffff", "#0f172a", "#6f86ff");
    }
    return buildPaletteFromColors(parsed.background, parsed.primary, parsed.accent);
  } catch {
    return buildPaletteFromColors("#ffffff", "#0f172a", "#6f86ff");
  }
}

// ─── اختيار خطوط تكيفي
export function pickAdaptiveFonts(
  industry: string,
  mood: string,
  variationSeed: string
): Theme["fonts"] {
  const headingPool: Record<string, Array<Theme["fonts"]["heading"]>> = {
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
  const bodyPool: Record<string, Array<Theme["fonts"]["body"]>> = {
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

  let idx = 0;
  if (mood === "luxury") idx = 0;
  else if (mood === "playful") idx = 1;
  else if (mood === "minimal") idx = Math.min(hPool.length - 1, 1);
  else idx = hashLocal(variationSeed) % hPool.length;

  return {
    heading: hPool[idx] ?? hPool[0]!,
    body: bPool[hashLocal(variationSeed + "b") % bPool.length] ?? bPool[0]!,
    baseSize: mood === "luxury" ? 17 : 16,
  };
}

function hashLocal(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

// ─── Ambient Backdrop
export function buildAmbientBackdrop(
  palette: Palette,
  variationSeed: string
): AmbientBackdrop {
  const h = hashLocal(variationSeed);
  const variant = h % 4;
  const pRgb = hexToRgbTuple(palette.primary);
  const aRgb = hexToRgbTuple(palette.accent);
  const rgba = (rgb: RGB, a: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

  switch (variant) {
    case 0:
      return {
        blendMode: "normal",
        layers: [
          { color: rgba(pRgb, 0.14), opacity: 1, position: "50% 0%", size: "60% 40%" },
          { color: rgba(aRgb, 0.08), opacity: 1, position: "100% 30%", size: "40% 30%" },
        ],
      };
    case 1:
      return {
        blendMode: "normal",
        layers: [
          { color: rgba(aRgb, 0.12), opacity: 1, position: "0% 100%", size: "55% 45%" },
          { color: rgba(pRgb, 0.08), opacity: 1, position: "80% 20%", size: "50% 30%" },
        ],
      };
    case 2:
      return {
        blendMode: "normal",
        layers: [
          { color: rgba(pRgb, 0.1), opacity: 1, position: "20% 20%", size: "50% 40%" },
          { color: rgba(aRgb, 0.1), opacity: 1, position: "80% 80%", size: "50% 40%" },
        ],
      };
    default:
      return {
        blendMode: "normal",
        layers: [
          { color: rgba(aRgb, 0.1), opacity: 1, position: "0% 50%", size: "40% 100%" },
        ],
      };
  }
}

// ─── Theme → CSS Vars
export function themeToCssVars(theme: Theme, mode: "light" | "dark" = "light") {
  const m = pick(MOTION, theme.motion, "balanced");
  const baseSize = Math.min(22, Math.max(12, Number(theme.fonts?.baseSize) || 16));
  const p = theme.palette || ({} as Palette);

  const bgHex = parseHex(p.background) ? p.background.trim() : (mode === "dark" ? "#07091a" : "#ffffff");
  const isDark = isColorDark(bgHex) || theme.mode === "dark";

  const cardHex = parseHex(p.card) ? p.card.trim() : (isDark ? "#0e142b" : "#ffffff");
  const mutedHex = parseHex(p.muted) ? p.muted.trim() : (isDark ? "#141b38" : "#f8fafc");
  const primaryHex = parseHex(p.primary) ? p.primary.trim() : "#3b82f6";
  const accentHex = parseHex(p.accent) ? p.accent.trim() : "#f59e0b";
  const borderHex = parseHex(p.border) ? p.border.trim() : (isDark ? "#232d56" : "#e2e8f0");

  const fgHex = ensureStrictContrast(bgHex, p.foreground);
  const cardFgHex = ensureStrictContrast(cardHex, p.cardForeground);
  const primaryFgHex = ensureStrictContrast(primaryHex, p.primaryForeground);
  const accentFgHex = ensureStrictContrast(accentHex, p.accentForeground);
  const mutedFgHex = isDark ? "#94a3b8" : "#64748b";

  const imageRatio =
    theme.imageRatio === "square" ? "1 / 1"
    : theme.imageRatio === "portrait" ? "4 / 5"
    : theme.imageRatio === "landscape" ? "4 / 3"
    : "21 / 9"; // cinematic

  const vars: Record<string, string> = {
    "--radius": pick(RADIUS, theme.radius, "lg"),
    "--shadow-card": pick(SHADOW, theme.shadow, "soft"),
    "--font-heading": `${pick(FONT_VAR, theme.fonts?.heading, "cairo")}, ${FONT_FALLBACK}`,
    "--font-body": `${pick(FONT_VAR, theme.fonts?.body, "cairo")}, ${FONT_FALLBACK}`,
    "--font-size-base": `${baseSize}px`,
    "--motion-fast": m.fast,
    "--motion-base": m.base,
    "--motion-slow": m.slow,
    "--motion-ease": m.ease,
    "--image-ratio": imageRatio,
    "--background": bgHex,
    "--foreground": fgHex,
    "--foreground-rgb": hexToRgb(fgHex),
    "--card": cardHex,
    "--card-foreground": cardFgHex,
    "--muted": mutedHex,
    "--muted-foreground": mutedFgHex,
    "--border": borderHex,
    "--primary": primaryHex,
    "--primary-foreground": primaryFgHex,
    "--primary-rgb": hexToRgb(primaryHex),
    "--accent": accentHex,
    "--accent-foreground": accentFgHex,
    "--success": "#16a34a",
    "--warning": "#f59e0b",
    "--danger": "#dc2626",
  };

  return vars;
}

export function cssVarsToStyle(vars: Record<string, string>) {
  return Object.entries(vars)
    .filter(([k]) => VAR_NAME_RE.test(k))
    .map(([k, v]) => [k, safeValue(v)] as const)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

export function themeStyleSheet(theme: Theme, scope = ".storefront") {
  const css = cssVarsToStyle(themeToCssVars(theme, theme.mode === "dark" ? "dark" : "light"));
  const ambientCss = theme.ambientBackdrop?.layers?.length
    ? `;--ambient-layers:${theme.ambientBackdrop.layers
        .map((l) => `radial-gradient(ellipse ${l.size} at ${l.position}, ${l.color} 0%, transparent 70%)`)
        .join(",")}`
    : "";
  const typography =
    `:where(${scope}){font-family:var(--font-body);font-size:var(--font-size-base);color:var(--foreground);background:var(--background)}` +
    `:where(${scope}) :where(h1,h2,h3,h4,h5,h6){font-family:var(--font-heading);color:var(--foreground)}`;
  return `${scope}{${css}${ambientCss};color-scheme:${theme.mode === "dark" ? "dark" : "light"}}${typography}`;
}