"use server";

// أدوات الذكاء الاصطناعي في لوحة التاجر. كلها تمر عبر ai/merchant (مفتاح التاجر بعد التفعيل).
import { z } from "zod";
import { getMerchantStoreOrNull } from "@/server/auth";
import { getBlueprintOrNull } from "@/lib/tenant";
import { MerchantAiError, merchantAiStatus, merchantObject, type MerchantAiStatus } from "@/ai/merchant";
import { log } from "@/lib/logger";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const copyInput = z.object({
  name: z.string().trim().min(2).max(160),
  shortDescription: z.string().max(160).optional(),
  description: z.string().max(4000).optional(),
  priceEgp: z.number().min(0).max(1_000_000).optional(),
  category: z.string().max(80).optional(),
  attributes: z.array(z.object({ label: z.string().max(60), value: z.string().max(120) })).max(20).optional(),
  instruction: z.string().max(300).optional(),
});

const copyOutput = z.object({
  shortDescription: z.string().describe("سطر بيعي واحد مقنع، أقل من 120 حرفاً"),
  description: z.string().describe("وصف كامل من 3 إلى 5 فقرات قصيرة أو نقاط، بلا مبالغة كاذبة"),
  seoTitle: z.string().describe("عنوان لمحركات البحث أقل من 60 حرفاً"),
  seoDescription: z.string().describe("وصف لمحركات البحث أقل من 155 حرفاً"),
  tags: z.array(z.string()).describe("من 3 إلى 6 كلمات مفتاحية بحث يكتبها العملاء فعلاً، بالعربية والفرانكو"),
});

export type ProductCopy = z.infer<typeof copyOutput>;

const TONE: Record<string, string> = {
  friendly_egyptian: "عامية مصرية ودودة وقريبة",
  premium_formal: "فصحى راقية توحي بالفخامة والثقة",
  playful: "عامية مرحة بحيوية",
  minimal: "جمل قصيرة جداً واضحة",
};

export async function aiProductCopyAction(raw: unknown): Promise<Result<ProductCopy>> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const input = copyInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "اكتب اسم المنتج أولاً" };
  const d = input.data;

  const bp = await getBlueprintOrNull(s.storeId);
  const tone = TONE[bp?.brand.voice ?? "friendly_egyptian"] ?? TONE.friendly_egyptian!;

  try {
    const data = await merchantObject({ id: s.storeId, status: s.store.status }, "product_copy", {
      system: [
        `أنت كاتب محتوى تجاري محترف لمتجر "${s.store.name}" في مصر.`,
        `اكتب بأسلوب: ${tone}. خاطب العميل مباشرة، وركّز على الفائدة والخامة والاستخدام.`,
        "ممنوع اختلاق مواصفات غير مذكورة (مقاسات، ضمان، أرقام). إن لم تُذكر فاكتب بشكل عام صادق.",
        "أعد JSON فقط بالحقول المطلوبة.",
      ].join("\n"),
      prompt: JSON.stringify({
        المنتج: d.name,
        السعر_بالجنيه: d.priceEgp,
        القسم: d.category,
        مواصفات: d.attributes,
        الوصف_الحالي: d.description || d.shortDescription,
        طلب_إضافي_من_التاجر: d.instruction,
      }),
      schema: copyOutput,
    });
    return {
      ok: true,
      data: {
        shortDescription: data.shortDescription.slice(0, 160),
        description: data.description.slice(0, 4000),
        seoTitle: data.seoTitle.slice(0, 70),
        seoDescription: data.seoDescription.slice(0, 160),
        tags: data.tags.map((t) => t.trim()).filter(Boolean).slice(0, 8),
      },
    };
  } catch (e) {
    if (e instanceof MerchantAiError) return { ok: false, error: e.message, code: e.code };
    return { ok: false, error: "تعذّر توليد المحتوى الآن" };
  }
}

export async function aiStatusAction(): Promise<MerchantAiStatus | null> {
  const s = await getMerchantStoreOrNull();
  if (!s) return null;
  return merchantAiStatus({ id: s.storeId, status: s.store.status });
}

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
  .min(1)
  .max(24);

/** مساعد اللوحة الذكي: يجيب من بيانات المتجر الحقيقية (قراءة فقط). */
export async function copilotAction(raw: unknown): Promise<Result<string>> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const history = historySchema.safeParse(raw);
  if (!history.success || history.data.at(-1)?.role !== "user") return { ok: false, error: "اكتب سؤالك أولاً" };
  try {
    const { runCopilot } = await import("@/ai/copilot");
    const text = await runCopilot({ id: s.storeId, name: s.store.name, status: s.store.status }, history.data);
    return { ok: true, data: text || "لم أجد إجابة مناسبة، جرّب صياغة أخرى." };
  } catch (e) {
    if (e instanceof MerchantAiError) {
      if (e.code === "failed") void log.warn("store", "copilot_failed", { storeId: s.storeId }, e.message, e.cause);
      return { ok: false, error: e.message, code: e.code };
    }
    void log.error("store", "copilot_crashed", { storeId: s.storeId }, "", e);
    return { ok: false, error: "تعذّر الرد الآن، أعد المحاولة." };
  }
}
