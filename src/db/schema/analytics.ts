import { pgTable, uuid, text, timestamp, jsonb, index, date, integer, primaryKey } from "drizzle-orm/pg-core";
import { stores } from "./stores";

/**
 * أحداث التحليلات الذاتية (بدون طرف ثالث، بدون كوكيز تتبع خارجية).
 * الأحداث: page_view, product_view, add_to_cart, begin_checkout, purchase, search
 * تُدفع من المتصفح إلى /api/track مع تجميع (batch) وتُعالج بشكل غير متزامن.
 */
export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  visitorId: text("visitor_id").notNull(),              // معرف عشوائي في localStorage
  sessionId: text("session_id").notNull(),
  name: text("name").notNull(),
  path: text("path"),
  productId: uuid("product_id"),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  device: text("device"),                               // mobile | desktop | tablet
  props: jsonb("props").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("analytics_store_created_idx").on(t.storeId, t.createdAt),
  index("analytics_store_name_idx").on(t.storeId, t.name),
]);

/** تجميع يومي (يُحدَّث دوريًا) لعرض الرسوم في الداشبورد بسرعة وبدون استعلامات ثقيلة */
export const analyticsDaily = pgTable("analytics_daily", {
  storeId: uuid("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  pageViews: integer("page_views").notNull().default(0),
  visitors: integer("visitors").notNull().default(0),
  productViews: integer("product_views").notNull().default(0),
  addToCarts: integer("add_to_carts").notNull().default(0),
  checkouts: integer("checkouts").notNull().default(0),
  orders: integer("orders").notNull().default(0),
  revenuePiasters: integer("revenue_piasters").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.storeId, t.day] })]);
