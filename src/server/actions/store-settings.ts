"use server";

// store-settings.ts — حفظ إعدادات المتجر التشغيلية (الدفع والتواصل ووضع الإجازة) من صفحة الإعدادات: نفس قواعد
// lib/store-settings.ts، وتُدمج في النسخة الحالية من الـ Blueprint (ما حُفظ من صفحات أخرى يبقى)، ثم حالة استقبال الطلبات.
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { storeBlueprints, stores } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { invalidateStoreCache } from "@/lib/tenant";
import { draftFrom, validateSettings, type SettingsDraft, type SettingsField } from "@/lib/store-settings";
import { saveBlueprintAction } from "./blueprint";

const str = (max: number) => z.string().max(max);
const input = z.object({
  cod: z.boolean(),
  vodafone: z.object({ enabled: z.boolean(), number: str(40), holder: str(200) }),
  instapay: z.object({ enabled: z.boolean(), target: str(120), holder: str(200) }),
  requireTransferProof: z.boolean(),
  transferInstructions: str(2000),
  whatsapp: str(40),
  phone: str(40),
  email: str(200),
  instagram: str(200),
  facebook: str(300),
  acceptingOrders: z.boolean(),
  vacationMessage: str(1000),
});

type Result = { ok: true; data: SettingsDraft } | { ok: false; error: string; errors?: Partial<Record<SettingsField, string>> };

export async function saveStoreSettingsAction(raw: unknown): Promise<Result> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "بيانات غير صالحة" };
  const v = validateSettings(parsed.data);
  if (!v.ok) return { ok: false, error: Object.values(v.errors)[0] ?? "راجع الحقول", errors: v.errors };

  try {
    const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
    const cur = row ? blueprintSchema.safeParse(row.data) : null;
    if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
    const bp = cur.data;
    const c = v.data;
    const next: StoreBlueprint = {
      ...bp,
      payments: {
        ...bp.payments,
        cod: { ...bp.payments.cod, enabled: c.payments.cod.enabled },
        vodafoneCash: { ...bp.payments.vodafoneCash, ...c.payments.vodafoneCash },
        instapay: { ...bp.payments.instapay, ...c.payments.instapay },
        requireTransferProof: c.payments.requireTransferProof,
        transferInstructions: c.payments.transferInstructions,
      },
      channels: { ...bp.channels, ...c.channels },
    };
    const changed = JSON.stringify({ p: next.payments, c: next.channels }) !== JSON.stringify({ p: bp.payments, c: bp.channels });
    if (changed) {
      const r = await saveBlueprintAction(next, "إعدادات الدفع والتواصل");
      if (!r.ok) return { ok: false, error: r.error };
    }
    if (c.ops.acceptingOrders !== s.store.acceptingOrders || c.ops.vacationMessage !== (s.store.vacationMessage ?? "")) {
      await db.update(stores).set({ acceptingOrders: c.ops.acceptingOrders, vacationMessage: c.ops.vacationMessage || null, updatedAt: new Date() }).where(eq(stores.id, s.storeId));
      await invalidateStoreCache(s.store);
    }
    revalidatePath("/dashboard", "layout");
    return { ok: true, data: draftFrom(next, c.ops) };
  } catch (e) {
    unstable_rethrow(e);
    console.error("[saveStoreSettingsAction]", e);
    return { ok: false, error: "تعذر الحفظ، حاول مرة أخرى" };
  }
}
