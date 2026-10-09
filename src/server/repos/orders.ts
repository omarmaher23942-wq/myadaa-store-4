import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders, orderItems } from "@/db/schema";
import { normalizeEgyptianPhone } from "@/lib/phone";

// قراءة الطلبات للعميل (صفحة التتبع وصفحة الطلب). إنشاء الطلب نفسه في server/actions/checkout.ts.
export async function getOrderByCodeAndPhone(storeId: string, code: string, phone: string) {
  const db = await getTenantDb(storeId);
  const n = normalizeEgyptianPhone(phone);
  if (!n) return null;
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.code, code.toUpperCase().trim()), eq(orders.customerPhone, n)))
    .limit(1);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  return { ...o, items };
}

export async function getOrderByCode(storeId: string, code: string) {
  const db = await getTenantDb(storeId);
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.code, code.toUpperCase().trim())))
    .limit(1);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  return { ...o, items };
}
/** طلبات هذا الجهاز في المتجر (الأحدث أولاً) لصفحة «طلباتي» بلا تسجيل دخول. */
export async function listDeviceOrders(storeId: string, deviceId: string, limit = 20) {
  const db = await getTenantDb(storeId);
  return db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      total: orders.totalPiasters,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      trackingNumber: orders.trackingNumber,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.visitorId, deviceId)))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
