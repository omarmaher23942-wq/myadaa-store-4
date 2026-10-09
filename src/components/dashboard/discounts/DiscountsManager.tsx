"use client";

// DiscountsManager — أكواد الخصم: لكل كود حالته الآن (يعمل، موقوف، يبدأ لاحقاً، انتهى، نفد) وشروطه بجملة واضحة وأثره
// الحقيقي من الطلبات (طلبات استخدمته، والمسلَّم منها ومبيعاته، وما خُصم)، ورابط يطبّق الكود تلقائياً عند الدفع
// للمشاركة على واتساب وفيسبوك، وتشغيل وإيقاف بضغطة، وتعديل وحذف.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Edit3, Link2, MessageCircle, Plus, TicketPercent, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, storeUrl } from "@/lib/utils";
import { formatEgp } from "@/lib/money";
import { arCount, fmtNum, NOUN } from "@/lib/format";
import { DISCOUNT_STATE, discountConditions, discountState, discountValueLabel } from "@/lib/discounts";
import { TONE_CHIP } from "@/lib/order-status";
import { deleteDiscountAction, setDiscountActiveAction } from "@/server/actions/discounts";
import type { DiscountRow } from "@/server/repos/discounts-list";
import { ConfirmDialog } from "../ui/DashDialog";
import { DiscountDialog } from "./DiscountDialog";

export function DiscountsManager({ rows, subdomain, storeName }: { rows: DiscountRow[]; subdomain: string; storeName: string }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [editing, setEditing] = useState<DiscountRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<DiscountRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // الحالة (منتهٍ/يبدأ لاحقاً) تُحسب بعد التركيب بساعة الجهاز، فلا يختلف العرض بين الخادم والمتصفح.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  useEffect(() => setList(rows), [rows]);

  const shareUrl = (code: string) => storeUrl(subdomain, `/?promo=${encodeURIComponent(code)}`);

  async function copy(text: string, key: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(msg);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
    } catch {
      toast.error("تعذر النسخ؛ انسخه يدوياً");
    }
  }

  async function toggle(d: DiscountRow) {
    const prev = list;
    setList(list.map((x) => (x.id === d.id ? { ...x, isActive: !d.isActive } : x)));
    const r = await setDiscountActiveAction(d.id, !d.isActive).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
    if (!r.ok) {
      setList(prev);
      return void toast.error(r.error);
    }
    toast.success(d.isActive ? `أُوقف ${d.code}` : `${d.code} يعمل الآن`);
  }

  const working = now === null ? 0 : list.filter((d) => discountState(d, now) === "active").length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink">أكواد الخصم</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {list.length ? `${arCount(list.length, NOUN.code)}${now !== null ? `، يعمل منها الآن ${fmtNum(working)}` : ""}.` : "كود يكتبه العميل عند الدفع فيحصل على خصم أو شحن مجاني."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[12.5px] font-black text-white shadow-md transition-shadow hover:shadow-lg"
        >
          <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
          كود جديد
        </button>
      </header>

      {list.length ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {list.map((d) => {
            const st = now === null ? null : DISCOUNT_STATE[discountState(d, now)];
            const conds = discountConditions(d);
            const wa = `https://wa.me/?text=${encodeURIComponent(`${discountValueLabel(d)} من ${storeName} بكود ${d.code}${conds.length ? ` (${conds.join("، ")})` : ""}.\n${shareUrl(d.code)}`)}`;
            const pct = d.maxUses ? Math.min(100, Math.round((d.usedCount / d.maxUses) * 100)) : null;
            return (
              <li key={d.id} className={cn("dash-card flex flex-col gap-3 p-4", !d.isActive && "opacity-75")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copy(d.code, `c:${d.id}`, `نُسخ ${d.code}`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-nova/40 bg-nova/[0.06] px-2.5 py-1 font-mono text-[15px] font-black tracking-wider text-ink hover:bg-nova/10"
                        dir="ltr"
                        aria-label={`انسخ الكود ${d.code}`}
                      >
                        {d.code}
                        {copied === `c:${d.id}` ? <Check className="size-3.5 text-ok" aria-hidden="true" /> : <Copy className="size-3.5 text-ink-3" aria-hidden="true" />}
                      </button>
                      {st ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-black", TONE_CHIP[st.tone])}>{st.label}</span> : null}
                    </p>
                    <p className="mt-2 text-[15px] font-black text-ink">{discountValueLabel(d)}</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-ink-3">{conds.length ? conds.join(" · ") : "لكل الطلبات، بلا حد"}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={d.isActive}
                    onClick={() => toggle(d)}
                    aria-label={d.isActive ? `إيقاف ${d.code}` : `تشغيل ${d.code}`}
                    className={cn("relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors", d.isActive ? "bg-nova" : "bg-edge/15")}
                  >
                    <span className={cn("size-6 rounded-full bg-white shadow transition-transform", d.isActive ? "-translate-x-5" : "translate-x-0")} />
                  </button>
                </div>

                <dl className="grid grid-cols-3 gap-2 rounded-xl bg-edge/[0.03] p-2.5 text-center">
                  <div>
                    <dt className="text-[10.5px] font-bold text-ink-3">طلبات</dt>
                    <dd className="text-[14px] font-black tabular-nums text-ink">{fmtNum(d.orders)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-bold text-ink-3">مبيعات مسلّمة</dt>
                    <dd className="truncate text-[14px] font-black tabular-nums text-ink">{d.salesPiasters ? formatEgp(d.salesPiasters) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-bold text-ink-3">خصمت</dt>
                    <dd className="truncate text-[14px] font-black tabular-nums text-ink">{d.givenPiasters ? formatEgp(d.givenPiasters) : "—"}</dd>
                  </div>
                </dl>

                {pct !== null ? (
                  <div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-edge/[0.08]" role="progressbar" aria-valuenow={d.usedCount} aria-valuemin={0} aria-valuemax={d.maxUses!} aria-label="مرات الاستخدام">
                      <div className={cn("h-full rounded-full", pct >= 100 ? "bg-warn" : "bg-nova")} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-3">
                      استُخدم {fmtNum(d.usedCount)} من {fmtNum(d.maxUses!)}
                    </p>
                  </div>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-edge/[0.06] pt-3">
                  <button type="button" onClick={() => copy(shareUrl(d.code), `l:${d.id}`, "نُسخ رابط يطبّق الكود تلقائياً")} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5 hover:text-ink">
                    {copied === `l:${d.id}` ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
                    رابط بالكود
                  </button>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-ok/25 px-3 text-[12px] font-bold text-ok hover:bg-ok/10">
                    <MessageCircle className="size-4" aria-hidden="true" />
                    شارك
                  </a>
                  <span className="ms-auto flex gap-1.5">
                    <button type="button" onClick={() => setEditing(d)} aria-label={`تعديل ${d.code}`} title="تعديل" className="grid size-10 place-items-center rounded-xl border border-edge/10 text-ink-2 hover:bg-edge/5">
                      <Edit3 className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setDeleting(d)} aria-label={`حذف ${d.code}`} title="حذف" className="grid size-10 place-items-center rounded-xl border border-bad/20 text-bad hover:bg-bad/10">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="dash-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-nova/12 text-nova-2">
            <TicketPercent className="size-7" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <p className="text-[15px] font-black text-ink">لا أكواد خصم بعد</p>
          <p className="max-w-md text-[12.5px] leading-6 text-ink-3">
            أنشئ كوداً مثل خصم 10% لأول طلب أو شحن مجاني فوق مبلغ معين، وشارك رابطه: من يفتحه يجد الكود مطبَّقاً عند الدفع.
          </p>
          <button type="button" onClick={() => setEditing("new")} className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md">
            <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
            أنشئ أول كود
          </button>
        </div>
      )}

      <DiscountDialog
        discount={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={(code, isNew) => {
          setEditing(null);
          toast.success(isNew ? `أُنشئ ${code}` : `حُفظ ${code}`);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`حذف ${deleting?.code ?? ""}؟`}
        description={
          deleting?.orders
            ? `يتوقف الكود فوراً. ${arCount(deleting.orders, NOUN.order)} استخدمته تبقى بخصمها كما هي. لإيقافه مؤقتاً استخدم المفتاح بدلاً من الحذف.`
            : "يتوقف الكود فوراً ولا يمكن استرجاعه."
        }
        confirmLabel="احذف الكود"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return true;
          const r = await deleteDiscountAction(deleting.id).catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          setList(list.filter((x) => x.id !== deleting.id));
          toast.success(`حُذف ${deleting.code}`);
          return true;
        }}
      />
    </div>
  );
}
