"use client";
import { toast } from "sonner";
import { useCart, type CartItem } from "@/store/cart";
import { formatEgp } from "@/lib/money";
export function BundleAdd({ bundleId, items, total, discounted, percent }: { bundleId: string; items: Omit<CartItem, "qty">[]; total: number; discounted: number; percent: number }) {
  const add = useCart((s) => s.add);
  return <div className="text-center md:text-start"><p className="text-sm text-muted-foreground line-through">{formatEgp(total)}</p><p className="text-3xl font-black text-primary">{formatEgp(discounted)}</p><p className="text-xs font-bold text-success">وفّر {percent}% مع الطقم الكامل</p>
    <button onClick={() => { items.forEach((i) => add({ ...i, bundleId, variantLabel: `ضمن طقم (خصم ${percent}%)` })); toast.success("تمت إضافة الطقم كامل للسلة"); }} className="btn-brand btn-brand-lg mt-3 w-full">أضف الطقم كامل</button></div>;
}
