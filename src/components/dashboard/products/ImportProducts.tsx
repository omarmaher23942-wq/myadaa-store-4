"use client";

// ImportProducts — استيراد المنتجات من ملف CSV (يُحفظ من Excel أو Google Sheets): قالب جاهز بعناوين عربية، ثم معاينة
// قبل أي حفظ تُظهر عدد الصفوف الصالحة وأخطاء كل سطر برقمه، ثم استيراد في معاملة واحدة كمسودات أو منشورة، ثم نقل
// الصور من روابطها إلى مساحة رفع المتجر منتجاً منتجاً بتقدم ظاهر (الروابط الخارجية لا تظهر في المتجر).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, ImageUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { parseCsv } from "@/lib/csv-parse";
import { IMPORT_MAX_ROWS, IMPORT_TEMPLATE, planImport, type ImportPlan } from "@/lib/product-import";
import { isHostedImage } from "@/lib/media-hosts";
import { importProductsAction } from "@/server/actions/product-import";
import { DashDialog } from "../ui/DashDialog";
import { ImagesProgress, MoverDoneButtons, useImageMover } from "./ImageMover";

export function ImportProducts() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const mover = useImageMover();
  const images = mover.phase;

  const reset = () => {
    setCsv(null);
    setPlan(null);
    setFileName("");
    setPublish(false);
    mover.reset();
  };

  const close = () => {
    if (busy) return;
    if (images?.running) return void mover.stop();
    const hadImport = images !== null;
    setOpen(false);
    reset();
    if (hadImport) router.refresh();
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) return void toast.error("الملف أكبر من 2 ميجابايت؛ قسّمه إلى ملفات أصغر");
    if (/\.(xlsx?|numbers)$/i.test(file.name)) return void toast.error("احفظ الملف بصيغة CSV أولاً: من Excel اختر «حفظ باسم» ثم CSV UTF-8");
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setPlan(planImport(parseCsv(text)));
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "قالب-المنتجات.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    if (!csv) return;
    setBusy(true);
    const r = await importProductsAction({ csv, publish });
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(
      `أُضيف ${arCount(r.created, NOUN.product)}${r.newCategories ? ` و${arCount(r.newCategories, NOUN.newCategory)}` : ""}${r.skipped ? `، وتُرك ${arCount(r.skipped, NOUN.row)} بأخطاء` : ""}`
    );
    if (r.rehost.length) return void mover.run(r.rehost);
    setOpen(false);
    reset();
    router.refresh();
  }

  const good = plan?.rows.filter((r) => r.errors.length === 0) ?? [];
  const bad = plan?.rows.filter((r) => r.errors.length > 0) ?? [];
  const warned = good.filter((r) => r.warnings.length > 0);
  const externalImages = good.reduce((n, r) => n + r.images.filter((u) => !isHostedImage(u)).length, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-[12.5px] font-bold text-ink transition-colors hover:bg-edge/[0.06]"
      >
        <Upload className="size-4" aria-hidden="true" />
        استيراد من ملف
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />

      <DashDialog
        open={open}
        onClose={close}
        title={images ? "نقل الصور إلى متجرك" : "استيراد المنتجات من ملف"}
        description={
          images
            ? "نجلب كل صورة من رابطها ونرفعها إلى مساحة الصور في متجرك، لأن المتجر لا يعرض صوراً من مواقع أخرى."
            : plan
              ? fileName
              : `املأ القالب في Excel أو Google Sheets واحفظه بصيغة CSV، ثم ارفعه هنا. حتى ${fmtNum(IMPORT_MAX_ROWS)} منتج في الملف.`
        }
        className="sm:max-w-xl"
        footer={
          images ? (
            images.running ? (
              <button type="button" onClick={mover.stop} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
                أوقف بعد المنتج الحالي
              </button>
            ) : (
              <MoverDoneButtons mover={mover} onDone={close} />
            )
          ) : plan ? (
            <>
              <button type="button" onClick={reset} disabled={busy} className="inline-flex min-h-11 items-center rounded-xl border border-edge/10 px-4 text-[12.5px] font-bold text-ink-2 hover:bg-edge/5">
                ملف آخر
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || good.length === 0 || plan.missingColumns.length > 0 || plan.tooMany}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {good.length ? `استورد ${arCount(good.length, NOUN.product)}` : "لا صفوف صالحة"}
              </button>
            </>
          ) : null
        }
      >
        {images ? (
          <ImagesProgress p={images} />
        ) : !plan ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-edge/15 p-6 text-center transition-colors hover:border-nova/40 hover:bg-nova/[0.04]"
            >
              <FileSpreadsheet className="size-8 text-nova-2" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[13.5px] font-black text-ink">اختر ملف CSV</span>
              <span className="text-[12px] text-ink-3">الأعمدة: اسم المنتج والسعر (إلزاميان)، ثم اختيارياً: السعر قبل الخصم، سعر التكلفة، الكمية، القسم، الكود، الوصف، الصور</span>
            </button>
            <button type="button" onClick={downloadTemplate} className="inline-flex min-h-10 items-center gap-1.5 text-[12.5px] font-bold text-nova-2 hover:text-ink">
              <Download className="size-4" aria-hidden="true" />
              حمّل القالب الجاهز
            </button>
            <ul className="list-disc space-y-1 ps-5 text-[12px] leading-6 text-ink-3">
              <li>اترك «الكمية» فارغة إن كان المنتج متاحاً دائماً بلا عدّ مخزون.</li>
              <li>القسم يُربط بالقسم الموجود بنفس الاسم، أو يُنشأ قسم جديد.</li>
              <li>الصور روابط https، وأكثر من صورة تُفصل بعلامة |.</li>
            </ul>
          </div>
        ) : plan.missingColumns.length ? (
          <p className="rounded-xl bg-bad/10 p-3.5 text-[13px] font-bold leading-6 text-bad">
            لم نجد عمود {plan.missingColumns.map((c) => (c === "name" ? "«اسم المنتج»" : "«السعر»")).join(" و")} في أول سطر بالملف. استخدم القالب الجاهز أو اكتب العناوين كما فيه.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat icon={CheckCircle2} tone="ok" value={good.length} label="صالح للاستيراد" />
              <Stat icon={AlertTriangle} tone={bad.length ? "bad" : "muted"} value={bad.length} label="به أخطاء ولن يُستورد" />
            </div>
            {plan.tooMany ? <p className="rounded-xl bg-bad/10 p-3 text-[12.5px] font-bold text-bad">الملف أكثر من {fmtNum(IMPORT_MAX_ROWS)} صف؛ قسّمه إلى ملفات أصغر.</p> : null}

            {bad.length ? (
              <details open className="rounded-xl border border-bad/20">
                <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-black text-bad">أسطر بها أخطاء</summary>
                <ul className="max-h-40 space-y-1 overflow-y-auto px-3.5 pb-3 text-[12px] text-ink-2">
                  {bad.slice(0, 50).map((r) => (
                    <li key={r.line}>
                      <b className="tabular-nums">سطر {fmtNum(r.line)}:</b> {r.errors.join("، ")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {warned.length ? (
              <details className="rounded-xl border border-warn/25">
                <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-black text-warn">ملاحظات على {arCount(warned.length, NOUN.product)} (ستُستورد)</summary>
                <ul className="max-h-32 space-y-1 overflow-y-auto px-3.5 pb-3 text-[12px] text-ink-2">
                  {warned.slice(0, 50).map((r) => (
                    <li key={r.line}>
                      <b className="tabular-nums">سطر {fmtNum(r.line)}:</b> {r.warnings.join("، ")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {good.length ? (
              <div className="overflow-hidden rounded-xl border border-edge/[0.07]">
                <table className="w-full text-[12px]">
                  <caption className="sr-only">معاينة أول المنتجات</caption>
                  <thead className="bg-edge/[0.03] text-ink-3">
                    <tr>
                      <th scope="col" className="p-2 text-start font-bold">المنتج</th>
                      <th scope="col" className="p-2 text-end font-bold">السعر</th>
                      <th scope="col" className="p-2 text-end font-bold">الكمية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge/[0.05]">
                    {good.slice(0, 5).map((r) => (
                      <tr key={r.line}>
                        <td className="max-w-[12rem] truncate p-2 font-bold text-ink">
                          {r.name}
                          {r.category ? <span className="ms-1.5 font-normal text-ink-3">· {r.category}</span> : null}
                        </td>
                        <td className="p-2 text-end tabular-nums text-ink">{formatEgp(r.pricePiasters)}</td>
                        <td className="p-2 text-end tabular-nums text-ink-2">{r.stock === null ? "دائماً" : fmtNum(r.stock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {good.length > 5 ? <p className="border-t border-edge/[0.05] p-2 text-center text-[11.5px] text-ink-3">و{arCount(good.length - 5, NOUN.product)} أخرى</p> : null}
              </div>
            ) : null}

            {externalImages ? (
              <p className="flex items-start gap-2 rounded-xl bg-nova/[0.07] p-3 text-[12.5px] leading-6 text-ink-2">
                <ImageUp className="mt-0.5 size-4 shrink-0 text-nova-2" aria-hidden="true" />
                <span>
                  بعد الحفظ ننقل {arCount(externalImages, NOUN.image)} من روابطها إلى مساحة الصور في متجرك. أبقِ هذه النافذة مفتوحة حتى ينتهي النقل.
                </span>
              </p>
            ) : null}

            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-edge/[0.07] p-3">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-0.5 size-4 accent-[var(--dash-nova)]" />
              <span className="text-[12.5px] leading-6 text-ink-2">
                <b className="text-ink">انشرها في المتجر فوراً.</b> بدون هذا الاختيار تُحفظ مسودات تراجعها وتنشرها حين تشاء.
              </span>
            </label>
          </div>
        )}
      </DashDialog>
    </>
  );
}

function Stat({ icon: Icon, tone, value, label }: { icon: typeof CheckCircle2; tone: "ok" | "bad" | "muted"; value: number; label: string }) {
  return (
    <div className={cn("rounded-xl p-3", tone === "ok" ? "bg-ok/10" : tone === "bad" ? "bg-bad/10" : "bg-edge/[0.04]")}>
      <p className={cn("flex items-center gap-1.5 text-[20px] font-black tabular-nums", tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-ink-3")}>
        <Icon className="size-4" aria-hidden="true" />
        {fmtNum(value)}
      </p>
      <p className="mt-0.5 text-[11.5px] font-bold text-ink-2">{label}</p>
    </div>
  );
}
