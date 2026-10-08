"use client";

// components/dashboard/ProductsToolbar.tsx — أدوات المنتجات (موجة 3).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Sparkles, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ProductsToolbar() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        toast.error("الملف فارغ أو غير صالح.");
        return;
      }

      // نتوقع الصيغة: name,price,stock,description
      const [header, ...dataLines] = lines;
      const headerCols = header!.split(",").map((h) => h.trim().toLowerCase());
      const nameIdx = headerCols.indexOf("name");
      const priceIdx = headerCols.indexOf("price");
      const stockIdx = headerCols.indexOf("stock");
      const descIdx = headerCols.indexOf("description");

      if (nameIdx === -1 || priceIdx === -1) {
        toast.error(
          "الملف يجب أن يحتوي على أعمدة name و price (واختيارياً stock, description)."
        );
        return;
      }

      const rows = dataLines
        .map((line) => {
          const cols = line.split(",").map((c) => c.trim());
          return {
            name: cols[nameIdx] ?? "",
            price: Number(cols[priceIdx]) || 0,
            stock: stockIdx >= 0 ? Number(cols[stockIdx]) || 20 : 20,
            description: descIdx >= 0 ? cols[descIdx] ?? "" : "",
          };
        })
        .filter((r) => r.name && r.price > 0);

      if (rows.length === 0) {
        toast.error("لم نجد صفوفاً صالحة في الملف.");
        return;
      }

      // نرسل للـ server action.
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      if (!res.ok) {
        throw new Error("فشل الاستيراد");
      }

      const data = (await res.json()) as { imported: number };
      toast.success(`تم استيراد ${data.imported} منتج.`);
      router.refresh();
    } catch {
      toast.error("حدث خطأ أثناء الاستيراد.");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = "name,price,stock,description\nفستان صيفي,450,20,خامة قطن ممتازة";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تحميل القالب.");
  };

  const handleAIBulk = () => {
    start(async () => {
      try {
        const res = await fetch("/api/products/ai-enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "seo" }),
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { enhanced: number };
        toast.success(`تم تحسين ${data.enhanced} منتج بالذكاء الاصطناعي.`);
        router.refresh();
      } catch {
        toast.error("تعذر التحسين الجماعي.");
      }
    });
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={handleDownloadTemplate}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-xs font-bold text-ink-2 transition-colors hover:bg-edge/[0.06]"
        title="حمّل قالب CSV"
      >
        <Download className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        <span className="hidden sm:inline">قالب CSV</span>
      </button>
      <button
        type="button"
        onClick={handleImportClick}
        disabled={importing}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-xs font-bold text-ink transition-colors hover:bg-edge/[0.06] disabled:opacity-60"
      >
        {importing ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <Upload className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        )}
        <span>استيراد CSV</span>
      </button>
      <button
        type="button"
        onClick={handleAIBulk}
        disabled={pending}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-nova-2/40 bg-gradient-to-l from-nova/20 to-nova-2/15 px-3 text-xs font-black text-nova-2 transition-all hover:from-nova/30 hover:to-nova-2/25 disabled:opacity-60"
        title="حسّن عناوين SEO و الأوصاف لكل المنتجات"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <Sparkles className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
        )}
        <span>تحسين AI</span>
      </button>
    </>
  );
}