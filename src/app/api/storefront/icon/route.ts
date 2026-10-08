// /api/storefront/icon — أيقونة المتجر (favicon) على نطاقه.
// شعار التاجر إن وُجد، وإلا حرف أول من اسم المتجر بلون هويته. لا أيقونة للمنصة أبداً.
import { headers } from "next/headers";
import { getStoreBySubdomain, getBlueprintOrNull } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const escapeXml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

function letterMark(name: string, bg: string, fg: string): string {
  const letter = escapeXml(Array.from(name.trim())[0] ?? "•");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${bg}"/><text x="32" y="33" dominant-baseline="central" text-anchor="middle" font-family="Tajawal,Cairo,'Segoe UI',Arial,sans-serif" font-size="36" font-weight="800" fill="${fg}">${letter}</text></svg>`;
}

const HEX = /^#[0-9a-f]{3,8}$/i;

export async function GET() {
  const sub = (await headers()).get("x-store-subdomain");
  const store = sub ? await getStoreBySubdomain(sub) : null;
  if (!store) return new Response("Not found", { status: 404 });

  const bp = await getBlueprintOrNull(store.id);
  const custom = bp?.brand.favicon ?? bp?.brand.logo?.url;
  if (custom) {
    return Response.redirect(custom, 307);
  }

  const palette = (bp?.theme.palette ?? {}) as Record<string, unknown>;
  const bg = typeof palette.primary === "string" && HEX.test(palette.primary) ? palette.primary : "#111827";
  const fg =
    typeof palette.primaryForeground === "string" && HEX.test(palette.primaryForeground)
      ? palette.primaryForeground
      : "#ffffff";

  return new Response(letterMark(bp?.brand.name ?? store.name, bg, fg), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
