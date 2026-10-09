"use client";

// ColorImages — «صورة كل لون»: يختار التاجر من صور المنتج الصورة التي تمثل كل لون، فحين يختار العميل اللون في المتجر
// ينتقل معرض الصور إليها، وتظهر نفسها في السلة والطلب. تُحفظ على كل تركيبات اللون (imageUrl).
import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorFromName, isColorOption } from "@/lib/color-names";
import { isHostedImage } from "@/lib/media-hosts";
import type { Variant } from "../VariantMatrix";
import type { ProductImage } from "./ProductImages";

export function ColorImages({
  optionNames,
  variants,
  images,
  onChange,
}: {
  optionNames: string[];
  variants: Variant[];
  images: ProductImage[];
  onChange: (variants: Variant[]) => void;
}) {
  const ci = optionNames.findIndex((n) => isColorOption(n));
  const usable = images.filter((im) => isHostedImage(im.url));
  if (ci < 0 || usable.length < 2 || !variants.length) return null;
  const colors = [...new Set(variants.map((v) => v.optionValues[ci]).filter((x): x is string => Boolean(x)))];
  const imageOf = (c: string) => variants.find((v) => v.optionValues[ci] === c && v.imageUrl)?.imageUrl ?? null;
  const set = (c: string, url: string | null) => onChange(variants.map((v) => (v.optionValues[ci] === c ? { ...v, imageUrl: url } : v)));

  return (
    <div className="space-y-3 rounded-2xl border border-edge/10 p-3.5">
      <div>
        <p className="text-[12.5px] font-black text-ink">صورة كل {optionNames[ci]!.replace(/^ال/, "")}</p>
        <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">حين يختار العميل {optionNames[ci]} في المتجر تنتقل الصور إلى صورته، وتظهر نفسها في سلته وطلبه.</p>
      </div>
      <ul className="space-y-3">
        {colors.map((c) => {
          const chosen = imageOf(c);
          const hex = colorFromName(c);
          return (
            <li key={c}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-ink">
                {hex ? <span className="size-3.5 rounded-full ring-1 ring-edge/20" style={{ background: hex }} /> : null}
                {c}
                {!chosen ? <span className="font-normal text-ink-3">· بلا صورة خاصة</span> : null}
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={`صورة ${c}`}>
                {usable.map((im) => {
                  const on = chosen === im.url;
                  return (
                    <button
                      key={im.url}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${on ? "إلغاء " : ""}صورة للون ${c}`}
                      onClick={() => set(c, on ? null : im.url)}
                      className={cn(
                        "relative size-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                        on ? "border-nova" : "border-transparent opacity-70 hover:opacity-100"
                      )}
                    >
                      <Image src={im.url} alt="" fill sizes="56px" className="object-cover" />
                      {on ? (
                        <span className="absolute inset-0 grid place-items-center bg-nova/35">
                          <Check className="size-5 text-white" strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
