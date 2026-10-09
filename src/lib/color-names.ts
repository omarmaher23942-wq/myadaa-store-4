// color-names.ts — لون تقريبي من اسم اللون بالعربي أو الإنجليزي (لعرض دائرة اللون في المتجر واللوحة).
const MAP: [RegExp, string][] = [
  [/black|أسود|اسود/, "#111111"],
  [/off.?white|أوف وايت|اوف وايت|كريمي|كريم|سكري/, "#f3eee2"],
  [/white|أبيض|ابيض/, "#ffffff"],
  [/burgundy|نبيتي|عنابي|خمري/, "#7a1f3d"],
  [/red|أحمر|احمر/, "#dc2626"],
  [/navy|كحلي/, "#1e293b"],
  [/sky|سماوي|لبني/, "#7dd3fc"],
  [/blue|أزرق|ازرق/, "#1e40af"],
  [/olive|زيتي/, "#5b6b2f"],
  [/mint|منت|نعناعي/, "#98e2c6"],
  [/green|أخضر|اخضر/, "#166534"],
  [/mustard|مستردة|خردلي/, "#c9a227"],
  [/yellow|أصفر|اصفر/, "#eab308"],
  [/orange|برتقالي/, "#ea580c"],
  [/camel|جملي|كاميل/, "#c19a6b"],
  [/beige|بيج/, "#d6c7a1"],
  [/brown|بني|شوكولاتة/, "#7c4a2d"],
  [/charcoal|فحمي/, "#36454f"],
  [/gr[ae]y|رمادي|رصاصي/, "#9ca3af"],
  [/rose|روز|بمبي/, "#f9a8b8"],
  [/pink|وردي|بينك/, "#f472b6"],
  [/purple|بنفسجي|موف|ليلكي/, "#7c3aed"],
  [/gold|ذهبي/, "#d4a017"],
  [/silver|فضي/, "#c0c0c0"],
  [/turquoise|تركواز|فيروزي/, "#14b8a6"],
];

/** HEX للون إن عرفناه من اسمه، وإلا null. */
export function colorFromName(label: string): string | null {
  const l = label.toLowerCase();
  for (const [re, hex] of MAP) if (re.test(l)) return hex;
  return /^#[0-9a-f]{6}$/i.test(label.trim()) ? label.trim() : null;
}

/** هل اسم الخيار يدل على اللون؟ */
export const isColorOption = (name: string) => /لون|color|colour/i.test(name);
