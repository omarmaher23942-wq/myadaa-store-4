"use client";

// PromoFromLink — رابط الخصم الذي يشاركه التاجر (?promo=CODE على أي صفحة في المتجر): يُحفظ الكود في المتصفح 7 أيام
// ويظهر للعميل أنه سيُطبَّق، وصفحة الدفع تملؤه تلقائياً (CheckoutForm). الكود يُتحقق منه عند الدفع كأي كود مكتوب.
import { useEffect } from "react";
import { toast } from "sonner";

const TTL = 7 * 86_400_000;
const keyOf = (subdomain: string) => `clp_promo_${subdomain}`;

export function readPromo(subdomain: string): string | null {
  try {
    const raw = localStorage.getItem(keyOf(subdomain));
    if (!raw) return null;
    const v = JSON.parse(raw) as { code?: string; at?: number };
    if (!v.code || !v.at || Date.now() - v.at > TTL) return null;
    return v.code;
  } catch {
    return null;
  }
}

export function clearPromo(subdomain: string) {
  try {
    localStorage.removeItem(keyOf(subdomain));
  } catch {
    /* التخزين غير متاح */
  }
}

export function PromoFromLink({ subdomain }: { subdomain: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("promo")?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{3,20}$/.test(code)) return;
    try {
      localStorage.setItem(keyOf(subdomain), JSON.stringify({ code, at: Date.now() }));
    } catch {
      /* التخزين غير متاح: يكتبه العميل بنفسه */
    }
    toast.success(`كود الخصم ${code} محفوظ، ويُطبَّق تلقائياً عند الدفع`);
    // يُزال من الرابط حتى لا يتكرر التنبيه ولا يُنسخ الرابط بالكود دون قصد.
    url.searchParams.delete("promo");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [subdomain]);
  return null;
}
