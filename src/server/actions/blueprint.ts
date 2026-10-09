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
import { blueprintSchema, validateBlueprint, type StoreBlueprint } from "@/blueprint/schema";
import { describeIssue } from "@/blueprint/issues";
import { applyChanges, type BpChange } from "@/lib/blueprint-patch";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; error?: undefined }
  | { ok: false; error: string; data?: undefined };

const changesSchema = z
  .array(
    z.object({
      path: z.union([z.tuple([z.string().min(1).max(40)]), z.tuple([z.string().min(1).max(40), z.string().min(1).max(60)])]),
      value: z.unknown(),
    })
  )
  .max(300);

/**
 * يحفظ «ما تغيّر فقط» (diffBlueprint في lib/blueprint-patch.ts) فوق النسخة الحالية في الخادم، لا نسخة الصفحة كاملة:
 * تعديل حُفظ من صفحة أخرى بعد فتح هذه الصفحة يبقى. يعيد النسخة الناتجة لتبني عليها الصفحة تعديلاتها التالية.
 */
export async function saveBlueprintChangesAction(raw: unknown, label: string): Promise<ActionResult<{ version: number; blueprint: StoreBlueprint }>> {
  try {
    const s = await getMerchantStoreOrNull();
    if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
    const parsed = changesSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "تغييرات غير صالحة" };
    if (!parsed.data.length) return { ok: false, error: "لا تغييرات للحفظ" };
    const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
    if (!row) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
    const next = applyChanges(row.data as Record<string, unknown>, parsed.data as BpChange[]) as unknown as StoreBlueprint;
    const r = await saveBlueprintAction(next, String(label).slice(0, 80));
    if (!r.ok) return r;
    const v = validateBlueprint(next);
    return { ok: true, data: { version: r.data!.version, blueprint: v.ok ? v.data : next } };
  } catch (e) {
    unstable_rethrow(e);
    console.error("[saveBlueprintChangesAction] error:", e);
    return { ok: false, error: "تعذر حفظ إعدادات المتجر" };
  }
}

export async function saveBlueprintAction(
  next: StoreBlueprint,
  label: string
): Promise<ActionResult<{ version: number }>> {
  try {
    const s = await getMerchantStoreOrNull();
    if (!s) return { ok: false, error: "غير مصرح" };

    const parsed = blueprintSchema.safeParse(next);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: first ? describeIssue(first, next).text : "إعدادات المتجر غير صالحة" };
    }
    const v = { data: parsed.data };

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
