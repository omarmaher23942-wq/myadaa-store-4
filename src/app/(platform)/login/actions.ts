"use server";

// دخول صاحب المتجر، واسترجاع كلمة المرور بكود الاسترجاع.
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants } from "@/db/schema";
import { allow, clientIp } from "@/lib/ratelimit";
import { sha256 } from "@/lib/ids";
import { getSetting, setSetting } from "@/server/settings";
import { getTheStore, setOwnerPassword, signInOwner, startOwnerSession } from "@/server/auth";

type Result = { ok: true } | { ok: false; error: string };

async function limited() {
  return !(await allow("login", clientIp(await headers())));
}

export async function ownerLoginAction(raw: unknown): Promise<Result> {
  if (await limited()) return { ok: false, error: "محاولات كثيرة. انتظر 15 دقيقة ثم أعد المحاولة." };
  const p = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "اكتب البريد وكلمة المرور" };
  return (await signInOwner(p.data.email, p.data.password)) ? { ok: true } : { ok: false, error: "البريد أو كلمة المرور غير صحيحة" };
}

export async function recoverAction(raw: unknown): Promise<Result> {
  if (await limited()) return { ok: false, error: "محاولات كثيرة. انتظر 15 دقيقة ثم أعد المحاولة." };
  const p = z
    .object({ code: z.string().trim().min(8).max(64), password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(200) })
    .safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "راجع البيانات" };
  const stored = await getSetting<string>("owner.recovery");
  const byRecoveryCode = Boolean(stored) && stored === (await sha256(p.data.code.toUpperCase()));
  // طوارئ: إن ضاع كود الاسترجاع، صاحب حساب Vercel وحده يستطيع وضع OWNER_RESET_CODE في متغيرات المشروع.
  const emergency = process.env.OWNER_RESET_CODE?.trim() ?? "";
  const byVercel = emergency.length >= 12 && p.data.code.trim() === emergency;
  if (!byRecoveryCode && !byVercel) return { ok: false, error: "كود الاسترجاع غير صحيح" };
  const store = await getTheStore();
  if (!store) return { ok: false, error: "المتجر غير مُعد بعد" };
  const [m] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.id, store.merchantId)).limit(1);
  if (!m) return { ok: false, error: "حساب صاحب المتجر غير موجود" };
  await setOwnerPassword(m.id, p.data.password);
  // كود الاسترجاع يُستخدم مرة واحدة؛ كود جديد يظهر في الإعدادات.
  await setSetting("owner.recovery", "");
  await startOwnerSession(m.id, store.id);
  return { ok: true };
}
