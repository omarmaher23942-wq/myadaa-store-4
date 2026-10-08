import { pgEnum } from "drizzle-orm/pg-core";

/** دورة حياة المتجر على المنصة */
export const storeStatusEnum = pgEnum("store_status", [
  "intake",          // (قديم) الوكيل كان يجمع البيانات من الشات
  "pending_review",  // الاستمارة وصلت وبانتظار مراجعة الأونر (مؤقت 12 ساعة)
  "building",        // قيد التأليف
  "review",          // (قديم) مبني وينتظر مراجعة قبل التسليم
  "trial",           // مُسلَّم للعميل في فترة التجربة (وفيه doomAt إذا رُفض الدفع)
  "frozen",          // انتهت التجربة بدون دفع (فترة سماح قبل الحذف)
  "active",          // مدفوع ومملوك للتاجر
  "suspended",       // موقوف من المنصة
  "deleted",         // محذوف منطقيًا
]);

/** حالة الطلب في متجر التاجر */
export const orderStatusEnum = pgEnum("order_status", [
  "new", "confirmed", "preparing", "shipped", "delivered", "returned", "cancelled",
]);

/** طرق الدفع المدعومة للعميل النهائي */
export const paymentMethodEnum = pgEnum("payment_method", ["cod", "vodafone_cash", "instapay"]);

/** حالة الدفع (للعميل النهائي وللتاجر تجاه المنصة) */
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending", "under_review", "confirmed", "rejected", "refunded",
]);

/** نوع الخصم */
export const discountTypeEnum = pgEnum("discount_type", ["percentage", "fixed", "free_shipping"]);

/** أدوار مستخدمي المنصة (أنت وفريقك) */
export const platformRoleEnum = pgEnum("platform_role", ["owner", "admin", "reviewer"]);

/** حالة المنتج */
export const productStatusEnum = pgEnum("product_status", ["active", "draft", "hidden", "archived"]);