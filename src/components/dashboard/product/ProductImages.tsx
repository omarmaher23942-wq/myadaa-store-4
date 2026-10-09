"use client";

// ProductImages — صور المنتج: رفع بالسحب والإفلات أو الاختيار (تُضغط في المتصفح قبل الرفع فتصل أسرع وتُحمّل في المتجر
// أسرع)، وترتيب بالسحب على الكمبيوتر وبالأسهم على الموبايل، و«اجعلها الرئيسية»، وحذف بأزرار ظاهرة دائماً (لا تعتمد
// على المرور بالفأرة). الصورة الأولى هي التي تظهر في بطاقة المنتج.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { useUploadThing } from "@/lib/uploadthing-client";
import { isHostedImage } from "@/lib/media-hosts";

export type ProductImage = { url: string; key?: string; alt?: string };
export const MAX_PRODUCT_IMAGES = 20;

export function ProductImages({ value, onChange, name }: { value: ProductImage[]; onChange: (v: ProductImage[]) => void; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  // أحدث قيمة دائماً: الرفع يكتمل بعد تغييرات أخرى، فلا نكتب فوقها بنسخة قديمة.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const { startUpload } = useUploadThing("productImage", {
    onUploadError: (e) => {
      // رسائلنا العربية (مثل «أضف مفتاح UploadThing» في مشروع التاجر) تُعرض كما هي، وغيرها برسالة مفهومة.
      toast.error(/[\u0600-\u06FF]/.test(e?.message ?? "") ? e.message : "تعذر رفع الصورة. تأكد من الاتصال وحاول مرة أخرى");
    },
  });

  async function upload(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") && f.type !== "image/svg+xml");
    if (images.length < files.length) toast.error("بعض الملفات ليست صوراً (JPG أو PNG أو WebP) فتُركت");
    const room = MAX_PRODUCT_IMAGES - latest.current.length;
    if (room <= 0) return void toast.error(`الحد ${fmtNum(MAX_PRODUCT_IMAGES)} صورة للمنتج`);
    const picked = images.slice(0, room);
    if (!picked.length) return;
    setUploading(picked.length);
    const compressed = await Promise.all(
      picked.map(async (f) => {
        try {
          const c = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 2000, useWebWorker: true, initialQuality: 0.85 });
          return new File([c], f.name, { type: c.type || f.type });
        } catch {
          return f;
        }
      })
    );
    const res = await startUpload(compressed).catch(() => undefined);
    setUploading(0);
    const added = (res ?? []).map((r) => ({ url: r.ufsUrl, key: r.key, alt: name }));
    if (added.length) onChange([...latest.current, ...added]);
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    onChange(next);
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        void upload(Array.from(e.dataTransfer.files));
      }}
      className={cn("rounded-2xl transition-colors", over && "bg-nova/[0.06] ring-2 ring-nova/40")}
    >
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4" aria-label="صور المنتج">
        {value.map((im, i) => (
          <li
            key={`${im.url}-${i}`}
            draggable
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => drag !== null && e.preventDefault()}
            onDrop={(e) => {
              if (drag === null) return;
              e.preventDefault();
              e.stopPropagation();
              move(drag, i);
              setDrag(null);
            }}
            onDragEnd={() => setDrag(null)}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-xl border bg-edge/[0.04]",
              i === 0 ? "border-nova/50 ring-1 ring-nova/30" : "border-edge/10",
              drag === i && "opacity-40"
            )}
          >
            {isHostedImage(im.url) ? (
              <Image src={im.url} alt={im.alt || name} fill sizes="(max-width: 640px) 50vw, 200px" className="object-cover" draggable={false} />
            ) : (
              <span className="grid h-full place-items-center p-3 text-center text-[11px] leading-5 text-ink-3">صورة على رابط خارجي لم تُنقل بعد</span>
            )}
            {i === 0 ? (
              <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-nova px-1.5 py-0.5 text-[10.5px] font-black text-white shadow">
                <Star className="size-3 fill-current" aria-hidden="true" /> الرئيسية
              </span>
            ) : null}
            <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
              <span className="flex gap-1">
                <IconBtn label="تقديم الصورة" onClick={() => move(i, i - 1)} disabled={i === 0}>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </IconBtn>
                <IconBtn label="تأخير الصورة" onClick={() => move(i, i + 1)} disabled={i === value.length - 1}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </IconBtn>
              </span>
              <span className="flex gap-1">
                {i > 0 ? (
                  <IconBtn label="اجعلها الصورة الرئيسية" onClick={() => move(i, 0)}>
                    <Star className="size-4" aria-hidden="true" />
                  </IconBtn>
                ) : null}
                <IconBtn label="حذف الصورة" tone="bad" onClick={() => onChange(value.filter((_, k) => k !== i))}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </IconBtn>
              </span>
            </div>
          </li>
        ))}

        {uploading
          ? Array.from({ length: uploading }, (_, i) => (
              <li key={`up-${i}`} className="grid aspect-square place-items-center rounded-xl border border-edge/10 bg-edge/[0.04]" aria-live="polite">
                <span className="flex flex-col items-center gap-1.5 text-[11.5px] font-bold text-ink-3">
                  <Loader2 className="size-5 animate-spin text-nova-2" aria-hidden="true" />
                  نرفع…
                </span>
              </li>
            ))
          : null}

        {value.length + uploading < MAX_PRODUCT_IMAGES ? (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading > 0}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-edge/15 p-3 text-center transition-colors hover:border-nova/50 hover:bg-nova/[0.04] disabled:opacity-60"
            >
              <ImagePlus className="size-6 text-nova-2" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[12.5px] font-black text-ink">{value.length ? "أضف صوراً" : "ارفع صور المنتج"}</span>
              <span className="hidden text-[11px] text-ink-3 sm:block">أو اسحبها إلى هنا</span>
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void upload(files);
        }}
      />
      {value.length > 1 ? <p className="mt-2 hidden text-[11.5px] text-ink-3 md:block">اسحب الصور لترتيبها. الأولى تظهر في بطاقة المنتج.</p> : null}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, tone, children }: { label: string; onClick: () => void; disabled?: boolean; tone?: "bad"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-lg bg-black/55 text-white backdrop-blur transition-colors disabled:opacity-30",
        tone === "bad" ? "hover:bg-bad" : "hover:bg-black/75"
      )}
    >
      {children}
    </button>
  );
}
