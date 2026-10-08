// /setup — الإعداد الأول لمتجرك على حساباتك: قاعدة البيانات، ثم استلام متجرك من Colapia.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { STORE } from "@/store.config";
import { setupStatus } from "@/server/setup/status";
import { currentProgress } from "@/server/setup/importer";
import { SetupWizard } from "./SetupWizard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata: Metadata = { title: "إعداد متجرك", robots: { index: false } };

export default async function SetupPage() {
  const status = await setupStatus();
  if (status.phase === "done") redirect("/dashboard");
  const progress = status.phase === "needs_import" && status.importing ? await currentProgress().catch(() => null) : null;
  return <SetupWizard storeName={STORE.name} platform={STORE.importFrom} initial={status} initialProgress={progress} />;
}
