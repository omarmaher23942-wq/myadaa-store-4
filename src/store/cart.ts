"use client";

// cart.ts — سلة الشراء المعزولة لكل متجر.
//
// السبب الجذري لإصلاح تسرب السلة (CRITICAL):
// النسخة السابقة كانت تخزّن في localStorage بمفتاح ثابت "clp-cart" بدون storeId،
// فيرى المشتري منتجات من متجر آخر. الحل: مخزن zustand منفصل لكل storeId بمفتاح
// `clp-cart:{storeId}`، ويُقرأ storeId من StoreProvider.
//
// المعمارية:
//  - createCartStore(storeId) → مصنع يبني مخزناً مستقلاً بـ persist key خاص.
//  - cache Map لتفادي إعادة البناء عند كل رندر.
//  - useCart(selector) → يقرأ storeId من StoreProvider ويوجّه للـ store الصحيح.
//  - getCartStore(storeId) → للوصول من خارج hooks.
import { create, useStore as useZustandStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useStore as useStorefront } from "@/components/storefront/StoreProvider";

export type CartItem = {
  productId: string;
  variantId?: string;
  slug: string;
  name: string;
  imageUrl?: string;
  unitPiasters: number;
  qty: number;
  variantLabel?: string;
  maxQty?: number | null;
  /** معرّف قسم الطقم في الـ Blueprint: الخادم يطبّق خصم الطقم على الأطقم المكتملة فقط. */
  bundleId?: string;
};

export type CustomerSnapshot = {
  name?: string;
  phone?: string;
  email?: string;
  governorate?: string;
  city?: string;
  address?: string;
  landmark?: string;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  customer: CustomerSnapshot | null;

  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  rememberCustomer: (snap: CustomerSnapshot) => void;
  forgetCustomer: () => void;

  subtotal: () => number;
  count: () => number;
};

export const MAX_QTY_PER_LINE = 50;
const MAX_LINES = 50;

export const itemKey = (i: { productId: string; variantId?: string; bundleId?: string }) =>
  `${i.productId}:${i.variantId ?? ""}${i.bundleId ? `:${i.bundleId}` : ""}`;

export const lineCap = (i: { maxQty?: number | null }) =>
  typeof i.maxQty === "number" && Number.isFinite(i.maxQty)
    ? Math.max(0, Math.min(Math.floor(i.maxQty), MAX_QTY_PER_LINE))
    : MAX_QTY_PER_LINE;

const clampQty = (qty: unknown, cap: number) => {
  const q = Math.floor(Number(qty));
  return Number.isFinite(q) ? Math.max(0, Math.min(q, cap)) : 0;
};

function sanitizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, CartItem>();
  for (const x of raw as Partial<CartItem>[]) {
    if (
      !x ||
      typeof x.productId !== "string" ||
      typeof x.slug !== "string" ||
      typeof x.name !== "string"
    )
      continue;
    const unit = Number(x.unitPiasters);
    if (!Number.isFinite(unit) || unit < 0) continue;
    const item = { ...x, unitPiasters: Math.round(unit) } as CartItem;
    const qty = clampQty(x.qty, lineCap(item));
    if (qty > 0) out.set(itemKey(item), { ...item, qty });
  }
  return Array.from(out.values()).slice(0, MAX_LINES);
}

function sanitizeCustomer(raw: unknown): CustomerSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pick = (k: string, max = 300) =>
    typeof r[k] === "string" ? (r[k] as string).slice(0, max) : undefined;
  const snap: CustomerSnapshot = {
    name: pick("name", 80),
    phone: pick("phone", 20),
    email: pick("email", 120),
    governorate: pick("governorate", 40),
    city: pick("city", 60),
    address: pick("address", 300),
    landmark: pick("landmark", 120),
  };
  return Object.values(snap).some(Boolean) ? snap : null;
}

function createCartStore(storeId: string) {
  return create<CartState>()(
    persist(
      (set, get) => ({
        items: [],
        isOpen: false,
        customer: null,

        add: (item, qty = 1) =>
          set((s) => {
            const cap = lineCap(item);
            if (cap <= 0) return s;
            const k = itemKey(item);
            const ex = s.items.find((i) => itemKey(i) === k);
            if (ex) {
              const next = clampQty(ex.qty + clampQty(qty, cap), cap);
              return {
                items: s.items.map((i) =>
                  itemKey(i) === k ? { ...i, ...item, qty: next } : i
                ),
                isOpen: true,
              };
            }
            if (s.items.length >= MAX_LINES) return { isOpen: true };
            const first = clampQty(qty, cap) || 1;
            return {
              items: [...s.items, { ...item, qty: first }],
              isOpen: true,
            };
          }),

        remove: (k) =>
          set((s) => ({ items: s.items.filter((i) => itemKey(i) !== k) })),

        setQty: (k, qty) =>
          set((s) => ({
            items: s.items
              .map((i) =>
                itemKey(i) === k
                  ? { ...i, qty: clampQty(qty, lineCap(i)) }
                  : i
              )
              .filter((i) => i.qty > 0),
          })),

        clear: () => set({ items: [] }),
        open: () => set({ isOpen: true }),
        close: () => set({ isOpen: false }),

        rememberCustomer: (snap) => set({ customer: sanitizeCustomer(snap) }),
        forgetCustomer: () => set({ customer: null }),

        subtotal: () =>
          get().items.reduce((a, i) => a + i.unitPiasters * i.qty, 0),
        count: () => get().items.reduce((a, i) => a + i.qty, 0),
      }),
      {
        // المفتاح يحمل storeId — كل متجر سلة منفصلة تماماً.
        name: `clp-cart:${storeId}`,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ items: s.items, customer: s.customer }),
        merge: (persisted, current) => ({
          ...current,
          items: sanitizeItems(
            (persisted as { items?: unknown } | null)?.items
          ),
          customer: sanitizeCustomer(
            (persisted as { customer?: unknown } | null)?.customer
          ),
        }),
      }
    )
  );
}

type CartStore = ReturnType<typeof createCartStore>;
const cartCache = new Map<string, CartStore>();

export function getCartStore(storeId: string): CartStore {
  if (!storeId) {
    throw new Error("getCartStore requires a storeId");
  }
  let s = cartCache.get(storeId);
  if (!s) {
    s = createCartStore(storeId);
    cartCache.set(storeId, s);
  }
  return s;
}

// useCart — hook يُستدعى من أي مكان داخل StoreProvider.
// يقرأ storeId من الـ Context ويوجّه للـ store المعزول الصحيح.
export function useCart<T>(selector: (s: CartState) => T): T {
  const { storeId } = useStorefront();
  const store = getCartStore(storeId);
  return useZustandStore(store, selector);
}

// واجهة imperative لمن يحتاج getState / setState مباشرة.
export function useCartApi(): CartStore {
  const { storeId } = useStorefront();
  return getCartStore(storeId);
}