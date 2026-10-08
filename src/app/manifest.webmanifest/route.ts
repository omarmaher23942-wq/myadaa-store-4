// Dynamic manifest — يقرأ هوية المتجر عند وجود subdomain، وإلا يعود لهوية المنصة.
//
// أيقونات PWA:
// - purpose: "any" فقط. لا نستخدم "maskable" لأن Windows يضيف هامش 40%
//   تلقائياً على الأيقونات maskable، مما يجعل الشعار أصغر بصرياً بكثير.
// - نُمرّر logo.png بحجمي 192 و 512 لتغطية كل منصات الديسكتوب والموبايل.
import { headers } from "next/headers";
import { getStoreBySubdomain, getBlueprint } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const h = await headers();
  const sub = h.get("x-store-subdomain");

  let store: Awaited<ReturnType<typeof getStoreBySubdomain>> = null;
  let bp: Awaited<ReturnType<typeof getBlueprint>> | null = null;

  if (sub) {
    try {
      store = await getStoreBySubdomain(sub);
      if (store) bp = await getBlueprint(store.id);
    } catch {
      store = null;
      bp = null;
    }
  }

  const name = bp?.brand.name ?? store?.name ?? "Colapia";
  const shortName = name.slice(0, 12);

  const background =
    (bp?.theme?.palette as { background?: string } | undefined)?.background ??
    "#07091a";
  const theme =
    (bp?.theme?.palette as { primary?: string } | undefined)?.primary ??
    "#6f86ff";

  // المتجر: شعاره أو أيقونته المولّدة. المنصة: شعار المنصة.
  const iconUrl = store ? bp?.brand.logo?.url ?? "/api/storefront/icon" : "/logo.png";
  const iconType = iconUrl === "/api/storefront/icon" ? "image/svg+xml" : "image/png";

  const manifest = {
    name,
    short_name: shortName,
    description:
      store ? bp?.brand.tagline ?? name : "متجرك الإلكتروني الاحترافي — Colapia",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "rtl",
    lang: "ar",
    background_color: background,
    theme_color: theme,
    categories: ["shopping", "business"],
    // ─── أيقونات PWA ─────────────────────────────────────────────────────
    // purpose: "any" فقط. لا maskable — نمنع Windows من إضافة هامش 40%.
    icons: [
      {
        src: iconUrl,
        sizes: "192x192",
        type: iconType,
        purpose: "any",
      },
      {
        src: iconUrl,
        sizes: "512x512",
        type: iconType,
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "سلة التسوق",
        short_name: "السلة",
        url: "/cart",
      },
      {
        name: "تتبع طلبي",
        short_name: "تتبع",
        url: "/track",
      },
    ],
    screenshots: [],
    prefer_related_applications: false,
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}