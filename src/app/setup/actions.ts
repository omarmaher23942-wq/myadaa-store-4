"use server";

// إجراءات صفحة الإعداد الأول. كلها تُرفض بعد اكتمال الإعداد، ولا يبدأ الاستلام إلا بكود صحيح من المنصة.
import { headers } from "next/headers";
import { z } from "zod";
import { allow, clientIp } from "@/lib/ratelimit";
import { getTheStore, startOwnerSession } from "@/server/auth";
import { ensureSchema, setupStatus, type SetupStatus } from "@/server/setup/status";
import { beginImport, cancelImport, runImportStep, ImportError, type ImportProgress } from "@/server/setup/importer";
import { checkGroq, checkUploadThing } from "@/server/provider-check";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function guard(): Promise<string | null> {
  const h = await headers();
  return (await allow("setup", clientIp(h))) ? null : "محاولات كثيرة، انتظر دقائق ثم أعد المحاولة.";
}

async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function statusAction(): Promise<SetupStatus> {
  return setupStatus();
}

export async function prepareDatabaseAction(): Promise<Result<SetupStatus>> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  const s = await setupStatus();
  if (s.phase === "done") return { ok: true, data: s };
  if (s.phase === "no_database") return { ok: false, error: "قاعدة البيانات غير مربوطة بعد." };
  try {
    await ensureSchema();
    return { ok: true, data: await setupStatus() };
  } catch {
    return { ok: false, error: "تعذّر تجهيز قاعدة البيانات. تأكد من ربط Neon ثم أعد النشر (Redeploy)." };
  }
}

const beginSchema = z
  .object({
    code: z.string().trim().regex(/^clp_[A-Za-z0-9_-]{30,}$/, "كود الاستلام غير مكتمل. انسخه كاملاً من لوحة Colapia."),
    email: z.string().trim().email("اكتب بريداً صحيحاً"),
    password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(200),
    confirm: z.string(),
    uploadthingToken: z.string().trim().min(20, "الصق مفتاح UploadThing"),
    groqKey: z.string().trim().min(10, "الصق مفتاح Groq (مجاني) ليعمل الذكاء الاصطناعي في لوحتك").max(4000),
  })
  .refine((v) => v.password === v.confirm, { message: "كلمتا المرور غير متطابقتين", path: ["confirm"] });

export async function beginImportAction(raw: unknown): Promise<Result<ImportProgress>> {
  const g = await guard();
  if (g) return { ok: false, error: g };
  const parsed = beginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "راجع البيانات" };
  const status = await setupStatus();
  if (status.phase !== "needs_import") return { ok: false, error: status.phase === "done" ? "متجرك مستلَم بالفعل." : "جهّز قاعدة البيانات أولاً." };

  // نفحص المفتاحين معاً (كل منهما اتصال حي بمزوّده) ونحفظ القيمة النظيفة لا النص الملصوق كما هو.
  const [ut, groq] = await Promise.all([checkUploadThing(parsed.data.uploadthingToken), checkGroq(parsed.data.groqKey)]);
  if (!ut.ok) return { ok: false, error: ut.error };
  if (!groq.ok) return { ok: false, error: groq.error };
  try {
    return {
      ok: true,
      data: await beginImport({ ...parsed.data, uploadthingToken: ut.value, groqKey: groq.value, siteUrl: await siteUrl() }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof ImportError ? e.message : "تعذّر الاتصال بالمنصة الآن، أعد المحاولة." };
  }
}

export async function importStepAction(): Promise<Result<{ progress: ImportProgress; recoveryCode?: string }>> {
  try {
    const r = await runImportStep();
    if (r.progress.phase === "done" && r.merchantId) {
      const store = await getTheStore();
      if (store) await startOwnerSession(r.merchantId, store.id);
    }
    return { ok: true, data: { progress: r.progress, recoveryCode: r.recoveryCode } };
  } catch (e) {
    return { ok: false, error: e instanceof ImportError ? e.message : "انقطع الاتصال لحظياً، نكمل تلقائياً." };
  }
}

export async function cancelImportAction(): Promise<Result<null>> {
  const status = await setupStatus();
  if (status.phase !== "needs_import") return { ok: false, error: "لا يوجد استلام جارٍ" };
  await cancelImport();
  return { ok: true, data: null };
}
