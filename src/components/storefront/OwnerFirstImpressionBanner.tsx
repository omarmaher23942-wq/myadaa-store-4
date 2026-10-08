"use client";

// شريط ترحيب صاحب المتجر عند معاينة متجره (رابط ?preview=owner من اللوحة أو بريد الجاهزية).
// كوكي التاجر لا يُرى على نطاق المتجر (host-only)، فالمعاينة تُعرف من الرابط وتُحفظ للجلسة.
import { useEffect, useState } from "react";
import { Sparkles, ArrowLeft, X } from "lucide-react";
import { EDITION } from "@/lib/edition";

const dashboardHref = () =>
  EDITION === "store" ? "/dashboard" : `${process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? ""}`}/dashboard`;

export function OwnerFirstImpressionBanner({ subdomain, storeName }: { subdomain: string; storeName: string }) {
  const [show, setShow] = useState(false);
  const key = `clp_owner_preview_${subdomain}`;

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("preview") === "owner") sessionStorage.setItem(key, "1");
      setShow(sessionStorage.getItem(key) === "1");
    } catch {
      /* التخزين غير متاح */
    }
  }, [key]);

  if (!show) return null;

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-l from-amber-400 via-amber-500 to-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md" dir="rtl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-lg bg-slate-950/10 p-1">
            <Sparkles className="size-4" />
          </span>
          <p className="truncate">
            أنت تشاهد متجرك <b>{storeName}</b> كما يراه عملاؤك. عدّل أي شيء من لوحة التحكم.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a href={dashboardHref()} className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-slate-900">
            لوحة التحكم <ArrowLeft className="size-3" />
          </a>
          <button
            type="button"
            aria-label="إغلاق الشريط"
            onClick={() => {
              try {
                sessionStorage.removeItem(key);
              } catch {
                /* التخزين غير متاح */
              }
              setShow(false);
            }}
            className="p-1 text-slate-950/60 hover:text-slate-950"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
