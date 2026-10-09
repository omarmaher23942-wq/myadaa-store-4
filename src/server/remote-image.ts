// remote-image.ts — جلب صورة من رابط يكتبه التاجر (ملف الاستيراد) بأمان قبل نقلها لمساحة المتجر:
// https فقط، ولا عناوين داخلية أو خاصة (حماية من SSRF، ويُعاد الفحص مع كل تحويل)، وحد للحجم والوقت، والنوع يُعرف
// من بايتات الملف نفسه لا من ترويسة الخادم (JPEG وPNG وWebP وGIF وAVIF فقط؛ SVG مرفوض لأنه قد يحمل سكربت).
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const REMOTE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

export type RemoteImage = { bytes: Uint8Array<ArrayBuffer>; type: string; ext: string };
export type RemoteImageError = "invalid_url" | "blocked_host" | "unreachable" | "not_found" | "too_large" | "not_image";

export const REMOTE_IMAGE_ERROR: Record<RemoteImageError, string> = {
  invalid_url: "رابط غير صالح",
  blocked_host: "عنوان غير مسموح",
  unreachable: "تعذر الوصول للرابط",
  not_found: "الصورة غير موجودة على الرابط",
  too_large: "الصورة أكبر من 8 ميجابايت",
  not_image: "الرابط ليس صورة JPG أو PNG أو WebP",
};

function privateV4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local وبيانات السحابة الوصفية
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateV6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return privateV4(mapped[1]!);
  return /^(fc|fd|fe[89ab]|ff)/.test(s) || s.startsWith("64:ff9b:") || s.startsWith("2001:db8:");
}

/** عنوان IP خاص أو داخلي (لا يُجلب منه شيء). */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return privateV4(ip);
  if (v === 6) return privateV6(ip);
  return true;
}

async function publicHost(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(host)) return false;
  if (isIP(host)) return !isPrivateAddress(host);
  const addrs = await lookup(host, { all: true, verbatim: true }).catch(() => []);
  return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
}

/** نوع الصورة من أول بايتات الملف. */
export function sniffImage(b: Uint8Array): { type: string; ext: string } | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  const ascii = (i: number, s: string) => at(i, ...[...s].map((c) => c.charCodeAt(0)));
  if (at(0, 0xff, 0xd8, 0xff)) return { type: "image/jpeg", ext: "jpg" };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { type: "image/png", ext: "png" };
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { type: "image/webp", ext: "webp" };
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return { type: "image/gif", ext: "gif" };
  if (ascii(4, "ftypavif") || ascii(4, "ftypavis")) return { type: "image/avif", ext: "avif" };
  return null;
}

async function readCapped(res: Response): Promise<Uint8Array<ArrayBuffer> | "too_large"> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > REMOTE_IMAGE_MAX_BYTES) return "too_large";
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > REMOTE_IMAGE_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return "too_large";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.byteLength;
  }
  return out;
}

export async function fetchRemoteImage(raw: string): Promise<{ ok: true; image: RemoteImage } | { ok: false; error: RemoteImageError }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (url.protocol !== "https:" || url.username || url.password) return { ok: false, error: "invalid_url" };
      if (!(await publicHost(url.hostname))) return { ok: false, error: "blocked_host" };
      const res = await fetch(url, { redirect: "manual", signal, headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1" }, cache: "no-store" });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!next) return { ok: false, error: "unreachable" };
        url = new URL(next, url);
        continue;
      }
      if (res.status === 404 || res.status === 410) return { ok: false, error: "not_found" };
      if (!res.ok) return { ok: false, error: "unreachable" };
      const bytes = await readCapped(res);
      if (bytes === "too_large") return { ok: false, error: "too_large" };
      const kind = sniffImage(bytes);
      if (!kind) return { ok: false, error: "not_image" };
      return { ok: true, image: { bytes, ...kind } };
    }
    return { ok: false, error: "unreachable" };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}
