"use server";

// server/actions/reviews.ts — إدارة كاملة للمراجعات.
//
// التوقيعات متوافقة مع ReviewActionButtons.tsx و CustomerReviewForm.tsx:
//   submitCustomerReviewAction(input)
//   approveReviewAction(reviewId, approved = true)
//   toggleReviewApprovalAction(reviewId, approved)
//   restoreReviewAction(snapshot)
//   deleteReviewAction(reviewId)
import { revalidatePath } from "next/cache";
import { and, eq, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { reviews, products, orders } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { allow, clientIp } from "@/lib/ratelimit";

type ActionResult<T = undefined> =
  | { ok: true; data?: T; error?: undefined }
  | { ok: false; error: string; data?: undefined };

// ─── دالة مساعدة: تعديل aggregate على المنتج ───────────────────────────────
async function bumpProductRating(
  storeId: string,
  productId: string,
  delta: { sum: number; count: number }
): Promise<void> {
  if (delta.sum === 0 && delta.count === 0) return;
  const db = await getTenantDb(storeId);
  await db
    .update(products)
    .set({
      ratingSum: sql`GREATEST(${products.ratingSum} + ${delta.sum}, 0)`,
      ratingCount: sql`GREATEST(${products.ratingCount} + ${delta.count}, 0)`,
    })
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)));
}

/** هل المنتج من متجر معيّن وغير محذوف؟ */
async function productBelongsToStore(storeId: string, productId: string): Promise<boolean> {
  const db = await getTenantDb(storeId);
  const [p] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.storeId, storeId), isNull(products.deletedAt)))
    .limit(1);
  return Boolean(p);
}

// ─── 1) إنشاء مراجعة من العميل ─────────────────────────────────────────────
const submitReviewSchema = z.object({
  orderId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().max(30).optional(),
  imageUrls: z.array(z.string().url()).max(6).default([]),
  audioUrl: z.string().url().optional().nullable(),
  audioDurationSeconds: z.coerce.number().int().min(0).optional().nullable(),
  storeId: z.string().uuid(),
});

export async function submitCustomerReviewAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!(await allow("review", clientIp(await headers())))) {
      return { ok: false, error: "محاولات كثيرة، حاول بعد دقائق" };
    }
    const parsed = submitReviewSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return {
        ok: false,
        error: first?.message ?? "بيانات التقييم غير صالحة",
      };
    }
    const d = parsed.data;
    const db = await getTenantDb(d.storeId);

    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.id, d.productId),
          eq(products.storeId, d.storeId),
          isNull(products.deletedAt)
        )
      )
      .limit(1);
    if (!product) return { ok: false, error: "المنتج غير موجود" };

    let verifiedOrderId: string | null = null;
    if (d.orderId) {
      const [order] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.id, d.orderId), eq(orders.storeId, d.storeId)))
        .limit(1);
      verifiedOrderId = order?.id ?? null;
    }

    const [created] = await db
      .insert(reviews)
      .values({
        storeId: d.storeId,
        productId: d.productId,
        orderId: verifiedOrderId,
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        rating: d.rating,
        body: d.body,
        imageUrls: d.imageUrls,
        audioUrl: d.audioUrl ?? null,
        audioDurationSeconds: d.audioDurationSeconds ?? null,
        isApproved: false,
        isVerified: Boolean(verifiedOrderId),
      })
      .returning({ id: reviews.id });

    if (!created) return { ok: false, error: "تعذر حفظ التقييم" };

    revalidatePath("/dashboard/reviews");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "تعذر حفظ التقييم" };
  }
}

// ─── 2) اعتماد / إلغاء اعتماد ──────────────────────────────────────────────
export async function approveReviewAction(
  reviewId: string,
  approved: boolean = true
): Promise<ActionResult> {
  try {
    const s = await getMerchantStoreOrNull();
    if (!s) return { ok: false, error: "غير مصرح" };
    const db = await getTenantDb(s.storeId);

    const [review] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.storeId, s.storeId)))
      .limit(1);

    if (!review) return { ok: false, error: "التقييم غير موجود" };
    if (review.isApproved === approved) return { ok: true };

    await db
      .update(reviews)
      .set({ isApproved: approved })
      .where(and(eq(reviews.id, reviewId), eq(reviews.storeId, s.storeId)));

    await bumpProductRating(s.storeId, review.productId, {
      sum: approved ? review.rating : -review.rating,
      count: approved ? 1 : -1,
    });

    revalidatePath("/dashboard/reviews");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل تحديث حالة التقييم" };
  }
}

// ─── 3) تبديل الحالة (alias واضح) ──────────────────────────────────────────
export async function toggleReviewApprovalAction(
  reviewId: string,
  approved: boolean
): Promise<ActionResult> {
  return approveReviewAction(reviewId, approved);
}

const reviewSnapshotSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  customerName: z.string().trim().min(1).max(80),
  customerPhone: z.string().trim().max(30).nullable(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).nullable(),
  imageUrls: z.array(z.string().url()).max(6),
  audioUrl: z.string().url().nullable(),
  audioDurationSeconds: z.number().int().min(0).max(600).nullable(),
  isApproved: z.boolean(),
});

// ─── 4) استرجاع تقييم محذوف (يعيد الإدراج) ────────────────────────────────
export type ReviewSnapshot = {
  id: string;
  storeId: string;
  productId: string | null;
  orderId: string | null;
  customerName: string;
  customerPhone: string | null;
  rating: number;
  body: string | null;
  audioUrl: string | null;
  audioDurationSeconds: number | null;
  imageUrls: string[];
  isApproved: boolean;
  isVerified: boolean;
};

export async function restoreReviewAction(
  snapshot: ReviewSnapshot
): Promise<ActionResult> {
  try {
    const s = await getMerchantStoreOrNull();
    if (!s) return { ok: false, error: "غير مصرح" };
    const db = await getTenantDb(s.storeId);
    const parsed = reviewSnapshotSchema.safeParse(snapshot);
    if (!parsed.success || parsed.data.storeId !== s.storeId) {
      return { ok: false, error: "غير مصرح" };
    }
    const snap = parsed.data;
    if (!snap.productId || !(await productBelongsToStore(s.storeId, snap.productId))) {
      return { ok: false, error: "لا يمكن الاسترجاع بدون منتج" };
    }

    // التوثيق لا يُقبل من المتصفح: يُعاد حسابه من طلب يخص هذا المتجر فعلاً.
    let verifiedOrderId: string | null = null;
    if (snap.orderId) {
      const [o] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.id, snap.orderId), eq(orders.storeId, s.storeId)))
        .limit(1);
      verifiedOrderId = o?.id ?? null;
    }

    const restored = await db
      .insert(reviews)
      .values({
        id: snap.id,
        storeId: s.storeId,
        productId: snap.productId,
        orderId: verifiedOrderId,
        customerName: snap.customerName,
        customerPhone: snap.customerPhone,
        rating: snap.rating,
        body: snap.body,
        imageUrls: snap.imageUrls,
        audioUrl: snap.audioUrl,
        audioDurationSeconds: snap.audioDurationSeconds,
        isApproved: snap.isApproved,
        isVerified: Boolean(verifiedOrderId),
      })
      .onConflictDoNothing()
      .returning({ id: reviews.id });

    if (restored.length && snap.isApproved) {
      await bumpProductRating(s.storeId, snap.productId, {
        sum: snap.rating,
        count: 1,
      });
    }

    revalidatePath("/dashboard/reviews");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "تعذر استرجاع التقييم" };
  }
}

// ─── 5) حذف نهائي ──────────────────────────────────────────────────────────
export async function deleteReviewAction(
  reviewId: string
): Promise<ActionResult> {
  try {
    const s = await getMerchantStoreOrNull();
    if (!s) return { ok: false, error: "غير مصرح" };
    const db = await getTenantDb(s.storeId);

    const [review] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.storeId, s.storeId)))
      .limit(1);

    if (!review) return { ok: false, error: "التقييم غير موجود" };

    if (review.isApproved) {
      await bumpProductRating(s.storeId, review.productId, {
        sum: -review.rating,
        count: -1,
      });
    }

    await db
      .delete(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.storeId, s.storeId)));

    revalidatePath("/dashboard/reviews");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل حذف التقييم" };
  }
}