import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { products, categories } from "@/db/schema";
import { getStoreBySubdomain, getBlueprint } from "@/lib/tenant";
import { storeUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const sub = h.get("x-store-subdomain");

  if (!sub) {
    const baseUrl = `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`;
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1,
      },
      {
        url: `${baseUrl}/login`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/signup`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${baseUrl}/privacy`,
        lastModified: new Date(),
        changeFrequency: "yearly",
        priority: 0.5,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: new Date(),
        changeFrequency: "yearly",
        priority: 0.5,
      },
    ];
  }

  const s = await getStoreBySubdomain(sub);
  if (!s || s.status !== "active") return [];

  const db = await getTenantDb(s.id);
  const [bp, ps, cs] = await Promise.all([
    getBlueprint(s.id),
    db
      .select({ slug: products.slug, u: products.updatedAt })
      .from(products)
      .where(
        and(
          eq(products.storeId, s.id),
          eq(products.status, "active"),
          isNull(products.deletedAt)
        )
      ),
    db
      .select({ slug: categories.slug })
      .from(categories)
      .where(
        and(eq(categories.storeId, s.id), eq(categories.isVisible, true))
      ),
  ]);

  const u = (p: string) => storeUrl(s.subdomain, p);

  return [
    {
      url: u(""),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...cs.map((c) => ({
      url: u(`/c/${encodeURIComponent(c.slug)}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...ps.map((p) => ({
      url: u(`/p/${encodeURIComponent(p.slug)}`),
      lastModified: p.u,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    ...bp.pages
      .filter((p) => p.enabled)
      .map((p) => ({
        url: u(`/pages/${p.slug}`),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
  ];
}