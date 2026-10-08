// middleware.ts — نطاقك كله هو متجرك، عدا لوحة التحكم والدخول والإعداد الأول.
// المتجر يُعرض داخلياً من /s/{متجرك}/… بنفس مكونات Colapia، فتبقى الواجهة مطابقة 100%.
import { NextRequest, NextResponse } from "next/server";
import { REQ_ID_HEADER, newRequestId, isWellFormedRequestId } from "@/lib/correlation";
import { STORE } from "@/store.config";

const OWNER_PREFIXES = ["/dashboard", "/login", "/setup", "/print"];
const STORE_HEADER = "x-store-subdomain";
const PATH_HEADER = "x-pathname";
const MERCHANT_COOKIE = "clp_m";
const STORE_METADATA_PATHS = new Set(["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]);

const isUnder = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

function trustedHeaders(req: NextRequest, sub: string | null): Headers {
  const h = new Headers(req.headers);
  h.delete(STORE_HEADER);
  h.delete(PATH_HEADER);
  h.delete(REQ_ID_HEADER);
  const incoming = req.headers.get(REQ_ID_HEADER);
  h.set(REQ_ID_HEADER, isWellFormedRequestId(incoming) ? incoming : newRequestId());
  h.set(PATH_HEADER, req.nextUrl.pathname);
  if (sub) h.set(STORE_HEADER, sub);
  return h;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = url;

  if (isUnder(pathname, "/s")) return new NextResponse("Not found", { status: 404 });

  if (OWNER_PREFIXES.some((p) => isUnder(pathname, p))) {
    if (isUnder(pathname, "/dashboard") && !req.cookies.get(MERCHANT_COOKIE)?.value) {
      const login = new URL("/login", req.url);
      login.searchParams.set("redirect", `${pathname}${url.search}`);
      return NextResponse.redirect(login);
    }
    return NextResponse.next({ request: { headers: trustedHeaders(req, null) } });
  }

  const headers = trustedHeaders(req, STORE.subdomain);
  if (pathname === "/favicon.ico") {
    url.pathname = "/api/storefront/icon";
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (isUnder(pathname, "/api") || STORE_METADATA_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers } });
  }
  url.pathname = `/s/${STORE.subdomain}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|brand/|sounds/|logo.png).*)"],
};
