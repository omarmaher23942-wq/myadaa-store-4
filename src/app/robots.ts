import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getStoreBySubdomain } from "@/lib/tenant";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const sub = h.get("x-store-subdomain");

  if (!sub) {
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/dashboard/", "/api/"],
      },
      sitemap: `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/sitemap.xml`,
    };
  }

  const store = await getStoreBySubdomain(sub);
  const allow = store && store.status === "active" && !store.deletedAt;

  return {
    rules: allow
      ? {
          userAgent: "*",
          allow: "/",
          disallow: [
            "/admin/",
            "/account/",
            "/cart",
            "/checkout",
            "/track",
            "/api/",
          ],
        }
      : {
          userAgent: "*",
          disallow: "/",
        },
    sitemap: allow
      ? `https://${sub}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/sitemap.xml`
      : undefined,
  };
}