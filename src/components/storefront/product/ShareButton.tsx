"use client";

// مشاركة المنتج: قائمة المشاركة الأصلية في الموبايل، ونسخ الرابط في غيره.
import { useState } from "react";
import { Share2, Check } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ألغى المستخدم المشاركة */
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "تم نسخ الرابط" : "مشاركة المنتج"}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-[var(--foreground)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
    >
      {copied ? <Check className="size-4" strokeWidth={2.25} /> : <Share2 className="size-4" strokeWidth={1.75} />}
    </button>
  );
}
