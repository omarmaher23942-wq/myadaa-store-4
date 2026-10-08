import type { Metadata } from "next";
import { CartView } from "@/components/storefront/CartView";

export const metadata: Metadata = { title: "سلة المشتريات", robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <div className="container-x max-w-5xl py-8">
      <h1 className="mb-6 text-3xl">سلة المشتريات</h1>
      <CartView />
    </div>
  );
}
