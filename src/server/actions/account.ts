"use server";

// account.ts — حسابك في نسخة متجرك: صورتك الشخصية، وتغيير كلمة المرور. (نفس واجهة نسخة المنصة؛ الحذف غير متاح هنا:
// الموقع موقعك على حساباتك، تحذفه من Vercel متى أردت.)
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { merchants } from "@/db/schema";
import { getMerchantSession, setOwnerPassword, startOwnerSession } from "@/server/auth";
import { verifyPassword } from "@/server/passwords";
import { isHostedImage } from "@/lib/media-hosts";

type Result = { ok: true } | { ok: false; error: string };

export async function setAvatarAction(url: string | null): Promise<Result> {
  const s = await getMerchantSession();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const v = url === null ? null : String(url).trim();
  if (v !== null && (!/^https:\/\//.test(v) || !isHostedImage(v))) return { ok: false, error: "ارفع الصورة من الزر نفسه" };
  try {
    await db.update(merchants).set({ avatarUrl: v, updatedAt: new Date() }).where(eq(merchants.id, s.merchantId));
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "تعذر حفظ الصورة، حاول مرة أخرى" };
  }
}

const passwordInput = z.object({
  current: z.string().min(1, "اكتب كلمة المرور الحالية").max(200),
  next: z.string().min(8, "كلمة المرور الجديدة 8 أحرف على الأقل").max(200),
});

/** تغيير كلمة المرور: تُطلب الحالية، وتنتهي كل الجلسات الأخرى (أجهزة أخرى)، وتبقى أنت داخلاً على هذا الجهاز. */
export async function changePasswordAction(raw: unknown): Promise<Result> {
  const s = await getMerchantSession();
  if (!s?.store) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const p = passwordInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "بيانات غير صالحة" };
  if (p.data.current === p.data.next) return { ok: false, error: "اختر كلمة مرور مختلفة عن الحالية" };
  const [m] = await db.select({ hash: merchants.passwordHash }).from(merchants).where(eq(merchants.id, s.merchantId)).limit(1);
  if (!m?.hash || !(await verifyPassword(p.data.current, m.hash))) return { ok: false, error: "كلمة المرور الحالية غير صحيحة" };
  try {
    await setOwnerPassword(s.merchantId, p.data.next);
    await startOwnerSession(s.merchantId, s.store.id);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "تعذر تغيير كلمة المرور، حاول مرة أخرى" };
  }
}

export async function deleteStoreAction(_raw: unknown): Promise<Result> {
  return { ok: false, error: "موقعك على حساباتك: تحذفه من Vercel متى أردت" };
}
