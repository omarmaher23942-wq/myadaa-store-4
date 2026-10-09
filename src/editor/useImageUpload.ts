"use client";

// useImageUpload — رفع صور محرر المحتوى (الشعار، صور الواجهة، الخلفيات…): ضغط في المتصفح ثم رفع لمساحة المتجر
// (brandAsset: صورة واحدة في كل طلب، فتُرفع المتعددة واحدة بعد واحدة).
import { useState } from "react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing-client";

const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export function useImageUpload() {
  const [busy, setBusy] = useState(0);
  const { startUpload } = useUploadThing("brandAsset", {
    onUploadError: (e) => {
      toast.error(/[\u0600-\u06FF]/.test(e?.message ?? "") ? e.message : "تعذر رفع الصورة. تأكد من الاتصال وحاول مرة أخرى");
    },
  });

  async function upload(files: File[], max = 1): Promise<string[]> {
    const all = files;
    const images = all.filter((f) => OK_TYPES.includes(f.type));
    if (images.length < all.length) toast.error("الصور فقط (JPG أو PNG أو WebP)");
    const picked = images.slice(0, Math.max(0, max));
    if (!picked.length) return [];
    setBusy(picked.length);
    const urls: string[] = [];
    for (const f of picked) {
      let file = f;
      if (f.type !== "image/gif") {
        try {
          const c = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 2400, useWebWorker: true, initialQuality: 0.85 });
          file = new File([c], f.name, { type: c.type || f.type });
        } catch {
          /* يُرفع الأصل */
        }
      }
      const res = await startUpload([file]).catch(() => undefined);
      const url = res?.[0]?.ufsUrl;
      if (url) urls.push(url);
      setBusy((n) => Math.max(0, n - 1));
    }
    setBusy(0);
    return urls;
  }

  return { upload, busy };
}
