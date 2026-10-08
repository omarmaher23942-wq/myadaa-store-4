"use client";

// PoliciesEditor — سياسات المتجر كما يطبقها التاجر فعلاً، بمعاينة حية للنص الذي يراه العميل.
// أي تغيير هنا ينعكس فوراً على صفحة السياسة وشارات الثقة والأسئلة الشائعة في المتجر (طبقة الحقائق).
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, PackageX, Eye, Truck, Store, Save, Loader2, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generatePolicyPage, reportWindow } from "@/blueprint/policy-pages";
import { Markdown } from "@/components/storefront/Markdown";
import { savePoliciesAction } from "@/server/actions/policies";
import type { StoreBlueprint } from "@/blueprint/schema";

type Returns = StoreBlueprint["returns"];
type Shipping = StoreBlueprint["shipping"];

const CONDITION_PRESETS = [
  "أن يكون المنتج بحالته الأصلية، غير مستخدم وغير مغسول.",
  "أن يكون في تغليفه الأصلي مع كل الملحقات والبطاقات.",
  "أن يكون معك كود الطلب أو رقم الموبايل المسجل به.",
  "ألا تكون العلامات أو الملصقات قد أُزيلت.",
  "أن يُرسل صورة للمنتج قبل الاسترجاع عند وجود عيب.",
];
const NON_RETURNABLE_PRESETS = ["الملابس الداخلية ولبس البحر", "المنتجات المفصّلة أو المطبوعة حسب الطلب", "مستحضرات التجميل والعطور بعد فتحها", "الأطعمة والمنتجات القابلة للتلف", "المنتجات المخفّضة في التصفيات"];
const DEFECT: { value: Returns["defectPolicy"]; label: string }[] = [
  { value: "replace_or_refund", label: "استبدال أو استرداد" },
  { value: "replace", label: "استبدال فقط" },
  { value: "refund", label: "استرداد فقط" },
  { value: "case_by_case", label: "حسب الحالة" },
  { value: "none", label: "لا التزام" },
];

function Chips<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-10 rounded-xl border px-3.5 text-[13px] font-black transition", o.value === value ? "border-nova/60 bg-nova/15 text-ink" : "border-edge/10 text-ink-2 hover:border-edge/25")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label, sub, icon: Icon }: { on: boolean; onChange: (v: boolean) => void; label: string; sub: string; icon: typeof Eye }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition", on ? "border-nova/50 bg-nova/[0.08]" : "border-edge/10")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-nova text-white" : "bg-edge/[0.06] text-ink-3")}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-black text-ink">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-5 text-ink-3">{sub}</span>
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", on ? "bg-nova" : "bg-edge/15")} aria-hidden="true">
        <span className={cn("absolute top-1 size-4 rounded-full bg-white shadow transition-all", on ? "start-5" : "start-1")} />
      </span>
    </button>
  );
}

function Card({ icon: Icon, title, sub, children }: { icon: typeof Eye; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="dash-card space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-nova/15 text-nova-2">
          <Icon className="size-4.5" />
        </span>
        <div>
          <h2 className="text-[15px] font-black text-ink">{title}</h2>
          {sub ? <p className="mt-0.5 text-[12.5px] leading-6 text-ink-2">{sub}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function PoliciesEditor({ bp, storeUrl }: { bp: StoreBlueprint; storeUrl: string }) {
  const router = useRouter();
  const [returns, setReturns] = useState<Returns>(bp.returns);
  const [ship, setShip] = useState<Shipping>(bp.shipping);
  const [page, setPage] = useState<"returns" | "shipping">("returns");
  const [pending, start] = useTransition();
  const dirty = JSON.stringify([returns, ship]) !== JSON.stringify([bp.returns, bp.shipping]);
  const noReturns = returns.windowDays === 0;

  const preview = useMemo(() => generatePolicyPage({ ...bp, returns, shipping: ship }, page)?.body ?? "", [bp, returns, ship, page]);
  const setR = (p: Partial<Returns>) => setReturns((r) => ({ ...r, ...p }));
  const setS = (p: Partial<Shipping>) => setShip((s) => ({ ...s, ...p }));
  const nonReturnable = (returns.nonReturnable ?? "").split("، ").map((x) => x.trim()).filter(Boolean);
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = () =>
    start(async () => {
      const r = await savePoliciesAction({
        returns,
        shipping: { inspectionAllowed: ship.inspectionAllowed, freeOverPiasters: ship.freeOverPiasters, generalEta: ship.generalEta, pickupEnabled: ship.pickupEnabled, pickupAddress: ship.pickupAddress },
      });
      if (r.ok) {
        toast.success("حفظنا سياساتك، وتحدّث متجرك فوراً");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]" dir="rtl">
      <div className="min-w-0 space-y-5">
        <Card icon={RotateCcw} title="الاستبدال والاسترجاع" sub="اختر ما تطبقه فعلاً. صفحة السياسة وشارات الثقة في متجرك تتبع اختيارك حرفياً.">
          <div className="space-y-2">
            <p className="text-[13px] font-black text-ink">المدة المسموح بها بعد الاستلام</p>
            <Chips label="مدة الاستبدال" value={returns.windowDays} onChange={(v) => setR({ windowDays: v, ...(v > 0 && !returns.allowExchange && !returns.allowRefund ? { allowExchange: true } : {}) })} options={[0, 3, 7, 14, 30].map((d) => ({ value: d, label: d ? `${d} يوم` : "لا يوجد" }))} />
          </div>
          {noReturns ? null : (
            <>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Toggle icon={RotateCcw} label="استبدال" sub="بمقاس أو لون أو منتج آخر" on={returns.allowExchange} onChange={(v) => setR({ allowExchange: v })} />
                <Toggle icon={RotateCcw} label="استرجاع المبلغ" sub="رد الفلوس كاملة" on={returns.allowRefund} onChange={(v) => setR({ allowRefund: v })} />
              </div>
              <div className="space-y-2">
                <p className="text-[13px] font-black text-ink">شحن المرتجع (تغيير رأي أو مقاس) على</p>
                <Chips label="شحن المرتجع" value={returns.returnShippingPaidBy === "store" ? "store" : "customer"} onChange={(v) => setR({ returnShippingPaidBy: v })} options={[{ value: "customer", label: "العميل" }, { value: "store", label: "المتجر" }]} />
              </div>
              {returns.allowRefund ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-black text-ink">رد المبلغ خلال</p>
                  <Chips label="رد المبلغ" value={returns.refundDays} onChange={(v) => setR({ refundDays: v })} options={[3, 7, 14].map((d) => ({ value: d, label: `${d} أيام عمل` }))} />
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-[13px] font-black text-ink">شروط القبول</p>
                <div className="flex flex-wrap gap-2">
                  {CONDITION_PRESETS.map((c) => (
                    <button key={c} type="button" aria-pressed={returns.conditions.includes(c)} onClick={() => setR({ conditions: toggleIn(returns.conditions, c).slice(0, 8) })} className={cn("rounded-xl border px-3 py-2 text-start text-[12.5px] font-bold leading-5 transition", returns.conditions.includes(c) ? "border-nova/50 bg-nova/10 text-ink" : "border-edge/10 text-ink-3")}>
                      {returns.conditions.includes(c) ? "✓ " : "+ "}
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[13px] font-black text-ink">منتجات لا تُستبدل ولا تُسترجع</p>
                <div className="flex flex-wrap gap-2">
                  {NON_RETURNABLE_PRESETS.map((c) => (
                    <button key={c} type="button" aria-pressed={nonReturnable.includes(c)} onClick={() => setR({ nonReturnable: toggleIn(nonReturnable, c).join("، ") || undefined })} className={cn("rounded-xl border px-3 py-2 text-[12.5px] font-bold transition", nonReturnable.includes(c) ? "border-nova/50 bg-nova/10 text-ink" : "border-edge/10 text-ink-3")}>
                      {nonReturnable.includes(c) ? "✓ " : "+ "}
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </Card>

        <Card icon={PackageX} title="المنتج المعيب أو المخالف للطلب" sub="التزام مستقل عن الاستبدال العادي، وأنت من يحدده.">
          <Chips label="التعامل مع المعيب" value={returns.defectPolicy} onChange={(v) => setR({ defectPolicy: v })} options={DEFECT} />
          {returns.defectPolicy !== "none" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-[13px] font-black text-ink">مهلة إبلاغك بالعيب</p>
                <Chips label="مهلة الإبلاغ" value={returns.defectReportHours} onChange={(v) => setR({ defectReportHours: v })} options={[24, 48, 72, 168, 336, 720].map((h) => ({ value: h, label: reportWindow(h) }))} />
              </div>
              {returns.defectPolicy !== "case_by_case" ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-black text-ink">شحن المعيب على</p>
                  <Chips label="شحن المعيب" value={returns.defectShippingByStore ? "store" : "customer"} onChange={(v) => setR({ defectShippingByStore: v === "store" })} options={[{ value: "store", label: "المتجر" }, { value: "customer", label: "العميل" }]} />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[12px] leading-6 text-ink-3">لن تذكر صفحة السياسة أي التزام عن العيوب. تذكّر أن قانون حماية المستهلك يحفظ للعميل حقه في المنتج المعيب.</p>
          )}
        </Card>

        <Card icon={Truck} title="التوصيل والمعاينة" sub="أسعار كل محافظة تُضبط من صفحة الشحن.">
          <Toggle icon={Eye} label="المعاينة قبل الدفع" sub="العميل يفتح الشحنة ويفحص المنتج مع المندوب قبل أن يدفع" on={ship.inspectionAllowed} onChange={(v) => setS({ inspectionAllowed: v })} />
          <div className="space-y-2">
            <p className="text-[13px] font-black text-ink">شحن مجاني</p>
            <Chips
              label="الشحن المجاني"
              value={ship.freeOverPiasters === null ? -1 : ship.freeOverPiasters}
              onChange={(v) => setS({ freeOverPiasters: v === -1 ? null : v })}
              options={[{ value: -1, label: "بدون" }, { value: 0, label: "لكل الطلبات" }, ...[50000, 75000, 100000, 150000, 200000].map((p) => ({ value: p, label: `فوق ${p / 100} ج` }))]}
            />
          </div>
          <label className="block space-y-2">
            <span className="text-[13px] font-black text-ink">مدة التوصيل كما تظهر للعميل</span>
            <input value={ship.generalEta} onChange={(e) => setS({ generalEta: e.target.value.slice(0, 80) })} className="h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-[14px] font-bold text-ink outline-none focus:border-nova" />
          </label>
          <Toggle icon={Store} label="الاستلام من المتجر" sub="العميل يستلم طلبه بنفسه بلا رسوم شحن" on={ship.pickupEnabled} onChange={(v) => setS({ pickupEnabled: v })} />
          {ship.pickupEnabled ? (
            <input value={ship.pickupAddress ?? ""} onChange={(e) => setS({ pickupAddress: e.target.value.slice(0, 200) })} placeholder="عنوان الاستلام بالتفصيل" className="h-11 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3.5 text-[14px] font-bold text-ink outline-none focus:border-nova" />
          ) : null}
        </Card>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <div className="dash-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-edge/[0.07] p-3">
            <span className="flex items-center gap-1.5 text-[12.5px] font-black text-ink">
              <FileText className="size-4 text-nova-2" /> كما يراها عميلك
            </span>
            <div className="flex gap-1">
              {(["returns", "shipping"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setPage(k)} className={cn("rounded-lg px-2.5 py-1 text-[11.5px] font-black", page === k ? "bg-nova/15 text-ink" : "text-ink-3")}>
                  {k === "returns" ? "الاستبدال" : "الشحن"}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4 text-[13px] leading-7 text-ink-2 [&_h2]:mt-4 [&_h2]:text-[14px] [&_h2]:font-black [&_h2]:text-ink [&_li]:ms-4 [&_li]:list-disc">
            <Markdown text={preview} className="" />
          </div>
        </div>
        <a href={`${storeUrl}/pages/${page}`} target="_blank" rel="noopener" className="flex items-center justify-center gap-1.5 text-[12px] font-bold text-ink-3 hover:text-ink">
          افتح الصفحة في متجرك <ExternalLink className="size-3.5" />
        </a>
        <button type="button" onClick={save} disabled={!dirty || pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-nova to-nova-deep text-sm font-black text-white shadow-xl shadow-nova/30 transition disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {dirty ? "احفظ السياسات" : "محفوظة"}
        </button>
      </aside>
    </div>
  );
}
