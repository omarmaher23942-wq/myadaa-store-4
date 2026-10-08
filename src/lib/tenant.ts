import "server-only";
import { cache } from "react";
import { eq, and, isNull, getTableColumns } from "drizzle-orm";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { headers } from "next/headers";
import { EDITION } from "@/lib/edition";
import { db } from "@/db/client";
import { stores, storeBlueprints } from "@/db/schema";
import { redis, rkeys } from "@/lib/redis";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";

export type TenantStore = typeof stores.$inferSelect;

const STORE_TTL_S = 60;
const STORE_MISS_TTL_S = 30;
const BLUEPRINT_TTL_S = 300;
const NONE = { __none: true } as const;
type Miss = typeof NONE;

// ═══════════════════════════════════════════════════════════════════════════
// HIDDEN_STATUSES: فقط الحالات النهائية المخفية عن الجمهور.
//
// الحالات المؤقتة (intake, building, pending_review, frozen) لم تعد
// مخفية — الـ storefront layout يعرض FrozenGate لها بشكل أنيق، مع منع
// الطلبات. هذا أفضل تجربة مستخدم من 404 مخفي.
// ═══════════════════════════════════════════════════════════════════════════
const HIDDEN_STATUSES: ReadonlySet<string> = new Set(["deleted", "suspended"]);

const STORE_DATE_KEYS = Object.entries(getTableColumns(stores))
  .filter(([, c]) => c.dataType === "date")
  .map(([k]) => k);

function reviveStore(row: Record<string, unknown>): TenantStore {
  const out: Record<string, unknown> = { ...row };
  for (const k of STORE_DATE_KEYS) {
    const v = out[k];
    if (typeof v === "string" || typeof v === "number") out[k] = new Date(v);
  }
  return out as TenantStore;
}

const isMiss = (v: unknown): v is Miss =>
  typeof v === "object" && v !== null && "__none" in v;

async function readStore(sub: string): Promise<TenantStore | null> {
  const [row] = await db
    .select()
    .from(stores)
    .where(and(eq(stores.subdomain, sub), isNull(stores.deletedAt)))
    .limit(1);
  return row ?? null;
}

export const getStoreBySubdomain = cache(
  async (subdomain: string): Promise<TenantStore | null> => {
    const sub = subdomain.trim().toLowerCase();
    if (!sub) return null;

    const key = rkeys.storeBySubdomain(sub);

    try {
      const hit = await redis.get<Record<string, unknown> | Miss>(key);
      if (hit) return isMiss(hit) ? null : reviveStore(hit);
    } catch (e) {
      console.error("[tenant] redis read failed:", e);
    }

    let row: TenantStore | null;
    try {
      row = await readStore(sub);
    } catch (e) {
      // نسخة التاجر قبل ربط قاعدتها: لا متجر بعد، وrequireStore يحوّل لصفحة الإعداد.
      if (EDITION === "store") return null;
      throw e;
    }
    try {
      await redis.set(key, row ?? NONE, {
        ex: row ? STORE_TTL_S : STORE_MISS_TTL_S,
      });
    } catch (e) {
      console.error("[tenant] redis write failed:", e);
    }
    return row;
  }
);

export async function requireStore(
  subdomain: string,
  opts: { allowHidden?: boolean } = {}
): Promise<TenantStore> {
  let store: TenantStore | null;
  try {
    store = await getStoreBySubdomain(subdomain);
  } catch (e) {
    // نسخة التاجر قبل ربط قاعدتها أو تجهيزها: صفحة الإعداد تشرح الخطوة التالية.
    if (EDITION === "store") redirect("/setup");
    throw e;
  }
  if (!store) {
    if (EDITION === "store") redirect("/setup");
    notFound();
  }
  // استلم التاجر متجره على حساباته: نطاق المنصة يحوّل الزائر لنفس الصفحة في متجره الجديد.
  if (EDITION === "platform" && store.ownedUrl) {
    const path = (await headers()).get("x-pathname") ?? "/";
    permanentRedirect(new URL(path, store.ownedUrl).toString());
  }
  if (!opts.allowHidden && HIDDEN_STATUSES.has(store.status)) notFound();
  return store;
}

async function readBlueprintData(storeId: string): Promise<unknown> {
  const [row] = await db
    .select()
    .from(storeBlueprints)
    .where(eq(storeBlueprints.storeId, storeId))
    .limit(1);
  return row?.data ?? null;
}

export const getBlueprint = cache(
  async (storeId: string): Promise<StoreBlueprint> => {
    const key = rkeys.blueprint(storeId);
    let data: unknown = null;

    try {
      data = await redis.get(key);
    } catch (e) {
      console.error("[tenant] redis read failed:", e);
    }

    if (!data) {
      data = await readBlueprintData(storeId);
      if (data) {
        try {
          await redis.set(key, data, { ex: BLUEPRINT_TTL_S });
        } catch (e) {
          console.error("[tenant] redis write failed:", e);
        }
      }
    }

    if (!data) notFound();
    return blueprintSchema.parse(data);
  }
);

/**
 * نسخة آمنة تُعيد null بدل notFound() عند غياب الـ blueprint.
 * تُستخدم في الـ layouts التي تريد التعامل مع الغياب بأناقة (مثل FrozenGate).
 */
export const getBlueprintOrNull = cache(
  async (storeId: string): Promise<StoreBlueprint | null> => {
    const key = rkeys.blueprint(storeId);
    let data: unknown = null;

    try {
      data = await redis.get(key);
    } catch (e) {
      console.error("[tenant] redis read failed:", e);
    }

    if (!data) {
      data = await readBlueprintData(storeId);
      if (data) {
        try {
          await redis.set(key, data, { ex: BLUEPRINT_TTL_S });
        } catch (e) {
          console.error("[tenant] redis write failed:", e);
        }
      }
    }

    if (!data) return null;
    try {
      return blueprintSchema.parse(data);
    } catch {
      return null;
    }
  }
);

export async function invalidateStoreCache(store: {
  id: string;
  subdomain: string;
}) {
  try {
    await redis.del(
      rkeys.storeBySubdomain(store.subdomain.toLowerCase()),
      rkeys.blueprint(store.id),
      rkeys.storefrontHome(store.id)
    );
  } catch (e) {
    console.error("[tenant] cache invalidation failed:", e);
  }
}

export function isStorePubliclyVisible(store: TenantStore) {
  return (
    store.status === "trial" ||
    store.status === "active" ||
    store.status === "review"
  );
}