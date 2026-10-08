// Bundle — عرض طقم مجمّع بخصم، مع زر إضافة جماعية عبر BundleAdd.
import Image from "next/image";
import { PackagePlus, Percent } from "lucide-react";
import { SectionShell } from "@/components/storefront/SectionShell";
import { Price } from "@/components/storefront/Price";
import { BundleAdd } from "@/components/storefront/BundleAdd";
import { getProductBySlug } from "@/server/repos/catalog";
import type { Ctx, Of } from "./_shared";
import type * as S from "@/blueprint/schema";

type BundleProduct = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

type BundleSectionData = {
  productSlugs?: string[];
  bundleDiscountPercent?: number;
  title?: string;
  text?: string;
};

export async function Bundle({
  s,
  ctx,
}: {
  s: Of<typeof S.bundleSection> & BundleSectionData;
  ctx: Ctx;
}) {
  const slugs = s.productSlugs ?? [];
  if (slugs.length < 2) return null;

  const prods: BundleProduct[] = (
    await Promise.all(slugs.map((sl: string) => getProductBySlug(ctx.storeId, sl)))
  ).filter((p): p is BundleProduct => Boolean(p));

  if (prods.length < 2) return null;

  const total = prods.reduce((sum: number, p: BundleProduct) => sum + p.pricePiasters, 0);
  const percent = s.bundleDiscountPercent ?? 10;
  const discounted = Math.round(total * (1 - percent / 100));

  return (
    <SectionShell s={s as never}>
      <div
        className="space-y-6 rounded-3xl border p-6 shadow-md sm:p-8"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          color: "var(--card-foreground)",
        }}
        dir="rtl"
      >
        <header
          className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <span
              className="block text-[11px] font-black uppercase tracking-wider"
              style={{ color: "var(--primary)" }}
            >
              عرض التوفير
            </span>
            <h3 className="mt-1 font-black font-heading text-xl sm:text-2xl">
              {s.title}
            </h3>
            {s.text ? (
              <p className="mt-1 text-xs opacity-80">{s.text}</p>
            ) : null}
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-black"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            <Percent className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            خصم {percent}% على الطقم
          </span>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prods.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border p-3"
              style={{
                background: "color-mix(in srgb, var(--background) 60%, transparent)",
                borderColor: "var(--border)",
              }}
            >
              {p.images[0]?.url ? (
                <div
                  className="relative size-16 shrink-0 overflow-hidden rounded-xl border"
                  style={{ background: "var(--muted)", borderColor: "var(--border)" }}
                >
                  <Image
                    src={p.images[0].url}
                    alt={p.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <span
                  className="grid size-16 shrink-0 place-items-center rounded-xl border"
                  style={{ background: "var(--muted)", borderColor: "var(--border)" }}
                >
                  <PackagePlus
                    className="size-5 opacity-40"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{p.name}</p>
                <Price price={p.pricePiasters} size="sm" />
              </div>
            </li>
          ))}
        </ul>

        <footer
          className="flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="text-center sm:text-start">
            <span className="text-xs opacity-70">السعر الإجمالي:</span>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span
                className="font-mono text-2xl font-black"
                style={{ color: "var(--primary)" }}
              >
                {discounted / 100} ج.م
              </span>
              <span className="font-mono text-xs line-through opacity-60">
                {total / 100} ج.م
              </span>
            </div>
          </div>

          <BundleAdd
            bundleId={s.id}
            items={prods.map((p) => ({
              productId: p.id,
              slug: p.slug,
              name: p.name,
              imageUrl: p.images[0]?.url,
              unitPiasters: Math.round(p.pricePiasters * (1 - percent / 100)),
            }))}
            total={total}
            discounted={discounted}
            percent={percent}
          />
        </footer>
      </div>
    </SectionShell>
  );
}