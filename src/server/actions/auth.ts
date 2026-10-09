"use server";

// actions/auth.ts — Server Actions للمصادقة والملف الشخصي.
// التعديلات الجذرية:
//  - unstable_rethrow في كل catch يحوي redirect محتملاً.
//  - Zod للتحقق من مدخلات الملف الشخصي مع رسائل عربية.
//  - ActionResult موحّد للاستخدام مع useActionState.
//  - applyGoogleAvatarAction (المنصة). رفع الصورة وحذفها: setAvatarAction في actions/account.ts.
//  - revalidatePath لجميع المسارات المتأثرة.
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { merchants } from "@/db/schema";
import { logout, getMerchantSession, setActiveStore } from "@/server/auth";
import { normalizeEgyptianPhone } from "@/lib/phone";

const ProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "الاسم حرفان على الأقل")
    .max(80, "الاسم 80 حرفاً على الأكثر"),
  phone: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeEgyptianPhone(v) : ""))
    .refine((v) => v !== null, "رقم موبايل مصري من 11 رقماً يبدأ بـ 01"),
});

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; fieldErrors?: undefined; error?: undefined }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; data?: undefined };

export async function updateMerchantProfileAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await getMerchantSession();
  if (!session) {
    return { ok: false, error: "انتهت جلستك — سجّل الدخول من جديد." };
  }

  const raw = {
    displayName: String(formData.get("displayName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };

  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return {
      ok: false,
      error: "بعض الحقول تحتاج مراجعة",
      fieldErrors,
    };
  }

  const { displayName, phone } = parsed.data;

  try {
    await db
      .update(merchants)
      .set({
        displayName,
        phone: phone || null,
        updatedAt: new Date(),
      })
      .where(eq(merchants.id, session.merchantId));

    revalidatePath("/dashboard", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return {
      ok: false,
      error: "تعذر حفظ التغييرات. أعد المحاولة بعد لحظات.",
    };
  }
}

// عند ضغط "استخدام صورة Google" نُصفّر الأفاتار ليعود OAuth القادم بجلبها.
export async function applyGoogleAvatarAction(): Promise<ActionResult> {
  const session = await getMerchantSession();
  if (!session) return { ok: false, error: "انتهت جلستك" };

  try {
    await db
      .update(merchants)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(merchants.id, session.merchantId));

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, error: "تعذر تجهيز استخدام صورة Google" };
  }
}

export async function merchantLogoutAction(): Promise<void> {
  await logout("merchant");
  redirect("/");
}

/** تبديل المتجر النشط — يُرفض أي متجر لا يملكه التاجر. */
export async function switchStoreAction(storeId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(storeId);
  if (!parsed.success) return { ok: false, error: "متجر غير صالح" };
  const ok = await setActiveStore(parsed.data);
  if (!ok) return { ok: false, error: "لا تملك صلاحية على هذا المتجر" };
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
