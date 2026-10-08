"use client";

// StoreProvider — سياق المتجر، يتضمن الآن لقطة اختيارية عن المشتري.
// تمرير customer من الـ layout (Server) يلغي حاجة Header/Checkout لأي fetch.
import { createContext, useContext } from "react";
import type { StoreBlueprint } from "@/blueprint/schema";
import type { StoreFact } from "@/blueprint/facts";
import { copyOf, type CopyKey } from "@/blueprint/copy";

export type StoreCustomer = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
} | null;

export type StoreCtx = {
  storeId: string;
  subdomain: string;
  brand: StoreBlueprint["brand"];
  conversion: StoreBlueprint["conversion"];
  channels: StoreBlueprint["channels"];
  payments: StoreBlueprint["payments"];
  shipping: StoreBlueprint["shipping"];
  acceptingOrders: boolean;
  vacationMessage: string | null;
  customer: StoreCustomer;
  copy: StoreBlueprint["copy"];
  design: StoreBlueprint["design"];
  cardStyle: StoreBlueprint["theme"]["productCardStyle"];
  facts: StoreFact[];
};

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({
  value,
  children,
}: {
  value: StoreCtx;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore خارج StoreProvider");
  return v;
}
/** نص واجهة بصوت المتجر: const t = useCopy(); t("addToCart"). */
export function useCopy() {
  const { copy } = useStore();
  return (key: CopyKey, vars?: Record<string, string | number>) => copyOf(copy, key, vars);
}
