// merchant.ts — الذكاء الاصطناعي في لوحة متجرك: يعمل بمفتاح Groq الخاص بك فقط، بلا حدود من أي منصة.
// أضف المفتاح من "الربط والمفاتيح" في لوحة التحكم (مجاني من console.groq.com).
import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { generateObject, generateText, type LanguageModel } from "ai";
import type { z } from "zod";
import { db } from "@/db/client";
import { aiCalls } from "@/db/schema";
import { providerKey } from "@/server/settings";

export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class MerchantAiError extends Error {
  constructor(
    message: string,
    readonly code: "needs_key" | "key_rejected" | "quota" | "failed"
  ) {
    super(message);
    this.name = "MerchantAiError";
  }
}

type Resolved = { model: LanguageModel; modelId: string; mode: "own" | "trial"; apiKey: string };

// إن رُفض نموذج (أُوقف، أو تعذّر عليه تنفيذ الطلب) نجرب التالي بنفس المفتاح.
const FALLBACK_MODELS = [GROQ_DEFAULT_MODEL, "openai/gpt-oss-120b", "llama-3.1-8b-instant"];

export type MerchantAiStatus =
  | { mode: "own" }
  | { mode: "trial"; remaining: number }
  | { mode: "needs_key" };


async function resolve(_store: { id: string; status: string }): Promise<Resolved> {
  const key = await providerKey("groq");
  if (!key) throw new MerchantAiError("أضف مفتاح Groq المجاني من صفحة «الربط والمفاتيح» لتفعيل أدوات الذكاء الاصطناعي.", "needs_key");
  return { model: createGroq({ apiKey: key })(GROQ_DEFAULT_MODEL), modelId: GROQ_DEFAULT_MODEL, mode: "own", apiKey: key };
}

export async function merchantAiStatus(_store: { id: string; status: string }): Promise<MerchantAiStatus> {
  return (await providerKey("groq")) ? { mode: "own" } : { mode: "needs_key" };
}

async function record(storeId: string, purpose: string, r: Resolved, t0: number, usage?: { inputTokens?: number; outputTokens?: number }, err?: unknown) {
  await db
    .insert(aiCalls)
    .values({
      purpose: `merchant:${purpose}`,
      provider: r.mode === "own" ? "groq:merchant" : "groq",
      model: r.modelId,
      storeId,
      tokensIn: usage?.inputTokens ?? 0,
      tokensOut: usage?.outputTokens ?? 0,
      latencyMs: Date.now() - t0,
      ok: !err,
      error: err ? String(err).slice(0, 500) : undefined,
    })
    .catch(() => {});
}

const isAuth = (msg: string) => /401|invalid api key|unauthor/i.test(msg);
const isRate = (msg: string) => /429|rate limit/i.test(msg);

/** ينفذ الطلب على النموذج الافتراضي ثم البدائل، ولا ينتقل لبديل عند خطأ مفتاح أو حد معدل. */
async function withFallback<T>(r: Resolved, run: (model: LanguageModel, modelId: string) => Promise<T>): Promise<{ out: T; modelId: string }> {
  let last: unknown;
  for (const modelId of FALLBACK_MODELS) {
    try {
      const model = modelId === r.modelId ? r.model : createGroq({ apiKey: r.apiKey })(modelId);
      return { out: await run(model, modelId), modelId };
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuth(msg) || isRate(msg)) break;
    }
  }
  throw last;
}

function translate(e: unknown, mode: Resolved["mode"]): MerchantAiError {
  const msg = e instanceof Error ? e.message : String(e);
  if (mode === "own" && isAuth(msg))
    return new MerchantAiError("مفتاح Groq الخاص بك توقف عن العمل. حدّثه من صفحة الربط والمفاتيح.", "key_rejected");
  if (isRate(msg)) return new MerchantAiError("الطلبات كثيرة الآن. انتظر دقيقة ثم أعد المحاولة.", "quota");
  const err = new MerchantAiError("تعذّر توليد المحتوى الآن، أعد المحاولة.", "failed");
  err.cause = e;
  return err;
}

export async function merchantObject<T extends z.ZodTypeAny>(
  store: { id: string; status: string },
  purpose: string,
  args: { system: string; prompt: string; schema: T; temperature?: number }
): Promise<z.infer<T>> {
  const r = await resolve(store);
  const t0 = Date.now();
  try {
    const { out, modelId } = await withFallback(r, (model) =>
      generateObject({
        model,
        system: args.system,
        prompt: args.prompt,
        schema: args.schema,
        temperature: args.temperature ?? 0.7,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(30_000),
      })
    );
    await record(store.id, purpose, { ...r, modelId }, t0, out.usage);
    return out.object as z.infer<T>;
  } catch (e) {
    await record(store.id, purpose, r, t0, undefined, e);
    throw translate(e, r.mode);
  }
}

export async function merchantText(
  store: { id: string; status: string },
  purpose: string,
  args: { system: string; prompt: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const r = await resolve(store);
  const t0 = Date.now();
  try {
    const { out, modelId } = await withFallback(r, async (model) => {
      const res = await generateText({
        model,
        system: args.system,
        prompt: args.prompt,
        temperature: args.temperature ?? 0.7,
        maxOutputTokens: args.maxTokens ?? 700,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(30_000),
      });
      if (!res.text.trim()) throw new Error("empty completion");
      return res;
    });
    await record(store.id, purpose, { ...r, modelId }, t0, out.usage);
    return out.text.trim();
  } catch (e) {
    await record(store.id, purpose, r, t0, undefined, e);
    throw translate(e, r.mode);
  }
}
