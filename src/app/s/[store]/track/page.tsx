import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Check, ChevronLeft, PackageCheck, Smartphone } from "lucide-react";
import { requireStore } from "@/lib/tenant";
import { getOrderByCode, getOrderByCodeAndPhone, listDeviceOrders } from "@/server/repos/orders";
import { currentDeviceId, hasOrderAccess } from "@/lib/order-access";
import { formatEgp } from "@/lib/money";
import { AutoRefresh } from "@/components/storefront/AutoRefresh";
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

export const metadata: Metadata = { title: "طلباتي", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = Object.fromEntries([...STEPS, ["cancelled", "ملغي"], ["returned", "مرتجع"]]);
const ACTIVE = new Set(["new", "confirmed", "preparing", "shipped"]);

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

  const device = await currentDeviceId();
  const mine = device ? await listDeviceOrders(store.id, device) : [];

  if (CODE_RE.test(code)) {
    const found = await getOrderByCode(store.id, code);
    if (found && (await hasOrderAccess(store.id, code, found.visitorId))) {
      o = found;
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
      {mine.some((m) => ACTIVE.has(m.status)) || (o && ACTIVE.has(o.status)) ? <AutoRefresh everyMs={30_000} /> : null}
      <h1 className="mb-2 text-3xl">{mine.length ? "طلباتي" : "تتبع طلبك"}</h1>
      {mine.length ? (
        <p className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Smartphone strokeWidth={SW} className="size-4" aria-hidden="true" /> محفوظة على هذا الجهاز، فلا تحتاج لحفظ رقم الطلب.
        </p>
      ) : null}

      {mine.length ? (
        <ul className="mb-8 space-y-2.5">
          {mine.map((m) => {
            const active = ACTIVE.has(m.status);
            const selected = o?.code === m.code;
            return (
              <li key={m.id}>
                <Link
                  href={`/track?code=${encodeURIComponent(m.code)}`}
                  scroll={false}
                  aria-current={selected ? "true" : undefined}
                  className={cn("surface flex items-center gap-3 p-4 transition-shadow hover:shadow-md", selected && "ring-2 ring-primary/40")}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    <PackageCheck strokeWidth={SW} className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <b dir="ltr" className="font-mono">{m.code}</b>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        {LABEL[m.status] ?? m.status}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {m.createdAt.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })} · {formatEgp(m.total)}
                    </span>
                  </span>
                  <ChevronLeft strokeWidth={SW} className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {mine.length ? <h2 className="mb-3 text-base font-bold">طلبت من جهاز آخر؟</h2> : null}
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
