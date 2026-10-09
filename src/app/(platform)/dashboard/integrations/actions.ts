"use server";

// حفظ مفاتيحك الخاصة في قاعدتك بعد اختبارها حياً.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getMerchantStoreOrNull } from "@/server/auth";
import { deleteSetting, setSetting } from "@/server/settings";
import { checkGroq, checkResend, checkUploadThing } from "@/server/provider-check";
import { secureToken, sha256 } from "@/lib/ids";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const PROVIDERS = { uploadthing: checkUploadThing, groq: checkGroq, resend: checkResend } as const;

export async function saveKeyAction(raw: unknown): Promise<Result> {
  if (!(await getMerchantStoreOrNull())) return { ok: false, error: "انتهت جلستك" };
  const p = z.object({ provider: z.enum(["uploadthing", "groq", "resend"]), key: z.string().trim().min(8).max(4000) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "الصق المفتاح كاملاً" };
  const check = await PROVIDERS[p.data.provider](p.data.key);
  if (!check.ok) return { ok: false, error: check.error };
  await setSetting(`keys.${p.data.provider}`, check.value);
  revalidatePath("/dashboard/integrations");
  return { ok: true, data: null };
}

export async function removeKeyAction(provider: unknown): Promise<Result> {
  if (!(await getMerchantStoreOrNull())) return { ok: false, error: "انتهت جلستك" };
  // مفتاح الصور لا يُحذف: بدونه يتوقف رفع الصور. يُستبدل بمفتاح جديد فقط.
  const p = z.enum(["groq", "resend"]).safeParse(provider);
  if (!p.success) return { ok: false, error: "لا يمكن حذف هذا المفتاح، استبدله بمفتاح جديد" };
  await deleteSetting(`keys.${p.data}`);
  revalidatePath("/dashboard/integrations");
  return { ok: true, data: null };
}

export async function newRecoveryCodeAction(): Promise<Result<string>> {
  if (!(await getMerchantStoreOrNull())) return { ok: false, error: "انتهت جلستك" };
  const code = `${secureToken(6)}-${secureToken(6)}`.toUpperCase();
  await setSetting("owner.recovery", await sha256(code));
  return { ok: true, data: code };
}
