// skin.ts — CSS يكتبه الذكاء الاصطناعي لكل متجر ("جلد" المتجر)، بعد تنقيته بصرامة.
//
// المسموح: تغيير الشكل فقط (ألوان، خلفيات متدرجة، حدود، زوايا، ظلال، خطوط، حركة) على
// خطافات ثابتة في المكوّنات (.s-card، .s-btn، .s-title...). الممنوع: أي شيء يغيّر التخطيط
// (display، position، width، margin...)، أو يحمّل موارد خارجية (url، @import)، أو يكسر الصفحة.
// كل قاعدة تُحصر تحت نطاق المتجر، فلا يمكن أن تمس أي عنصر خارجه.

const MAX_INPUT = 12_000;
const MAX_OUTPUT = 6_000;

// خصائص الشكل فقط. لا شيء يؤثر في الأبعاد أو موضع العناصر.
const ALLOWED_PROPS = new Set([
  "color", "background", "background-color", "background-image", "background-size", "background-position", "background-repeat", "background-blend-mode",
  "border", "border-color", "border-style", "border-width", "border-top", "border-bottom", "border-inline-start", "border-inline-end",
  "border-top-color", "border-bottom-color", "border-radius", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "border-start-start-radius", "border-start-end-radius", "border-end-start-radius", "border-end-end-radius",
  "box-shadow", "text-shadow", "outline", "outline-color", "outline-offset", "outline-style", "outline-width",
  "font-weight", "font-style", "letter-spacing", "text-transform", "text-decoration", "text-decoration-color", "text-decoration-thickness", "text-underline-offset",
  "opacity", "filter", "backdrop-filter", "-webkit-backdrop-filter", "mix-blend-mode", "accent-color", "caret-color",
  "transition", "transition-duration", "transition-timing-function", "transition-property", "transform", "transform-origin",
  "animation", "animation-duration", "animation-timing-function", "animation-delay", "animation-iteration-count", "animation-direction",
]);

// كل جزء من المحدد يجب أن يكون خطافاً معروفاً أو وسماً نصياً أو حالة تفاعل.
const SELECTOR_TOKEN = /^(\.s-[a-z0-9-]+|\[data-[a-z0-9-]+(?:[~^$*|]?="[a-z0-9_ -]*")?\]|h[1-4]|p|a|strong|em|small|img|svg|:hover|:focus-visible|:active|:first-child|:last-child|:nth-child\(\d+n?(?:\+\d+)?\)|::before|::after|::placeholder|::selection|\*)+$/i;

const BANNED_VALUE = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding|<\/?style|\\[0-9a-f]{1,6}/i;

type Rule = { selector: string; body: string };

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function cleanDeclarations(body: string): string {
  const out: string[] = [];
  for (const raw of body.split(";")) {
    const i = raw.indexOf(":");
    if (i < 1) continue;
    const prop = raw.slice(0, i).trim().toLowerCase();
    let value = raw.slice(i + 1).trim().replace(/!important/gi, "").trim();
    if (!ALLOWED_PROPS.has(prop) && !/^--s-[a-z0-9-]+$/.test(prop)) continue;
    if (!value || value.length > 400 || BANNED_VALUE.test(value)) continue;
    value = value.replace(/[{}<>]/g, "");
    out.push(`${prop}:${value}`);
  }
  return out.join(";");
}

function cleanSelector(sel: string, scope: string): string | null {
  const parts = sel.split(",").map((s) => s.trim()).filter(Boolean);
  const safe: string[] = [];
  for (const part of parts) {
    const tokens = part.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
    if (!tokens.length || !tokens.every((t) => SELECTOR_TOKEN.test(t))) continue;
    // يجب أن يستهدف خطافاً واحداً على الأقل، فلا يُكتب "p {}" على كل الفقرات.
    if (!/\.s-[a-z0-9-]+|\[data-/i.test(part)) continue;
    safe.push(`${scope} ${part}`);
  }
  return safe.length ? safe.join(",") : null;
}

/** يقسم CSS إلى قواعد، مع دعم @media و@keyframes بمستوى تداخل واحد. */
function parse(css: string): { rules: Rule[]; media: { query: string; rules: Rule[] }[]; keyframes: { name: string; body: string }[] } {
  const rules: Rule[] = [];
  const media: { query: string; rules: Rule[] }[] = [];
  const keyframes: { name: string; body: string }[] = [];
  let i = 0;
  const readBlock = (start: number): [string, number] => {
    let depth = 0;
    for (let j = start; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) return [css.slice(start + 1, j), j + 1];
      }
    }
    return [css.slice(start + 1), css.length];
  };
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    const [body, next] = readBlock(open);
    i = next;
    if (head.startsWith("@media")) {
      const query = head.slice(6).trim();
      if (!/^\((max|min)-width:\s*\d{3,4}px\)$|^\(prefers-(reduced-motion|color-scheme):\s*[a-z-]+\)$/i.test(query)) continue;
      media.push({ query, rules: parse(body).rules });
    } else if (head.startsWith("@keyframes")) {
      const name = head.slice(10).trim();
      if (/^s-[a-z0-9-]{1,30}$/i.test(name)) keyframes.push({ name, body });
    } else if (!head.startsWith("@")) {
      rules.push({ selector: head, body });
    }
  }
  return { rules, media, keyframes };
}

function emit(rules: Rule[], scope: string): string[] {
  return rules
    .map((r) => {
      const sel = cleanSelector(r.selector, scope);
      const body = cleanDeclarations(r.body);
      return sel && body ? `${sel}{${body}}` : "";
    })
    .filter(Boolean);
}

/** ينقّي CSS المتجر ويحصره في نطاقه. أي شيء غير مفهوم يُحذف بصمت (لا يكسر المتجر أبداً). */
export function sanitizeSkinCss(input: unknown, scope = ".storefront"): string {
  if (typeof input !== "string" || !input.trim()) return "";
  const css = stripComments(input.slice(0, MAX_INPUT)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  if (/<\/?style|<script/i.test(css)) return "";
  const { rules, media, keyframes } = parse(css);
  const chunks: string[] = [...emit(rules, scope)];
  for (const m of media) {
    const inner = emit(m.rules, scope).join("");
    if (inner) chunks.push(`@media ${m.query}{${inner}}`);
  }
  for (const k of keyframes) {
    const frames = k.body
      .split("}")
      .map((f) => {
        const [sel, decl] = f.split("{");
        if (!sel || !decl || !/^\s*(from|to|\d{1,3}%)(\s*,\s*(from|to|\d{1,3}%))*\s*$/.test(sel)) return "";
        const d = cleanDeclarations(decl);
        return d ? `${sel.trim()}{${d}}` : "";
      })
      .join("");
    if (frames) chunks.push(`@keyframes ${k.name}{${frames}}`);
  }
  // قواعد كاملة فقط حتى الحد الأقصى: لا نقطع قاعدة في منتصفها أبداً.
  let out = "";
  for (const c of chunks) {
    if (out.length + c.length > MAX_OUTPUT) break;
    out += c;
  }
  return out;
}
