// /login — دخول صاحب المتجر إلى لوحة التحكم.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { STORE } from "@/store.config";
import { getMerchantSession } from "@/server/auth";
import { setupStatus } from "@/server/setup/status";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "دخول لوحة التحكم", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const status = await setupStatus();
  if (status.phase !== "done") redirect("/setup");
  if (await getMerchantSession()) redirect("/dashboard");
  const { redirect: to } = await searchParams;
  const safe = to && to.startsWith("/dashboard") ? to : "/dashboard";
  return <LoginForm storeName={STORE.name} redirectTo={safe} />;
}
