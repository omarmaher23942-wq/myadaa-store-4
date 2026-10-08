import type { Metadata } from "next";
import { headers } from "next/headers";
import { Check } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getOrderByCode, getOrderByCodeAndPhone } from "@/server/repos/orders";
import { hasOrderAccess } from "@/lib/order-access";
import { allow, clientIp } from "@/lib/ratelimit";
import { trackOrderAction } from "@/server/actions/track";
import { cn } from "@/lib/utils";

const SW = 1.75;
const CODE_RE = /^[A-Z0-9-]{3,20}$/;
const STEPS = [
  ["new", "تم الاستلام"],
  ["confirmed", "تم التأكيد"],
  ["preparing", "جاري التجهيز"],
  ["shipped", "مع شركة الشحن"],
  ["delivered", "تم التوصيل"],
] as const;

export const metadata: Metadata = { title: "تتبع الطلب", robots: { index: false, follow: false } };

type SP = { code?: string | string[]; phone?: string | string[]; e?: string | string[] };
type Props = { params: Promise<{ store: string }>; searchParams: Promise<SP> };
type Order = Awaited<ReturnType<typeof getOrderByCode>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const INPUT = "rounded-lg border bg-background px-3 py-3 outline-none focus:ring-2 ring-primary/30";

export default async function TrackPage({ params, searchParams }: Props) {
  const { store: sub } = await params;
  const sp = await searchParams;
  const store = await requireStore(sub);

  const code = one(sp.code).trim().toUpperCase().slice(0, 20);
  const legacyPhone = one(sp.phone);
  let limited = one(sp.e) === "limited";
  let missing = one(sp.e) === "notfound";
  let o: Order = null;

  if (CODE_RE.test(code)) {
    if (await hasOrderAccess(store.id, code)) {
      o = await getOrderByCode(store.id, code);
    } else if (legacyPhone) {
      // روابط قديمة فيها الموبايل: مدعومة مع حد المحاولات
      if (await allow("track", clientIp(await headers()))) {
        o = await getOrderByCodeAndPhone(store.id, code, legacyPhone);
        if (!o) missing = true;
      } else {
        limited = true;
      }
    }
  }

  const idx = o ? STEPS.findIndex(([k]) => k === o!.status) : -1;
  const bad = !!o && (o.status === "cancelled" || o.status === "returned");

  return (
    <div className="container-x max-w-xl py-12">
      <h1 className="mb-6 text-3xl">تتبع طلبك</h1>

      <form action={trackOrderAction.bind(null, store.subdomain)} className="surface grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
        <input name="code" defaultValue={code} placeholder="رقم الطلب (CLP-XXXXX)" dir="ltr" maxLength={20} className={cn(INPUT, "uppercase")} required />
        <input name="phone" placeholder="رقم الموبايل" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} className={INPUT} required />
        <button type="submit" className="btn-brand">تتبع</button>
      </form>

      {limited && <p className="mt-4 text-danger">محاولات كثيرة، حاول بعد دقائق</p>}
      {missing && !limited && !o && <p className="mt-4 text-danger">مش لاقيين طلب بالبيانات دي. اتأكد من رقم الطلب والموبايل.</p>}

      {o && (
        <div className="surface mt-6 p-6">
          <p className="text-sm text-muted-foreground">الطلب</p>
          <p className="text-2xl font-black text-primary" dir="ltr">{o.code}</p>

          {bad ? (
            <p className="mt-4 rounded-lg bg-danger/10 p-3 font-bold text-danger">
              {o.status === "cancelled" ? "تم إلغاء هذا الطلب" : "تم إرجاع هذا الطلب"}
            </p>
          ) : (
            <ol className="mt-6 space-y-4">
              {STEPS.map(([k, label], i) => {
                const h = o!.statusHistory.find((x) => x.status === k);
                const done = i <= idx;
                return (
                  <li key={k} className="flex items-center gap-4">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {done ? <Check strokeWidth={SW} className="size-4" aria-hidden="true" /> : i + 1}
                    </span>
                    <div className="flex-1">
                      <p className={cn("font-bold", !done && "text-muted-foreground")}>{label}</p>
                      {h && <p className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo" })}</p>}
                    </div>
                    {i === idx && <span className="animate-pulse text-xs font-bold text-primary">الحالة الحالية</span>}
                  </li>
                );
              })}
            </ol>
          )}

          {o.trackingNumber && (
            <p className="mt-4 text-sm">
              رقم الشحنة: <b dir="ltr">{o.trackingNumber}</b> {o.courierName && `(${o.courierName})`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
