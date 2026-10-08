// /dashboard/integrations — مفاتيحك الخاصة (الصور، الذكاء الاصطناعي، البريد) وأمان حسابك.
import type { Metadata } from "next";
import { requireMerchantStore } from "@/server/auth";
import { getSetting, maskKey, providerKey } from "@/server/settings";
import { IntegrationsCenter } from "./IntegrationsCenter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الربط والمفاتيح" };

export default async function IntegrationsPage() {
  await requireMerchantStore();
  const [ut, groq, resend, recovery] = await Promise.all([
    providerKey("uploadthing"),
    providerKey("groq"),
    providerKey("resend"),
    getSetting<string>("owner.recovery"),
  ]);
  return <IntegrationsCenter keys={{ uploadthing: maskKey(ut), groq: maskKey(groq), resend: maskKey(resend) }} hasRecovery={Boolean(recovery)} />;
}
