"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEgp } from "@/lib/money";
import { useStore as useStorefront } from "@/components/storefront/StoreProvider";

type Mini = { id: string; slug: string; name: string; imageUrl?: string; price: number };

const MAX_ITEMS = 12;

function read(key: string): Mini[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Mini[]) : [];
  } catch {
    return [];
  }
}

/** "شاهدت مؤخراً" من localStorage فقط، بمفتاح خاص بكل متجر (لا تختلط منتجات متجرين). */
export function RecentlyViewed({ current }: { current: Mini }) {
  const { storeId } = useStorefront();
  const [items, setItems] = useState<Mini[]>([]);

  useEffect(() => {
    const key = `clp-recent:${storeId}`;
    const prev = read(key).filter((x) => x.id !== current.id);
    setItems(prev.slice(0, 8));
    try {
      localStorage.setItem(key, JSON.stringify([current, ...prev].slice(0, MAX_ITEMS)));
    } catch {
      // التخزين ممتلئ أو معطّل في وضع التصفح الخاص — الميزة اختيارية.
    }
    window.clpTrack?.("product_view", { productId: current.id });
  }, [current, storeId]);

  if (!items.length) return null;
  return (
    <section className="mt-16">
      <h2 className="mb-6 text-2xl">شاهدت مؤخرًا</h2>
      <div className="snap-row">
        {items.map((x) => (
          <Link key={x.id} href={`/p/${x.slug}`} className="w-36 shrink-0">
            <div className="aspect-square overflow-hidden rounded-xl bg-muted">
              {x.imageUrl && <img src={x.imageUrl} alt={x.name} className="size-full object-cover" />}
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-semibold">{x.name}</p>
            <p className="text-xs text-muted-foreground">{formatEgp(x.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
