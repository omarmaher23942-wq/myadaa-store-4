"use client";

// شريط أعلى صفحة الفواتير (لا يُطبع): طباعة أو حفظ PDF، وإعدادات الفاتورة تُطبق فوراً على المعاينة.
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, ArrowRight, Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveInvoiceSettingsAction } from "@/server/actions/invoice";
import type { StoreBlueprint } from "@/blueprint/schema";

type Invoice = StoreBlueprint["invoice"];

const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 10, padding: "8px 12px", fontSize: 13, fontWeight: 800 };

export function PrintBar({ count, autoPrint, invoice }: { count: number; autoPrint: boolean; invoice: Invoice }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Invoice>(invoice);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!autoPrint || !count) return;
    // ننتظر تحميل الصور (الشعار ورموز QR) قبل فتح نافذة الطباعة.
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, [autoPrint, count]);

  const apply = (patch: Partial<Invoice>) => {
    const next = { ...v, ...patch };
    setV(next);
    start(async () => {
      const r = await saveInvoiceSettingsAction(next);
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  };

  const chip = (on: boolean): React.CSSProperties => ({ ...btn, padding: "6px 10px", fontSize: 12, background: on ? "#fff" : "rgb(255 255 255 / .1)", color: on ? "#111827" : "#fff" });

  return (
    <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, maxWidth: 760, margin: "0 auto 18px", background: "#111827", color: "#fff", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Link href="/dashboard/orders" style={{ ...btn, padding: 0, opacity: 0.85 }}>
          <ArrowRight size={16} /> الطلبات
        </Link>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          {pending ? <Loader2 size={14} className="animate-spin" style={{ display: "inline" }} /> : null} {count ? `${count} فاتورة جاهزة` : "لا توجد طلبات بهذه الأرقام"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ ...btn, background: "rgb(255 255 255 / .12)", color: "#fff" }}>
            <Settings2 size={16} /> الإعدادات
          </button>
          <button type="button" onClick={() => window.print()} disabled={!count} style={{ ...btn, background: "#fff", color: "#111827" }}>
            <Printer size={16} /> اطبع أو احفظ PDF
          </button>
        </div>
      </div>
      {open ? (
        <div style={{ marginTop: 12, display: "grid", gap: 10, fontSize: 12 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ opacity: 0.7, minWidth: 70 }}>مقاس الورق</span>
            {(["A5", "A4", "thermal80"] as const).map((p) => (
              <button key={p} type="button" onClick={() => apply({ paperSize: p })} style={chip(v.paperSize === p)}>
                {p === "thermal80" ? "طابعة حرارية 80مم" : p}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ opacity: 0.7, minWidth: 70 }}>تظهر</span>
            <button type="button" onClick={() => apply({ showPrices: !v.showPrices })} style={chip(v.showPrices)}>الأسعار</button>
            <button type="button" onClick={() => apply({ showLogo: !v.showLogo })} style={chip(v.showLogo)}>الشعار</button>
            <button type="button" onClick={() => apply({ showQr: !v.showQr })} style={chip(v.showQr)}>رمز تتبع الطلب</button>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ opacity: 0.7, minWidth: 70 }}>لون الفاتورة</span>
            <input type="color" value={v.accentColor ?? "#111827"} onChange={(e) => setV({ ...v, accentColor: e.target.value })} onBlur={() => apply({ accentColor: v.accentColor })} aria-label="لون الفاتورة" style={{ width: 40, height: 28, background: "transparent", border: 0 }} />
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ opacity: 0.7, minWidth: 70 }}>ملاحظة أسفل الفاتورة</span>
            <input
              value={v.footerNote}
              maxLength={200}
              onChange={(e) => setV({ ...v, footerNote: e.target.value })}
              onBlur={() => apply({ footerNote: v.footerNote })}
              style={{ flex: 1, minWidth: 200, background: "rgb(255 255 255 / .1)", color: "#fff", borderRadius: 8, padding: "6px 10px", border: "1px solid rgb(255 255 255 / .15)" }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
