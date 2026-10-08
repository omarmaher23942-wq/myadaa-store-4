"use server";

// actions/auth.ts — Server Actions للمصادقة والملف الشخصي.
// التعديلات الجذرية:
//  - unstable_rethrow في كل catch يحوي redirect محتملاً.
//  - Zod للتحقق من مدخلات الملف الشخصي مع رسائل عربية.
//  - ActionResult موحّد للاستخدام مع useActionState.
//  - actions جديدة: updateMerchantAvatarUrlAction، removeAvatarAction،
//    applyGoogleAvatarAction.
//  - revalidatePath لجميع المسارات المتأثرة.
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { merchants } from "@/db/schema";
import { logout, getMerchantSession, setActiveStore } from "@/server/auth";

const ProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "الاسم المعروض يجب أن يكون حرفين على الأقل")
    .max(80, "الاسم طويل جداً — الحد الأقصى 80 حرفاً"),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^01[0125]\d{8}$/.test(v),
      "رقم الموبايل يجب أن يبدأ بـ 01 ويتكون من 11 رقماً"
    ),
  avatarUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^https?:\/\//.test(v),
      "رابط الصورة يجب أن يبدأ بـ http أو https"
    ),
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
    avatarUrl: String(formData.get("avatarUrl") ?? ""),
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

  const { displayName, phone, avatarUrl } = parsed.data;

  try {
    await db
      .update(merchants)
      .set({
        displayName,
        phone: phone || null,
        avatarUrl: avatarUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(merchants.id, session.merchantId));

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return {
      ok: false,
      error: "تعذر حفظ التغييرات. أعد المحاولة بعد لحظات.",
    };
  }
}

// تحديث رابط الأفاتار مباشرة بعد نجاح الرفع على UploadThing.
export async function updateMerchantAvatarUrlAction(
  avatarUrl: string
): Promise<ActionResult> {
  const session = await getMerchantSession();
  if (!session) return { ok: false, error: "انتهت جلستك" };

  const trimmed = avatarUrl.trim();
  if (!/^https?:\/\//.test(trimmed)) {
    return { ok: false, error: "رابط الصورة غير صالح" };
  }

  try {
    await db
      .update(merchants)
      .set({ avatarUrl: trimmed, updatedAt: new Date() })
      .where(eq(merchants.id, session.merchantId));

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    return { ok: false, error: "تعذر حفظ رابط الصورة" };
  }
}

export async function removeAvatarAction(): Promise<ActionResult> {
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
    return { ok: false, error: "تعذر حذف الصورة" };
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
