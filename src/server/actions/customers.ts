"use server";

// customers.ts — إجراءات التاجر على عميل: ملاحظات خاصة لا يراها العميل، وحظر يمنع إتمام أي طلب جديد برقمه
// (تفرضه صفحة الدفع: checkout.ts) مع إمكانية الرفع في أي وقت.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { customers } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";

type Result = { ok: true } | { ok: false; error: string };
const id = z.string().uuid();

async function update(customerId: string, set: Partial<typeof customers.$inferInsert>): Promise<Result> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  if (!id.safeParse(customerId).success) return { ok: false, error: "العميل غير موجود" };
  const db = await getTenantDb(s.storeId);
  const [row] = await db
    .update(customers)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(customers.id, customerId), eq(customers.storeId, s.storeId)))
    .returning({ id: customers.id });
  if (!row) return { ok: false, error: "العميل غير موجود" };
  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true };
}

export async function saveCustomerNotesAction(customerId: string, notes: unknown): Promise<Result> {
  const parsed = z.string().max(1000, "الملاحظات أطول من 1000 حرف").safeParse(notes);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ملاحظات غير صالحة" };
  return update(customerId, { notes: parsed.data.trim() || null });
}

export async function setCustomerBlockedAction(customerId: string, blocked: boolean): Promise<Result> {
  return update(customerId, { isBlocked: blocked === true });
}
