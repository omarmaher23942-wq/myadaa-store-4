// copilot.ts — مساعد التاجر الذكي "نوفا": يجيب من بيانات متجره الحقيقية ويكتب له المحتوى.
//
// التصميم: نجمع "لوحة حقائق" مختصرة عن المتجر (مبيعات، منتجات، مخزون، طلبات، تقييمات، عملاء)
// باستعلامات قراءة فقط مقيّدة بالمتجر، ثم نمررها للنموذج في استدعاء واحد.
// هذا أثبت من استدعاء الأدوات (tool calling): نماذج Groq المفتوحة تفشل كثيراً في توليد
// استدعاءات أدوات صحيحة مع العربية، فكان المساعد يرد بالخطأ بدل الإجابة.
import "server-only";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { orders, orderItems, products, reviews, customers } from "@/db/schema";
import { merchantText } from "./merchant";

const egp = (p: number) => Math.round(p / 100);
const since = (days: number) => new Date(Date.now() - days * 86_400_000);

async function salesWindow(storeId: string, days: number) {
  const db = await getTenantDb(storeId);
  const rows = await db
    .select({
      status: orders.status,
      n: sql<number>`count(*)`.mapWith(Number),
      total: sql<number>`coalesce(sum(${orders.totalPiasters}),0)`.mapWith(Number),
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, since(days))))
    .groupBy(orders.status);
  const valid = rows.filter((r) => r.status !== "cancelled" && r.status !== "returned");
  const count = valid.reduce((a, r) => a + r.n, 0);
  const revenue = valid.reduce((a, r) => a + r.total, 0);
  return {
    orders: count,
    revenueEgp: egp(revenue),
    averageOrderEgp: count ? egp(revenue / count) : 0,
    byStatus: Object.fromEntries(rows.map((r) => [r.status, r.n])),
  };
}

/** لوحة حقائق المتجر: كل ما يحتاجه المساعد للإجابة، بأرقام فعلية. */
export async function storeFacts(storeId: string) {
  const db = await getTenantDb(storeId);
  const [today, week, month, top, lowStock, recent, pendingReviews, latestReviews, customerTotals, catalog] = await Promise.all([
    salesWindow(storeId, 1),
    salesWindow(storeId, 7),
    salesWindow(storeId, 30),
    db
      .select({
        name: orderItems.name,
        quantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
        revenueEgp: sql<number>`round(sum(${orderItems.unitPiasters} * ${orderItems.quantity}) / 100.0)`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orderItems.storeId, storeId), eq(orders.isTest, false), gte(orders.createdAt, since(30))))
      .groupBy(orderItems.name)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(8),
    db
      .select({ name: products.name, stock: products.stock })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.trackStock, true), isNull(products.deletedAt), lte(products.stock, 5)))
      .orderBy(products.stock)
      .limit(12),
    db
      .select({
        code: orders.code,
        customer: orders.customerName,
        governorate: orders.governorate,
        total: orders.totalPiasters,
        status: orders.status,
        at: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.isTest, false)))
      .orderBy(desc(orders.createdAt))
      .limit(10),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(reviews)
      .where(and(eq(reviews.storeId, storeId), eq(reviews.isApproved, false))),
    db
      .select({ customer: reviews.customerName, rating: reviews.rating, body: reviews.body })
      .from(reviews)
      .where(eq(reviews.storeId, storeId))
      .orderBy(desc(reviews.createdAt))
      .limit(6),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        last30: sql<number>`count(*) filter (where ${customers.createdAt} >= ${since(30)})`.mapWith(Number),
      })
      .from(customers)
      .where(eq(customers.storeId, storeId)),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${products.status} = 'active')`.mapWith(Number),
        avgPrice: sql<number>`coalesce(round(avg(${products.pricePiasters}) / 100.0), 0)`.mapWith(Number),
      })
      .from(products)
      .where(and(eq(products.storeId, storeId), isNull(products.deletedAt))),
  ]);
  return {
    sales: { today, last7Days: week, last30Days: month },
    topProductsLast30Days: top,
    lowStock,
    recentOrders: recent.map(({ total, at, ...r }) => ({ ...r, totalEgp: egp(total), at: at.toISOString().slice(0, 16) })),
    reviews: { pendingApproval: pendingReviews[0]?.n ?? 0, latest: latestReviews },
    customers: { total: customerTotals[0]?.total ?? 0, newLast30Days: customerTotals[0]?.last30 ?? 0 },
    catalog: { products: catalog[0]?.total ?? 0, active: catalog[0]?.active ?? 0, averagePriceEgp: catalog[0]?.avgPrice ?? 0 },
  };
}

export type CopilotMessage = { role: "user" | "assistant"; content: string };

export async function runCopilot(
  store: { id: string; name: string; status: string },
  history: CopilotMessage[]
): Promise<string> {
  const today = new Intl.DateTimeFormat("ar-EG", { dateStyle: "full", timeZone: "Africa/Cairo" }).format(new Date());
  const facts = await storeFacts(store.id);
  const turns = history.slice(-10);
  const transcript = turns
    .slice(0, -1)
    .map((m) => `${m.role === "user" ? "التاجر" : "نوفا"}: ${m.content}`)
    .join("\n");
  const question = turns.at(-1)?.content ?? "";

  return merchantText({ id: store.id, status: store.status }, "copilot", {
    system: [
      `أنت «نوفا»، مساعد ذكي لصاحب متجر «${store.name}» في مصر. اليوم ${today}.`,
      "تكلم بعامية مصرية مهذبة ومختصرة، وابدأ بالإجابة مباشرة دون مقدمات.",
      "عندك بيانات المتجر الفعلية بصيغة JSON بين الوسمين <facts>. أي رقم تذكره يجب أن يأتي منها حرفياً، ولا تخمّن رقماً أبداً.",
      "إن لم تكفِ البيانات للإجابة فقل ذلك بوضوح، واقترح أين يجد التاجر المعلومة في لوحة التحكم.",
      "المبالغ بالجنيه المصري. اختم عند المناسبة بخطوة عملية واحدة مفيدة.",
      "إن طُلب منك كتابة محتوى (منشور، رد على عميل، وصف، رسالة واتساب) فاكتبه كاملاً جاهزاً للنسخ.",
      "ليس لديك صلاحية تعديل أي شيء في المتجر؛ إن طُلب تعديل فدلّه على الصفحة المناسبة: المنتجات، الطلبات، الشحن، الخصومات، الإعدادات.",
      "لا تستخدم جداول Markdown؛ استخدم نقاطاً قصيرة.",
      `<facts>${JSON.stringify(facts)}</facts>`,
    ].join("\n"),
    prompt: [transcript ? `المحادثة السابقة:\n${transcript}\n` : "", `سؤال التاجر الآن: ${question}`].join("\n"),
    temperature: 0.4,
    maxTokens: 900,
  });
}
