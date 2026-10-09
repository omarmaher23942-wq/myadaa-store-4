"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { and, eq, ne, sql, inArray, isNull } from "drizzle-orm";
import {
  getStoreBySubdomain,
  getBlueprint,
  isStorePubliclyVisible,
} from "@/lib/tenant";
import { allow, clientIp } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { db as platformDb } from "@/db/client";
import type { StoreBlueprint } from "@/blueprint/schema";
import { applyBundleDiscounts } from "@/server/pricing/bundles";
import { getTenantDb } from "@/db/tenant";
import {
  orders,
  orderItems,
  customers,
  products,
  productVariants,
  discounts,
  shippingZones,
  abandonedCarts,
  merchants,
} from "@/db/schema";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { governorateName, GOVERNORATES } from "@/lib/egypt";
import { formatEgp } from "@/lib/money";
import { ensureDeviceId, grantOrderAccess, hasOrderAccess } from "@/lib/order-access";
import {
  sendMerchantNewOrderEmail,
  sendCustomerOrderConfirmationEmail,
} from "@/lib/email";
import { storeUrl } from "@/lib/utils";
import { newOrderCode } from "@/lib/ids";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import {
  emitOrderCreated,
  emitCartAbandoned,
} from "@/server/realtime/emitters";
import { syncVariantTotals } from "@/server/inventory";
import { dbErrorInfo, PG_CHECK, PG_UNIQUE } from "@/lib/db-errors";

class CheckoutError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export type Quote =
  | {
      ok: true;
      subtotal: number;
      shipping: number | null;
      codFee: number;
      discount: number;
      total: number;
      discountError?: string;
      shippingError?: string;
    }
  | { ok: false; error: string };

const GENERIC_ERROR = "حدث خطأ أثناء تنفيذ طلبك، يرجى المحاولة ثانية";
const IDEM_TTL_S = 900;
const ORDER_CODE_ATTEMPTS = 3;

const GOV_CODES = GOVERNORATES.map((g) => g.code) as unknown as [
  string,
  ...string[]
];
const isGovernorate = (v: string) =>
  (GOV_CODES as readonly string[]).includes(v);

const cartItemsSchema = z
  .array(
    z.object({
      productId: z.string().uuid(),
      variantId: z.string().uuid().optional(),
      qty: z.number().int().min(1).max(50),
      bundleId: z.string().max(64).optional(),
    })
  )
  .min(1, "السلة فارغة")
  .max(50, "عدد المنتجات بالطلب كبير");

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسمك الثلاثي").max(60),
  phone: z.string().transform((v, ctx) => {
    const n = normalizeEgyptianPhone(v);
    if (!n)
      ctx.addIssue({
        code: "custom",
        message: "رقم موبايل مصري غير صحيح (01xxxxxxxxx)",
      });
    return n ?? "";
  }),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  altPhone: z
    .string()
    .optional()
    .transform((v) =>
      v ? normalizeEgyptianPhone(v) ?? undefined : undefined
    ),
  governorate: z.enum(GOV_CODES, { message: "اختر المحافظة" }),
  city: z.string().trim().max(60).optional(),
  address: z
    .string()
    .trim()
    .min(5, "اكتب اسم الشارع ورقم العمارة والشقة")
    .max(300),
  landmark: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
  paymentMethod: z.enum(["cod", "vodafone_cash", "instapay"]),
  discountCode: z.string().trim().toUpperCase().max(20).optional(),
  transferSenderPhone: z.string().max(30).optional(),
  transferScreenshotUrl: z
    .string()
    .max(500)
    .refine(isTrustedUploadUrl, "رابط صورة التحويل غير صالح")
    .optional(),
  items: cartItemsSchema,
  visitorId: z.string().max(64).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

type PricedLine = {
  p: typeof products.$inferSelect;
  v?: typeof productVariants.$inferSelect;
  qty: number;
  unit: number;
  total: number;
};
type Done = { code: string; total: number };

async function ip() {
  return clientIp(await headers());
}

async function priceLines(
  storeId: string,
  input: z.infer<typeof cartItemsSchema>,
  bp?: Pick<StoreBlueprint, "home">
): Promise<{ lines: PricedLine[]; subtotal: number }> {
  const db = await getTenantDb(storeId);
  const merged = new Map<
    string,
    { productId: string; variantId?: string; qty: number }
  >();
  for (const i of input) {
    const k = `${i.productId}:${i.variantId ?? ""}`;
    const ex = merged.get(k);
    merged.set(k, ex ? { ...ex, qty: ex.qty + i.qty } : { ...i });
  }
  const items = Array.from(merged.values());
  const ids = Array.from(new Set(items.map((i) => i.productId)));
  const vids = Array.from(
    new Set(items.map((i) => i.variantId).filter((x): x is string => !!x))
  );

  const [rows, vrows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(
        and(
          eq(products.storeId, storeId),
          inArray(products.id, ids),
          eq(products.status, "active"),
          isNull(products.deletedAt)
        )
      ),
    vids.length
      ? db
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.storeId, storeId),
              inArray(productVariants.id, vids)
            )
          )
      : Promise.resolve([] as (typeof productVariants.$inferSelect)[]),
  ]);

  const lines: PricedLine[] = items.map((i) => {
    const p = rows.find((r) => r.id === i.productId);
    if (!p) throw new CheckoutError("منتج في سلتك لم يعد متوفراً حالياً");
    const v = i.variantId
      ? vrows.find((x) => x.id === i.variantId && x.productId === p.id)
      : undefined;
    if (p.optionNames.length && !v)
      throw new CheckoutError(`يرجى تحديد خيارات المنتج ${p.name}`);
    if (v && !v.isAvailable)
      throw new CheckoutError(
        `المقاس أو اللون المطلوب من ${p.name} غير متوفر حالياً`
      );

    const currentStock = v ? v.stock : p.stock;
    if (p.trackStock && currentStock !== null && currentStock < i.qty) {
      throw new CheckoutError(
        currentStock <= 0
          ? `عذراً، نفدت كمية ${p.name}`
          : `الكمية المتاحة من ${p.name} هي ${currentStock} فقط`
      );
    }
    const unit = v?.pricePiasters ?? p.pricePiasters;
    return { p, v, qty: i.qty, unit, total: unit * i.qty };
  });

  if (bp) applyBundleDiscounts(lines, input, bp);
  return { lines, subtotal: lines.reduce((a, l) => a + l.total, 0) };
}


async function computeShipping(
  storeId: string,
  bp: {
    shipping: {
      freeOverPiasters: number | null;
      flatRatePiasters: number | null;
    };
  },
  governorate: string,
  subtotal: number,
  method: string
) {
  const db = await getTenantDb(storeId);
  if (!isGovernorate(governorate))
    throw new CheckoutError("اختر المحافظة أولاً", "governorate");

  // جدول المناطق هو المرجع دائماً: يحدد المحافظات المتاحة ورسوم الدفع عند الاستلام،
  // حتى حين يكون سعر الشحن موحداً أو مجانياً.
  const [z] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.governorate, governorate)))
    .limit(1);
  if (z && !z.isActive)
    throw new CheckoutError("الشحن غير متوفر لهذه المحافظة حالياً", "governorate");

  const codExtra = method === "cod" ? Math.max(0, z?.codExtraPiasters ?? 0) : 0;
  if (bp.shipping.freeOverPiasters !== null && subtotal >= bp.shipping.freeOverPiasters)
    return { fee: 0, codExtra };
  if (bp.shipping.flatRatePiasters !== null) return { fee: bp.shipping.flatRatePiasters, codExtra };
  if (!z) throw new CheckoutError("الشحن غير متوفر لهذه المحافظة حالياً", "governorate");
  return { fee: Math.max(0, z.feePiasters), codExtra };
}

async function validateDiscount(
  storeId: string,
  code: string,
  subtotal: number,
  phone: string
) {
  const db = await getTenantDb(storeId);
  const [d] = await db
    .select()
    .from(discounts)
    .where(
      and(
        eq(discounts.storeId, storeId),
        eq(discounts.code, code),
        eq(discounts.isActive, true)
      )
    )
    .limit(1);

  if (!d) return { error: "كود الخصم غير صحيح" } as const;
  const now = Date.now();
  if (d.startsAt && d.startsAt.getTime() > now)
    return { error: "كود الخصم لم يبدأ بعد" } as const;
  if (d.endsAt && d.endsAt.getTime() < now)
    return { error: "كود الخصم منتهي الصلاحية" } as const;
  if (d.maxUses && d.usedCount >= d.maxUses)
    return { error: "تم استهلاك كود الخصم بالكامل" } as const;
  if (d.minSubtotalPiasters && subtotal < d.minSubtotalPiasters) {
    return {
      error: `الحد الأدنى لتطبيق الخصم هو ${
        d.minSubtotalPiasters / 100
      } ج.م`,
    } as const;
  }
  if (d.perCustomerLimit && phone) {
    const [row] = await db
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, storeId),
          eq(orders.customerPhone, phone),
          eq(orders.discountCode, code),
          // الطلب الملغي لا يستهلك حق العميل في الكود.
          ne(orders.status, "cancelled")
        )
      );
    if ((row?.c ?? 0) >= d.perCustomerLimit)
      return { error: "استخدمت هذا الكود من قبل بالفعل" } as const;
  }

  const amount =
    d.type === "percentage"
      ? Math.min(
          subtotal,
          Math.round(
            (subtotal * Math.min(100, Math.max(0, d.value))) / 100
          )
        )
      : d.type === "fixed"
      ? Math.min(Math.max(0, d.value), subtotal)
      : 0;

  return { discount: d, amount, freeShipping: d.type === "free_shipping" } as const;
}

export async function placeOrderAction(
  subdomain: string,
  raw: unknown
): Promise<ActionResult<Done>> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]!.message,
      field: String(parsed.error.issues[0]!.path[0] ?? ""),
    };
  }
  const input = parsed.data;

  const store = await getStoreBySubdomain(subdomain);
  if (!store || !isStorePubliclyVisible(store))
    return { ok: false, error: "المتجر لا يستقبل طلبات حالياً" };
  const db = await getTenantDb(store.id);
  if (!store.acceptingOrders)
    return {
      ok: false,
      error: store.vacationMessage || "المتجر متوقف مؤقتاً عن استقبال الطلبات",
    };

  const idemKey = input.idempotencyKey
    ? `idem:order:${store.id}:${input.idempotencyKey}`
    : null;
  if (idemKey) {
    let claimed = true;
    try {
      claimed = !!(await redis.set(idemKey, "pending", {
        nx: true,
        ex: IDEM_TTL_S,
      }));
    } catch {
      claimed = true;
    }
    if (!claimed) {
      const prev = await redis.get<Done | string>(idemKey).catch(() => null);
      if (
        prev &&
        typeof prev === "object" &&
        typeof (prev as Done).code === "string"
      ) {
        await grantOrderAccess(store.id, (prev as Done).code);
        return { ok: true, data: prev as Done };
      }
      return {
        ok: false,
        error: "طلبك قيد التنفيذ، يرجى الانتظار ثواني",
      };
    }
  }

  const release = async () => {
    if (idemKey) await redis.del(idemKey).catch(() => {});
  };

  if (!(await allow("checkout", await ip()))) {
    await release();
    return { ok: false, error: "محاولات كثيرة في وقت قصير، انتظر دقائق" };
  }

  try {
    const bp = await getBlueprint(store.id);
    const pm = bp.payments;
    if (
      (input.paymentMethod === "cod" && !pm.cod.enabled) ||
      (input.paymentMethod === "vodafone_cash" &&
        !pm.vodafoneCash.enabled) ||
      (input.paymentMethod === "instapay" && !pm.instapay.enabled)
    ) {
      throw new CheckoutError("وسيلة الدفع المختارة غير متاحة", "paymentMethod");
    }

    const { lines, subtotal } = await priceLines(store.id, input.items, bp);

    const [existingCustomer] = await db
      .select({ isBlocked: customers.isBlocked })
      .from(customers)
      .where(
        and(
          eq(customers.storeId, store.id),
          eq(customers.phone, input.phone)
        )
      )
      .limit(1);

    if (existingCustomer?.isBlocked) {
      throw new CheckoutError(
        "عذراً، تعذر إتمام الطلب، تواصل مع المتجر مباشرة"
      );
    }

    let discountAmount = 0;
    let discountCode: string | undefined;
    let discountId: string | undefined;
    let freeShip = false;

    if (input.discountCode) {
      const r = await validateDiscount(
        store.id,
        input.discountCode,
        subtotal,
        input.phone
      );
      if ("error" in r)
        throw new CheckoutError(
          r.error ?? "كود الخصم غير صالح",
          "discountCode"
        );
      discountAmount = r.amount;
      discountCode = r.discount.code;
      discountId = r.discount.id;
      freeShip = r.freeShipping;
    }

    const ship = freeShip
      ? { fee: 0, codExtra: 0 }
      : await computeShipping(
          store.id,
          bp,
          input.governorate,
          subtotal,
          input.paymentMethod
        );
    const total =
      Math.max(0, subtotal - discountAmount) + ship.fee + ship.codExtra;
    const now = new Date();
    // الطلب يُحفظ بجهاز العميل: يجده في «طلباتي» على نفس الجهاز دون حساب ولا رقم طلب.
    const deviceId = await ensureDeviceId(store.id);
    const customerRef =
      sql`(select ${customers.id} from ${customers} where ${customers.storeId} = ${store.id} and ${customers.phone} = ${input.phone})`;

    let orderId = "";
    let code = "";

    for (let attempt = 1; ; attempt++) {
      orderId = crypto.randomUUID();
      code = newOrderCode();

      try {
        const variantProducts = [...new Set(lines.filter((l) => l.v && l.p.trackStock && l.v.stock !== null).map((l) => l.p.id))];
        await db.batch([
          db
            .insert(customers)
            .values({
              storeId: store.id,
              phone: input.phone,
              name: input.name,
              email: input.email || null,
              altPhone: input.altPhone,
              governorate: input.governorate,
              city: input.city,
              address: input.address,
              ordersCount: 1,
              totalSpentPiasters: total,
              lastOrderAt: now,
            })
            .onConflictDoUpdate({
              target: [customers.storeId, customers.phone],
              set: {
                name: input.name,
                email: input.email || null,
                address: input.address,
                governorate: input.governorate,
                city: input.city,
                altPhone: input.altPhone,
                ordersCount: sql`${customers.ordersCount} + 1`,
                totalSpentPiasters: sql`${customers.totalSpentPiasters} + ${total}`,
                lastOrderAt: now,
                updatedAt: now,
              },
            }),

          db.insert(orders).values({
            id: orderId,
            storeId: store.id,
            customerId: customerRef,
            code,
            customerName: input.name,
            customerPhone: input.phone,
            customerEmail: input.email || null,
            customerAltPhone: input.altPhone,
            governorate: input.governorate,
            city: input.city,
            address: input.address,
            landmark: input.landmark,
            customerNotes: input.notes,
            subtotalPiasters: subtotal,
            shippingPiasters: ship.fee,
            codFeePiasters: ship.codExtra,
            discountPiasters: discountAmount,
            discountCode,
            totalPiasters: total,
            paymentMethod: input.paymentMethod,
            paymentStatus:
              input.paymentMethod === "cod" ? "pending" : "under_review",
            transferSenderPhone: input.transferSenderPhone || null,
            transferScreenshotUrl: input.transferScreenshotUrl || null,
            statusHistory: [{ status: "new", at: now.toISOString() }],
            visitorId: deviceId,
            idempotencyKey: input.idempotencyKey,
          }),

          db.insert(orderItems).values(
            lines.map((l) => ({
              orderId,
              storeId: store.id,
              productId: l.p.id,
              variantId: l.v?.id,
              name: l.p.name,
              variantLabel: l.v?.optionValues.join(" / "),
              imageUrl: l.v?.imageUrl ?? l.p.images[0]?.url,
              unitPiasters: l.unit,
              quantity: l.qty,
              totalPiasters: l.total,
            }))
          ),

          ...lines.map((l) =>
            db
              .update(products)
              .set({
                orderCount: sql`${products.orderCount} + ${l.qty}`,
                ...(l.p.trackStock && !l.v && l.p.stock !== null
                  ? { stock: sql`${products.stock} - ${l.qty}` }
                  : {}),
              })
              .where(eq(products.id, l.p.id))
          ),

          ...lines
            .filter((l) => l.v && l.p.trackStock && l.v.stock !== null)
            .map((l) =>
              db
                .update(productVariants)
                .set({
                  stock: sql`${productVariants.stock} - ${l.qty}`,
                })
                .where(eq(productVariants.id, l.v!.id))
            ),

          // مخزون المنتج ذي التركيبات = مجموع تركيباته بعد الخصم (وإلا يبقى رقمه القديم ويخفي النفاد).
          ...(variantProducts.length ? [syncVariantTotals(db, store.id, variantProducts)] : []),

          ...(discountId
            ? [
                db
                  .update(discounts)
                  .set({ usedCount: sql`${discounts.usedCount} + 1` })
                  .where(eq(discounts.id, discountId)),
              ]
            : []),

          ...(input.visitorId
            ? [
                db
                  .update(abandonedCarts)
                  .set({ recoveredOrderId: orderId })
                  .where(
                    and(
                      eq(abandonedCarts.storeId, store.id),
                      eq(abandonedCarts.visitorId, input.visitorId)
                    )
                  ),
              ]
            : []),
        ]);
        break;
      } catch (e) {
        const info = dbErrorInfo(e);
        if (
          info.code === PG_UNIQUE &&
          info.constraint?.includes("orders_store_code_uq") &&
          attempt < ORDER_CODE_ATTEMPTS
        ) {
          continue;
        }
        if (info.code === PG_CHECK && info.constraint?.includes("stock")) {
          throw new CheckoutError(
            "عذراً، نفدت كمية أحد المنتجات قبل إتمام طلبك بقليل، يرجى مراجعة السلة"
          );
        }
        if (info.code === PG_CHECK && info.constraint?.includes("discounts")) {
          throw new CheckoutError(
            "تم استهلاك كود الخصم بالكامل أثناء إتمام الطلب",
            "discountCode"
          );
        }
        throw e;
      }
    }

    const done: Done = { code, total };
    if (idemKey)
      await redis.set(idemKey, done, { ex: IDEM_TTL_S }).catch(() => {});
    await grantOrderAccess(store.id, code);

    // إطلاق حدث Pusher للتاجر — fire-and-forget.
    void emitOrderCreated(store.id, {
      orderId,
      code,
      customerName: input.name,
      governorate: governorateName(input.governorate),
      totalPiasters: total,
      itemsCount: lines.reduce((a, l) => a + l.qty, 0),
      paymentMethod: input.paymentMethod,
      createdAt: now.toISOString(),
    });

    // إرسال الإشعارات البريدية خارج مسار استجابة الطلب.
    after(async () => {
      try {
        const [m] = await platformDb
          .select({ email: merchants.email })
          .from(merchants)
          .where(eq(merchants.id, store.merchantId))
          .limit(1);

        if (m?.email) {
          await sendMerchantNewOrderEmail({
            merchantEmail: m.email,
            storeName: bp.brand.name,
            storeSubdomain: store.subdomain,
            storeId: store.id,
            merchantId: store.merchantId,
            orderCode: code,
            customerName: input.name,
            totalAmount: formatEgp(total),
            governorate: governorateName(input.governorate),
            adminOrderUrl: storeUrl(store.subdomain, `/admin/orders`),
          });
        }
        if (input.email) {
          await sendCustomerOrderConfirmationEmail({
            customerEmail: input.email,
            customerName: input.name,
            storeName: bp.brand.name,
            storeSubdomain: store.subdomain,
            storeId: store.id,
            orderCode: code,
            totalAmount: formatEgp(total),
            trackingUrl: storeUrl(
              store.subdomain,
              `/track?code=${encodeURIComponent(code)}`
            ),
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[checkout] post-order emails failed:", err);
      }
    });

    return { ok: true, data: done };
  } catch (e) {
    await release();
    if (e instanceof CheckoutError)
      return { ok: false, error: e.message, field: e.field };
    // eslint-disable-next-line no-console
    console.error("[checkout] placeOrder failed:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function quoteAction(
  subdomain: string,
  raw: unknown
): Promise<Quote> {
  const parsed = z
    .object({
      items: cartItemsSchema,
      governorate: z.string().max(40).default(""),
      paymentMethod: z.enum(["cod", "vodafone_cash", "instapay"]),
      discountCode: z.string().trim().toUpperCase().max(20).optional(),
      phone: z.string().max(30).optional(),
    })
    .safeParse(raw);

  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
    };
  const input = parsed.data;
  if (!(await allow("quote", await ip())))
    return { ok: false, error: "محاولات كثيرة، انتظر لحظة" };

  try {
    const store = await getStoreBySubdomain(subdomain);
    if (!store) return { ok: false, error: "المتجر لا يستقبل طلبات حالياً" };
    const bp = await getBlueprint(store.id);
    const { subtotal } = await priceLines(store.id, input.items, bp);

    let discount = 0;
    let discountError: string | undefined;
    let freeShip = false;

    if (input.discountCode) {
      const r = await validateDiscount(
        store.id,
        input.discountCode,
        subtotal,
        normalizeEgyptianPhone(input.phone) ?? ""
      );
      if ("error" in r) discountError = r.error;
      else {
        discount = r.amount;
        freeShip = r.freeShipping;
      }
    }

    let shipping: number | null = null;
    let codFee = 0;
    let shippingError: string | undefined;

    if (isGovernorate(input.governorate)) {
      if (freeShip) shipping = 0;
      else {
        try {
          const s = await computeShipping(
            store.id,
            bp,
            input.governorate,
            subtotal,
            input.paymentMethod
          );
          shipping = s.fee;
          codFee = s.codExtra;
        } catch (e) {
          if (!(e instanceof CheckoutError)) throw e;
          shippingError = e.message;
        }
      }
    }

    return {
      ok: true,
      subtotal,
      shipping,
      codFee,
      discount,
      total: Math.max(0, subtotal - discount) + (shipping ?? 0) + codFee,
      discountError,
      shippingError,
    };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message };
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveAbandonedAction(
  subdomain: string,
  raw: unknown
): Promise<void> {
  try {
    const parsed = z
      .object({
        visitorId: z.string().min(8).max(64),
        phone: z.string().max(30),
        name: z.string().trim().max(60).optional(),
        items: cartItemsSchema,
      })
      .safeParse(raw);

    if (!parsed.success) return;
    const phone = normalizeEgyptianPhone(parsed.data.phone);
    if (!phone) return;
    if (!(await allow("abandoned", await ip()))) return;
    const store = await getStoreBySubdomain(subdomain);
    if (!store) return;
    const db = await getTenantDb(store.id);

    const { lines, subtotal } = await priceLines(
      store.id,
      parsed.data.items
    );
    const items = lines.map((l) => ({
      productId: l.p.id,
      variantId: l.v?.id,
      name: l.p.name,
      qty: l.qty,
      unitPiasters: l.unit,
      imageUrl: (l.v?.imageUrl ?? l.p.images[0]?.url) || undefined,
    }));

    await db
      .insert(abandonedCarts)
      .values({
        storeId: store.id,
        visitorId: parsed.data.visitorId,
        phone,
        name: parsed.data.name || undefined,
        items,
        subtotalPiasters: subtotal,
      })
      .onConflictDoUpdate({
        target: [abandonedCarts.storeId, abandonedCarts.visitorId],
        set: {
          phone,
          name: parsed.data.name || undefined,
          items,
          subtotalPiasters: subtotal,
          lastSeenAt: new Date(),
        },
      });

    // حدث Pusher: سلة متروكة.
    void emitCartAbandoned(store.id, {
      cartId: parsed.data.visitorId,
      customerName: parsed.data.name ?? "زائر",
      phone,
      subtotalPiasters: subtotal,
      itemsCount: items.reduce((a, i) => a + i.qty, 0),
      lastSeenAt: new Date().toISOString(),
    });
  } catch {
    /* silent */
  }
}

const transferProofSchema = z.object({
  code: z.string().trim().min(1, "كود الطلب مطلوب"),
  senderPhone: z.string().transform((v, ctx) => {
    const n = normalizeEgyptianPhone(v);
    if (!n)
      ctx.addIssue({
        code: "custom",
        message: "رقم موبايل مصري غير صحيح",
      });
    return n ?? "";
  }),
  screenshotUrl: z.string().max(500).refine(isTrustedUploadUrl, "رابط صورة التحويل غير صحيح"),
  accessPhone: z.string().optional(),
});

export async function submitTransferProofAction(
  subdomain: string,
  raw: unknown
): Promise<ActionResult<{ success: true }>> {
  const parsed = transferProofSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }
  const input = parsed.data;

  try {
    const store = await getStoreBySubdomain(subdomain);
    if (!store) return { ok: false, error: "المتجر غير موجود" };
      const db = await getTenantDb(store.id);

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.storeId, store.id), eq(orders.code, input.code))
      )
      .limit(1);

    if (!order) return { ok: false, error: "الطلب غير موجود" };

    const hasAccess = await hasOrderAccess(store.id, input.code, order.visitorId);
    const normalizedAccessPhone = input.accessPhone
      ? normalizeEgyptianPhone(input.accessPhone)
      : null;
    const phoneMatches =
      normalizedAccessPhone && order.customerPhone === normalizedAccessPhone;

    if (!hasAccess && !phoneMatches) {
      return { ok: false, error: "غير مصرح لك بتحديث هذا الطلب" };
    }

    const now = new Date();
    const history = Array.isArray(order.statusHistory)
      ? [...order.statusHistory]
      : [];
    history.push({ status: "proof_submitted", at: now.toISOString() });

    await db
      .update(orders)
      .set({
        transferSenderPhone: input.senderPhone,
        transferScreenshotUrl: input.screenshotUrl,
        paymentStatus: "under_review",
        statusHistory: history,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    return { ok: true, data: { success: true } };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[checkout] submitTransferProof failed:", e);
    return {
      ok: false,
      error: "تعذّر إرسال إثبات الدفع، يرجى المحاولة لاحقاً",
    };
  }
}