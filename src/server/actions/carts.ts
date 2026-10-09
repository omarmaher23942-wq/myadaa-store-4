"use server";

// carts.ts — متابعة السلات المتروكة من اللوحة: تسجيل أن التاجر راسل صاحب السلة على واتساب،
// فتخرج من «ما يحتاج انتباهك» وتظهر في القائمة بعلامة «تواصلت».
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { abandonedCarts } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";

const input = z.object({ cartId: z.string().uuid(), contacted: z.boolean() });

export async function markCartContactedAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "بيانات غير صالحة" };
  const db = await getTenantDb(s.storeId);
  const rows = await db
    .update(abandonedCarts)
    .set({ whatsappContactedAt: parsed.data.contacted ? new Date() : null })
    .where(and(eq(abandonedCarts.id, parsed.data.cartId), eq(abandonedCarts.storeId, s.storeId)))
    .returning({ id: abandonedCarts.id });
  if (!rows.length) return { ok: false, error: "السلة غير موجودة" };
  revalidatePath("/dashboard");
  return { ok: true };
}
