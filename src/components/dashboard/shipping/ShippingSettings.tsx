"use client";

// ShippingSettings — الشحن كما يحسبه الدفع فعلاً (checkout.ts): المحافظة غير المفعّلة لا تُطلب منها طلبات، والشحن المجاني
// يسبق أي سعر، ثم السعر الموحد إن اختاره التاجر، وإلا سعر المحافظة. رسوم الدفع عند الاستلام ومدة التوصيل لكل محافظة في
// كل الأحوال. المحافظات مجمّعة بالمنطقة مع تعديل جماعي للمنطقة، وشريط حفظ يظهر مع أي تعديل.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, MapPin, RotateCcw, Save, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { fmtNum } from "@/lib/format";
import { GOVERNORATES, type ShippingGroup } from "@/lib/egypt";
import { saveShippingSettingsAction } from "@/server/actions/shipping";
import { Field, inputCls, Section, Switch } from "../product/parts";
import { toNumber } from "../product/model";

export type ZoneRow = { governorate: string; fee: string; codExtra: string; etaMin: string; etaMax: string; isActive: boolean };
export type ShippingState = { zones: ZoneRow[]; mode: "zones" | "flat"; flatRate: string; freeOn: boolean; freeOver: string; generalEta: string };

const GROUPS: { key: ShippingGroup; label: string }[] = [
  { key: "gc", label: "القاهرة الكبرى" },
  { key: "alex", label: "الإسكندرية" },
  { key: "delta", label: "الدلتا" },
  { key: "canal", label: "مدن القناة" },
  { key: "upper", label: "الصعيد" },
  { key: "remote", label: "المحافظات الحدودية" },
];
const NAME = new Map<string, string>(GOVERNORATES.map((g) => [g.code, g.name]));
const GROUP_OF = new Map<string, ShippingGroup>(GOVERNORATES.map((g) => [g.code, g.group]));

const num = (s: string) => {
  const n = toNumber(s);
  return n === null || Number.isNaN(n) ? null : n;
};

export function ShippingSettings({ initial }: { initial: ShippingState }) {
  const router = useRouter();
  const [st, setSt] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [badGov, setBadGov] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<ShippingGroup | null>("gc");
  const dirty = JSON.stringify(st) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const setZone = (gov: string, p: Partial<ZoneRow>) => {
    setSt((s) => ({ ...s, zones: s.zones.map((z) => (z.governorate === gov ? { ...z, ...p } : z)) }));
    if (badGov === gov) setBadGov(null);
  };
  const setGroup = (g: ShippingGroup, p: Partial<ZoneRow>) => setSt((s) => ({ ...s, zones: s.zones.map((z) => (GROUP_OF.get(z.governorate) === g ? { ...z, ...p } : z)) }));

  const active = st.zones.filter((z) => z.isActive);
  const fees = active.map((z) => num(z.fee)).filter((n): n is number => n !== null);
  const summary =
    st.mode === "flat"
      ? `${num(st.flatRate) !== null ? formatEgp(Math.round(num(st.flatRate)! * 100)) : "—"} لأي محافظة`
      : fees.length
        ? Math.min(...fees) === Math.max(...fees)
          ? `${formatEgp(Math.round(fees[0]! * 100))} لكل المحافظات`
          : `من ${formatEgp(Math.round(Math.min(...fees) * 100))} إلى ${formatEgp(Math.round(Math.max(...fees) * 100))}`
        : "—";

  async function save() {
    setSaving(true);
    const r = await saveShippingSettingsAction({
      zones: st.zones.map((z) => ({ governorate: z.governorate, fee: num(z.fee) ?? -1, codExtra: num(z.codExtra) ?? 0, etaMin: num(z.etaMin) ?? 0, etaMax: num(z.etaMax) ?? 0, isActive: z.isActive })),
      mode: st.mode,
      flatRate: st.mode === "flat" ? num(st.flatRate) : null,
      freeOver: st.freeOn ? num(st.freeOver) : null,
      generalEta: st.generalEta,
    }).catch(() => ({ ok: false as const, error: "انقطع الاتصال، حاول مرة أخرى", governorate: undefined }));
    setSaving(false);
    if (!r.ok) {
      toast.error(r.governorate ? `${NAME.get(r.governorate)}: ${r.error}` : r.error);
      if (r.governorate) {
        setBadGov(r.governorate);
        setOpenGroup(GROUP_OF.get(r.governorate) ?? null);
      }
      return;
    }
    setSaved(JSON.stringify(st));
    toast.success("حُفظ الشحن، ويظهر للعملاء في صفحة الدفع الآن");
    router.refresh();
  }

  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, zones: st.zones.filter((z) => GROUP_OF.get(z.governorate) === g.key) })), [st.zones]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-4"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">الشحن</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            متاح في {fmtNum(active.length)} من {fmtNum(st.zones.length)} محافظة · {summary}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="طريقة حساب سعر الشحن">
          <div role="radiogroup" aria-label="طريقة الحساب" className="grid gap-2">
            {(
              [
                ["zones", "حسب المحافظة", "سعر لكل محافظة من الجدول أدناه."],
                ["flat", "سعر واحد لكل المحافظات", "يُطبَّق على كل المحافظات المفعّلة."],
              ] as const
            ).map(([k, label, hint]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={st.mode === k}
                onClick={() => setSt({ ...st, mode: k })}
                className={cn("rounded-xl border p-3 text-start transition-colors", st.mode === k ? "border-nova/50 bg-nova/[0.08]" : "border-edge/10 hover:bg-edge/[0.03]")}
              >
                <span className="flex items-center gap-2 text-[13px] font-black text-ink">
                  <span className={cn("grid size-4 place-items-center rounded-full border-2", st.mode === k ? "border-nova" : "border-edge/25")}>{st.mode === k ? <span className="size-2 rounded-full bg-nova" /> : null}</span>
                  {label}
                </span>
                <span className="mt-0.5 block ps-6 text-[11.5px] text-ink-3">{hint}</span>
              </button>
            ))}
          </div>
          {st.mode === "flat" ? (
            <Field label="السعر الموحد (ج.م)">
              {(p) => <input {...p} value={st.flatRate} onChange={(e) => setSt({ ...st, flatRate: e.target.value })} inputMode="decimal" dir="ltr" className={cn(inputCls, "tabular-nums")} placeholder="60" />}
            </Field>
          ) : null}
        </Section>

        <Section title="الشحن المجاني والمدة">
          <Switch
            checked={st.freeOn}
            onChange={(v) => setSt({ ...st, freeOn: v })}
            label="شحن مجاني فوق مبلغ"
            hint={st.freeOn ? "ويظهر للعميل شريط «باقي X ج.م للشحن المجاني» في السلة." : "يشجع العميل على إضافة منتج آخر."}
          />
          {st.freeOn ? (
            <Field label="للطلبات من (ج.م)" hint="قبل الشحن والخصم.">
              {(p) => <input {...p} value={st.freeOver} onChange={(e) => setSt({ ...st, freeOver: e.target.value })} inputMode="decimal" dir="ltr" className={cn(inputCls, "tabular-nums")} placeholder="1000" />}
            </Field>
          ) : null}
          <Field label="مدة التوصيل المعتادة" hint="جملة تظهر في صفحة المنتج وسياسة الشحن.">
            {(p) => <input {...p} value={st.generalEta} onChange={(e) => setSt({ ...st, generalEta: e.target.value })} maxLength={80} className={inputCls} />}
          </Field>
        </Section>
      </div>

      <section className="dash-card overflow-hidden" aria-labelledby="zones-h">
        <header className="border-b border-edge/[0.06] p-4">
          <h2 id="zones-h" className="flex items-center gap-1.5 text-[14px] font-black text-ink">
            <MapPin className="size-4 text-ink-3" aria-hidden="true" />
            المحافظات
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-3">أوقف المحافظة التي لا تشحن لها فلا تظهر للعميل. ورسوم الدفع عند الاستلام تُضاف لمن يختاره فقط.</p>
        </header>
        <ul className="divide-y divide-edge/[0.06]">
          {groups.map((g) => {
            const on = g.zones.filter((z) => z.isActive).length;
            const open = openGroup === g.key;
            return (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? null : g.key)}
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-start hover:bg-edge/[0.025]"
                >
                  <span>
                    <span className="block text-[13.5px] font-black text-ink">{g.label}</span>
                    <span className="text-[11.5px] text-ink-3">
                      {on === g.zones.length ? `${fmtNum(on)} مفعّلة` : on ? `${fmtNum(on)} من ${fmtNum(g.zones.length)} مفعّلة` : "متوقفة"}
                      {st.mode === "zones" && on ? ` · ${groupFees(g.zones)}` : ""}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-5 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden="true" />
                </button>
                {open ? (
                  <div className="space-y-2 px-4 pb-4">
                    {g.zones.length > 1 ? <GroupTools mode={st.mode} onApply={(p) => setGroup(g.key, p)} /> : null}
                    {g.zones.map((z) => (
                      <ZoneLine key={z.governorate} z={z} mode={st.mode} bad={badGov === z.governorate} onChange={(p) => setZone(z.governorate, p)} />
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {dirty || saving ? (
        <div data-savebar className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 md:bottom-4">
          <div className="dash-card flex items-center justify-between gap-3 border-nova/30 p-2.5 ps-4 shadow-2xl shadow-black/20">
            <p className="text-[12.5px] font-bold text-ink-2">{saving ? "نحفظ…" : "تعديلات غير محفوظة"}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSt(JSON.parse(saved) as ShippingState)} disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold text-ink-3 hover:bg-edge/5 hover:text-ink">
                <RotateCcw className="size-4" aria-hidden="true" />
                تراجع
              </button>
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
                احفظ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function groupFees(zones: ZoneRow[]): string {
  const f = zones.filter((z) => z.isActive).map((z) => num(z.fee)).filter((n): n is number => n !== null);
  if (!f.length) return "";
  const lo = Math.min(...f);
  const hi = Math.max(...f);
  return lo === hi ? formatEgp(Math.round(lo * 100)) : `${fmtNum(lo)}–${formatEgp(Math.round(hi * 100))}`;
}

const small = "min-h-10 w-full rounded-lg border border-edge/10 bg-edge/[0.03] px-2 text-center text-[13px] font-bold tabular-nums text-ink outline-none focus:border-nova/60 focus:ring-2 focus:ring-nova/20";

function ZoneLine({ z, mode, bad, onChange }: { z: ZoneRow; mode: ShippingState["mode"]; bad: boolean; onChange: (p: Partial<ZoneRow>) => void }) {
  const name = NAME.get(z.governorate) ?? z.governorate;
  return (
    <div className={cn("rounded-xl border p-3", bad ? "border-bad/50 bg-bad/[0.04]" : "border-edge/[0.07]", !z.isActive && "opacity-60")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-black text-ink">
          <Truck className="size-4 text-ink-3" aria-hidden="true" />
          {name}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={z.isActive}
          aria-label={`الشحن إلى ${name}`}
          onClick={() => onChange({ isActive: !z.isActive })}
          className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors", z.isActive ? "bg-nova" : "bg-edge/15")}
        >
          <span className={cn("size-6 rounded-full bg-white shadow transition-transform", z.isActive ? "-translate-x-5" : "translate-x-0")} />
        </button>
      </div>
      {z.isActive ? (
        <div className={cn("mt-2.5 grid gap-2 md:max-w-lg", mode === "zones" ? "grid-cols-3" : "grid-cols-2")}>
          {mode === "zones" ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-ink-3">الشحن ج.م</span>
              <input value={z.fee} onChange={(e) => onChange({ fee: e.target.value })} inputMode="decimal" dir="ltr" aria-label={`سعر الشحن إلى ${name}`} className={small} />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-ink-3">+ عند الاستلام</span>
            <input value={z.codExtra} onChange={(e) => onChange({ codExtra: e.target.value })} inputMode="decimal" dir="ltr" aria-label={`رسوم الدفع عند الاستلام في ${name}`} className={small} placeholder="0" />
          </label>
          <div>
            <span className="mb-1 block text-[11px] font-bold text-ink-3">المدة (أيام)</span>
            <span className="flex items-center gap-1" dir="ltr">
              <input value={z.etaMin} onChange={(e) => onChange({ etaMin: e.target.value })} inputMode="numeric" aria-label={`أقل مدة توصيل إلى ${name}`} className={small} />
              <span className="text-ink-3">–</span>
              <input value={z.etaMax} onChange={(e) => onChange({ etaMax: e.target.value })} inputMode="numeric" aria-label={`أقصى مدة توصيل إلى ${name}`} className={small} />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupTools({ mode, onApply }: { mode: ShippingState["mode"]; onApply: (p: Partial<ZoneRow>) => void }) {
  const [fee, setFee] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-edge/[0.03] p-2.5 text-[12px]">
      <span className="font-bold text-ink-2">للمنطقة كلها:</span>
      {mode === "zones" ? (
        <span className="flex items-center gap-1">
          <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" dir="ltr" placeholder="السعر" aria-label="سعر الشحن للمنطقة كلها" className="min-h-9 w-20 rounded-lg border border-edge/10 bg-edge/[0.04] px-2 text-center font-bold tabular-nums text-ink outline-none placeholder:font-sans" />
          <button
            type="button"
            disabled={num(fee) === null}
            onClick={() => {
              onApply({ fee });
              setFee("");
            }}
            className="min-h-9 rounded-lg bg-nova/15 px-2.5 font-bold text-nova-2 disabled:opacity-40"
          >
            طبّق
          </button>
        </span>
      ) : null}
      <button type="button" onClick={() => onApply({ isActive: true })} className="min-h-9 rounded-lg px-2.5 font-bold text-ink-2 hover:bg-edge/5">
        فعّل الكل
      </button>
      <button type="button" onClick={() => onApply({ isActive: false })} className="min-h-9 rounded-lg px-2.5 font-bold text-ink-3 hover:bg-edge/5">
        أوقف الكل
      </button>
    </div>
  );
}
