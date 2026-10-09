"use server";

// reviews.ts — تقييمات المنتجات.
// العميل: يقيّم منتجات طلب **مُسلَّم** من صفحة «قيّم مشترياتك»، بالرابط الموقّع في بريد «وصل طلبك» أو من نفس الجهاز الذي
// طلب منه (لا برقم الطلب وحده: الأرقام قصيرة وتُخمَّن). يقيّم ما في الطلب فقط، مرة لكل منتج، والتقييم «موثّق» لأنه من
// طلب حقيقي، وينتظر اعتماد التاجر.
// التاجر: اعتماد أو إخفاء (فردي وجماعي) وحذف مع تراجع. متوسط تقييم المنتج يُعاد حسابه من التقييمات المعتمدة في نفس
// الدفعة، فلا ينحرف مع الضغط المزدوج أو الطلبات المتزامنة.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { orderItems, orders, products, reviews } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { allow, clientIp } from "@/lib/ratelimit";
import { getStoreBySubdomain, invalidateStoreCache, isStorePubliclyVisible } from "@/lib/tenant";
import { hasOrderAccess, validReviewToken } from "@/lib/order-access";
import { isHostedImage } from "@/lib/media-hosts";

type DB = Awaited<ReturnType<typeof getTenantDb>>;
type Fail = { ok: false; error: string };

/** متوسط تقييم المنتجات = مجموع التقييمات المعتمدة وعددها (يُضاف آخر الـ batch). */
function syncRatings(db: DB, storeId: string, productIds: string[]) {
  return db
    .update(products)
    .set({
      ratingSum: sql`(select coalesce(sum(r.rating), 0) from reviews r where r.product_id = products.id and r.store_id = ${storeId} and r.is_approved)`,
      ratingCount: sql`(select count(*) from reviews r where r.product_id = products.id and r.store_id = ${storeId} and r.is_approved)`,
    })
    .where(and(eq(products.storeId, storeId), inArray(products.id, productIds)));
}

// ─── العميل: تقييم منتجات طلب مُسلَّم ───────────────────────────────────────────

const submitSchema = z.object({
  subdomain: z.string().min(1).max(63),
  code: z.string().trim().toUpperCase().max(20),
  token: z.string().max(64).nullable().optional(),
  displayName: z.string().trim().min(2, "اكتب الاسم الذي يظهر مع تقييمك").max(40),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        rating: z.coerce.number().int().min(1, "اختر عدد النجوم").max(5),
        body: z.string().trim().max(1000).default(""),
        imageUrls: z.array(z.string().url()).max(3).default([]),
      })
    )
    .min(1, "قيّم منتجاً واحداً على الأقل")
    .max(20),
});

export async function submitOrderReviewsAction(raw: unknown): Promise<{ ok: true; created: number } | Fail> {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات التقييم غير صالحة" };
  const d = parsed.data;
  if (!(await allow("review", clientIp(await headers())))) return { ok: false, error: "محاولات كثيرة، حاول بعد دقائق" };

  const store = await getStoreBySubdomain(d.subdomain);
  if (!store || !isStorePubliclyVisible(store)) return { ok: false, error: "المتجر غير متاح" };
  const db = await getTenantDb(store.id);
  const [order] = await db
    .select({ id: orders.id, code: orders.code, status: orders.status, visitorId: orders.visitorId, phone: orders.customerPhone })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.code, d.code)))
    .limit(1);
  const allowed = order && (validReviewToken(store.id, order.id, d.token) || (await hasOrderAccess(store.id, order.code, order.visitorId)));
  if (!order || !allowed) return { ok: false, error: "افتح صفحة التقييم من رسالة طلبك أو من «طلباتي» على نفس الجهاز" };
  if (order.status !== "delivered") return { ok: false, error: "التقييم متاح بعد استلام الطلب" };

  const [inOrder, already] = await Promise.all([
    db.select({ productId: orderItems.productId }).from(orderItems).where(and(eq(orderItems.storeId, store.id), eq(orderItems.orderId, order.id))),
    db.select({ productId: reviews.productId }).from(reviews).where(and(eq(reviews.storeId, store.id), eq(reviews.orderId, order.id))),
  ]);
  const allowedIds = new Set(inOrder.map((i) => i.productId).filter((x): x is string => Boolean(x)));
  const done = new Set(already.map((r) => r.productId));
  const fresh = d.items.filter((i) => allowedIds.has(i.productId) && !done.has(i.productId));
  if (!fresh.length) return { ok: false, error: "قيّمت هذه المنتجات من قبل. شكراً لك" };

  await db.insert(reviews).values(
    fresh.map((i) => ({
      storeId: store.id,
      productId: i.productId,
      orderId: order.id,
      customerName: d.displayName,
      customerPhone: order.phone,
      rating: i.rating,
      body: i.body || null,
      // صور مرفوعة لمساحة المتجر فقط (لا روابط خارجية في صفحة المنتج).
      imageUrls: i.imageUrls.filter((u) => isHostedImage(u)).slice(0, 3),
      isApproved: false,
      isVerified: true,
    }))
  );
  revalidatePath("/dashboard/reviews");
  return { ok: true, created: fresh.length };
}

// ─── التاجر ─────────────────────────────────────────────────────────────────

const ids = z.array(z.string().uuid()).min(1).max(200);

async function merchant() {
  const s = await getMerchantStoreOrNull();
  return s ? { s, db: await getTenantDb(s.storeId) } : null;
}

async function after(s: { store: Parameters<typeof invalidateStoreCache>[0] }) {
  await invalidateStoreCache(s.store);
  revalidatePath("/dashboard/reviews");
  revalidatePath("/dashboard");
}

/** اعتماد تقييمات (تظهر في صفحة المنتج) أو إخفاؤها. */
export async function setReviewsApprovalAction(reviewIds: string[], approved: boolean): Promise<{ ok: true } | Fail> {
  const m = await merchant();
  if (!m) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = ids.safeParse(reviewIds);
  if (!parsed.success) return { ok: false, error: "اختر تقييماً" };
  const { s, db } = m;
  const rows = await db
    .select({ productId: reviews.productId })
    .from(reviews)
    .where(and(eq(reviews.storeId, s.storeId), inArray(reviews.id, parsed.data)));
  if (!rows.length) return { ok: false, error: "التقييم غير موجود" };
  const productIds = [...new Set(rows.map((r) => r.productId))];
  await db.batch([
    db.update(reviews).set({ isApproved: approved === true }).where(and(eq(reviews.storeId, s.storeId), inArray(reviews.id, parsed.data))),
    syncRatings(db, s.storeId, productIds),
  ]);
  await after(s);
  return { ok: true };
}

export type DeletedReview = {
  id: string;
  productId: string;
  orderId: string | null;
  customerName: string;
  customerPhone: string | null;
  rating: number;
  body: string | null;
  imageUrls: string[];
  isApproved: boolean;
  isVerified: boolean;
  createdAt: string;
};

/** حذف نهائي؛ يعيد نسخة التقييم ليُتاح «تراجع» من الإشعار. */
export async function deleteReviewAction(reviewId: string): Promise<{ ok: true; deleted: DeletedReview } | Fail> {
  const m = await merchant();
  if (!m) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  if (!z.string().uuid().safeParse(reviewId).success) return { ok: false, error: "التقييم غير موجود" };
  const { s, db } = m;
  const [r] = await db.select().from(reviews).where(and(eq(reviews.id, reviewId), eq(reviews.storeId, s.storeId))).limit(1);
  if (!r) return { ok: false, error: "التقييم غير موجود" };
  await db.batch([db.delete(reviews).where(and(eq(reviews.id, r.id), eq(reviews.storeId, s.storeId))), syncRatings(db, s.storeId, [r.productId])]);
  await after(s);
  return {
    ok: true,
    deleted: {
      id: r.id,
      productId: r.productId,
      orderId: r.orderId,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      rating: r.rating,
      body: r.body,
      imageUrls: r.imageUrls,
      isApproved: r.isApproved,
      isVerified: r.isVerified,
      createdAt: r.createdAt.toISOString(),
    },
  };
}

/** تراجع عن حذف: يعيد التقييم كما كان. التوثيق يُعاد حسابه من الطلب، ولا يُقبل من المتصفح. */
export async function restoreReviewAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const m = await merchant();
  if (!m) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = z
    .object({
      id: z.string().uuid(),
      productId: z.string().uuid(),
      orderId: z.string().uuid().nullable(),
      customerName: z.string().trim().min(1).max(80),
      customerPhone: z.string().max(30).nullable(),
      rating: z.number().int().min(1).max(5),
      body: z.string().max(2000).nullable(),
      imageUrls: z.array(z.string().url()).max(6),
      isApproved: z.boolean(),
      createdAt: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
    })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "تعذر الاسترجاع" };
  const { s, db } = m;
  const r = parsed.data;
  const [[product], [order]] = await Promise.all([
    db.select({ id: products.id }).from(products).where(and(eq(products.id, r.productId), eq(products.storeId, s.storeId))).limit(1),
    r.orderId ? db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, r.orderId), eq(orders.storeId, s.storeId))).limit(1) : Promise.resolve([undefined]),
  ]);
  if (!product) return { ok: false, error: "المنتج لم يعد موجوداً" };
  await db.batch([
    db
      .insert(reviews)
      .values({
        id: r.id,
        storeId: s.storeId,
        productId: r.productId,
        orderId: order?.id ?? null,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        rating: r.rating,
        body: r.body,
        imageUrls: r.imageUrls,
        isApproved: r.isApproved,
        isVerified: Boolean(order),
        createdAt: new Date(r.createdAt),
      })
      .onConflictDoNothing(),
    syncRatings(db, s.storeId, [r.productId]),
  ]);
  await after(s);
  return { ok: true };
}
