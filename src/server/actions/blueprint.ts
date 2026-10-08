"use server";

// actions/blueprint.ts — Server Actions لحفظ Blueprint المتجر + عملياته.
// التعديلات الجذرية:
//  - unstable_rethrow في كل catch.
//  - ActionResult موحّد.
//  - revalidatePath أوسع: /admin + /dashboard/settings + /dashboard.
//  - نسخة منظمة بدون ضغط سطر واحد لتسهيل القراءة والصيانة.
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { storeBlueprints, storeSnapshots, stores } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { invalidateStoreCache } from "@/lib/tenant";
import { z } from "zod";
import { validateBlueprint, type StoreBlueprint } from "@/blueprint/schema";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; error?: undefined }
  | { ok: false; error: string; data?: undefined };

export async function saveBlueprintAction(
  next: StoreBlueprint,
  label: string
): Promise<ActionResult<{ version: number }>> {
  try {
    const s = await getMerchantStoreOrNull();
    if (!s) return { ok: false, error: "غير مصرح" };

    const v = validateBlueprint(next);
    if (!v.ok) {
      const first = v.errors[0];
      return {
        ok: false,
        error: first ? `${first.path}: ${first.message}` : "Blueprint غير صالح",
      };
    }

    const [cur] = await db
      .select()
      .from(storeBlueprints)
      .where(eq(storeBlueprints.storeId, s.storeId))
      .limit(1);

    const version = (cur?.version ?? 0) + 1;
    const by = `merchant:${s.merchantId}`;
    const now = new Date();

    await db.batch([
      ...(cur
        ? [
            db.insert(storeSnapshots).values({
              storeId: s.storeId,
              version: cur.version,
              data: cur.data,
              label,
              createdBy: by,
            })
            .onConflictDoNothing({ target: [storeSnapshots.storeId, storeSnapshots.version] }),
          ]
        : []),
      db
        .insert(storeBlueprints)
        .values({
          storeId: s.storeId,
          version,
          data: v.data,
          updatedBy: by,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: storeBlueprints.storeId,
          set: {
            version,
            data: v.data,
            updatedBy: by,
            updatedAt: now,
          },
        }),
      db
        .update(stores)
        .set({ name: v.data.brand.name, updatedAt: now })
        .where(eq(stores.id, s.storeId)),
      db.execute(sql`
        delete from store_snapshots
        where store_id = ${s.storeId}
          and id not in (
            select id from store_snapshots
            where store_id = ${s.storeId}
            order by version desc
            limit 50
          )
      `),
    ] as never);

    await invalidateStoreCache(s.store);
    revalidatePath("/admin");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: true, data: { version } };
  } catch (e) {
    unstable_rethrow(e);
    // eslint-disable-next-line no-console
    console.error("[saveBlueprintAction] error:", e);
    return { ok: false, error: "تعذر حفظ إعدادات المتجر" };
  }
}

export async function revertSnapshotAction(
  snapshotId: string
): Promise<ActionResult<{ version: number }>> {
  try {
    const s = await getMerchantStoreOrNull();
    if (!s) return { ok: false, error: "غير مصرح" };

    if (!z.string().uuid().safeParse(snapshotId).success) {
      return { ok: false, error: "نسخة غير موجودة" };
    }

    const [snap] = await db
      .select()
      .from(storeSnapshots)
      .where(
        and(
          eq(storeSnapshots.id, snapshotId),
          eq(storeSnapshots.storeId, s.storeId)
        )
      )
      .limit(1);

    if (!snap) return { ok: false, error: "نسخة غير موجودة" };

    return await saveBlueprintAction(
      snap.data,
      `رجوع إلى النسخة ${snap.version}`
    );
  } catch (e) {
    unstable_rethrow(e);
    // eslint-disable-next-line no-console
    console.error("[revertSnapshotAction] error:", e);
    return { ok: false, error: "تعذر الرجوع للنسخة" };
  }
}

/**
 * الحقول التشغيلية الوحيدة التي يملك التاجر تعديلها في جدول stores.
 * أي مفتاح آخر (status, merchantId, subdomain, …) يُحذف قبل الكتابة.
 */
const storeOpsSchema = z
  .object({
    acceptingOrders: z.boolean().optional(),
    vacationMessage: z.string().trim().max(300).optional(),
    showcaseOptIn: z.boolean().optional(),
  });

export async function setStoreOpsAction(input: unknown): Promise<ActionResult> {
  try {
    const s = await getMerchantStoreOrNull();
    if (!s) return { ok: false, error: "غير مصرح" };

    const parsed = storeOpsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "بيانات غير صالحة" };

    await db
      .update(stores)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(stores.id, s.storeId));

    await invalidateStoreCache(s.store);
    revalidatePath("/admin");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    // eslint-disable-next-line no-console
    console.error("[setStoreOpsAction] error:", e);
    return { ok: false, error: "تعذر تحديث عمليات المتجر" };
  }
}