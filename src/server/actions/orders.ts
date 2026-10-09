"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyCustomerOfStatus } from "@/server/order-notify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import {
  orders,
  payments,
  products,
  orderItems,
  productVariants,
} from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import {
  emitOrderStatusChanged,
  emitPaymentConfirmed,
} from "@/server/realtime/emitters";

type Status = (typeof orders.$inferSelect)["status"];

const statusSchema = z.enum([
  "new",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
]);
const uuid = z.string().uuid();

async function own() {
  const s = await getMerchantStoreOrNull();
  if (!s) throw new Error("غير مصرح");
  return { ...s, db: await getTenantDb(s.storeId) };
}

/**
 * تغيير حالة الطلب مع تسجيل التاريخ؛ الإلغاء/الإرجاع يُعيد المخزون تلقائيًا.
 */
export async function setOrderStatusAction(
  orderId: string,
  status: Status,
  note?: string
) {
  const s = await own();
  const { db } = s;
  if (!uuid.safeParse(orderId).success || !statusSchema.safeParse(status).success) {
    throw new Error("بيانات غير صالحة");
  }
  const cleanNote = note === undefined ? undefined : String(note).slice(0, 500);
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId)))
    .limit(1);

  if (!o) throw new Error("طلب غير موجود");

  const restock =
    (status === "cancelled" || status === "returned") &&
    !["cancelled", "returned"].includes(o.status);
  const items = restock
    ? await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    : [];

  const now = new Date();
  const nextHistory = [
    ...o.statusHistory,
    { status, at: now.toISOString(), note: cleanNote },
  ];

  await db.batch([
    db
      .update(orders)
      .set({
        status,
        updatedAt: now,
        ...(status === "shipped" ? { shippedAt: now } : {}),
        ...(status === "delivered"
          ? {
              deliveredAt: now,
              paymentStatus:
                o.paymentMethod === "cod" ? "confirmed" : o.paymentStatus,
            }
          : {}),
        statusHistory: nextHistory,
      })
      .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId))),
    ...items
      .filter((i) => i.variantId || i.productId)
      .map((i) =>
        i.variantId
          ? db
              .update(productVariants)
              .set({
                stock: sql`coalesce(${productVariants.stock},0) + ${i.quantity}`,
              })
              .where(
                and(eq(productVariants.id, i.variantId), eq(productVariants.storeId, s.storeId))
              )
          : db
              .update(products)
              .set({
                stock: sql`coalesce(${products.stock},0) + ${i.quantity}`,
                orderCount: sql`greatest(${products.orderCount} - ${i.quantity},0)`,
              })
              .where(and(eq(products.id, i.productId!), eq(products.storeId, s.storeId)))
      ),
  ] as never);

  // حدث Pusher: تغيير حالة الطلب.
  void emitOrderStatusChanged(s.storeId, o.code, {
    orderId,
    code: o.code,
    fromStatus: o.status,
    toStatus: status,
    note: cleanNote,
    changedBy: `merchant:${s.merchantId}`,
    changedAt: now.toISOString(),
  });

  if (status !== o.status) {
    after(() =>
      notifyCustomerOfStatus({ id: s.storeId, subdomain: s.store.subdomain }, o, status).catch((e) =>
        console.error("[setOrderStatusAction] customer notify failed:", e)
      )
    );
  }

  revalidatePath("/dashboard/orders");
}

/**
 * تحديث حالة مجموعة طلبات دفعة واحدة.
 */
export async function bulkUpdateOrdersStatusAction(
  orderIds: string[],
  status: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await own();
    const ids = z.array(uuid).max(200).safeParse(orderIds);
    const st = statusSchema.safeParse(status);
    if (!ids.success || !st.success) return { ok: false, error: "بيانات غير صالحة" };
    if (!ids.data.length) return { ok: true };

    for (const id of ids.data) {
      await setOrderStatusAction(id, st.data);
    }

    revalidatePath("/dashboard/orders");
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "فشل تحديث الطلبات";
    return { ok: false, error: message };
  }
}

export async function setPaymentStatusAction(
  orderId: string,
  status: "confirmed" | "rejected",
  note?: string
) {
  const s = await own();
  const { db } = s;
  if (!uuid.safeParse(orderId).success || (status !== "confirmed" && status !== "rejected")) {
    throw new Error("بيانات غير صالحة");
  }
  const now = new Date();

  const [order] = await db
    .select({
      id: orders.id,
      code: orders.code,
      totalPiasters: orders.totalPiasters,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId)))
    .limit(1);

  if (!order) throw new Error("طلب غير موجود");

  await db.batch([
    db
      .update(orders)
      .set({ paymentStatus: status, updatedAt: now })
      .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId))),
    db
      .update(payments)
      .set({ status, reviewedAt: now, reviewNote: note?.slice(0, 500) })
      .where(
        and(
          eq(payments.orderId, orderId),
          eq(payments.storeId, s.storeId),
          eq(payments.status, "under_review")
        )
      ),
  ]);

  if (status === "confirmed") {
    void emitPaymentConfirmed(s.storeId, {
      paymentId: orderId,
      storeId: s.storeId,
      amountPiasters: order.totalPiasters,
      confirmedAt: now.toISOString(),
      confirmedBy: `merchant:${s.merchantId}`,
    });
  }

  revalidatePath("/dashboard/orders");
}

/** بيانات الشحن والملاحظات الداخلية فقط — لا يمكن تعديل أي عمود آخر من هنا. */
const orderMetaSchema = z.object({
  courierName: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(80).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
});

export async function updateOrderMetaAction(orderId: string, data: unknown) {
  const s = await own();
  const { db } = s;
  const parsed = orderMetaSchema.safeParse(data);
  if (!uuid.safeParse(orderId).success || !parsed.success) throw new Error("بيانات غير صالحة");
  await db
    .update(orders)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.storeId, s.storeId)));

  revalidatePath("/dashboard/orders");
}