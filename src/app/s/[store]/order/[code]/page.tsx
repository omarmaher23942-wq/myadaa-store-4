import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Search } from "lucide-react";
import { requireStore, getBlueprint } from "@/lib/tenant";
import { getOrderByCode, getOrderByCodeAndPhone } from "@/server/repos/orders";
import { hasOrderAccess } from "@/lib/order-access";
import { formatEgp } from "@/lib/money";
import { governorateName } from "@/lib/egypt";
import { prettyPhone } from "@/lib/phone";
import { TransferProof } from "@/components/storefront/TransferProof";

const SW = 1.75;
/** يقبل الأكواد النقية وكذلك الأكواد القديمة التي قد تحوي رموزاً بدون أن يرمي 404 */
const CODE_RE = /^[A-Z0-9\-_%\[\]]{3,32}$/i;

export const metadata: Metadata = { title: "تفاصيل الطلب", robots: { index: false, follow: false } };

type Props = { params: Promise<{ store: string; code: string }>; searchParams: Promise<{ phone?: string | string[] }> };

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { store: sub, code: rawCode } = await params;
  const { phone } = await searchParams;
  const code = safeDecode(rawCode).trim().toUpperCase();
  if (!CODE_RE.test(code)) notFound();

  const store = await requireStore(sub);
  const [bp, cookieAccess] = await Promise.all([getBlueprint(store.id), hasOrderAccess(store.id, code)]);
  const legacyPhone = typeof phone === "string" && phone ? phone : undefined;

  // الوصول: cookie الطلب المباشر بعد الشراء أو برابط التتبع
  const o = cookieAccess
    ? await getOrderByCode(store.id, code)
    : legacyPhone
    ? await getOrderByCodeAndPhone(store.id, code, legacyPhone)
    : await getOrderByCode(store.id, code);

  if (!o) {
    return (
      <div className="container-x max-w-md py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
          <Search strokeWidth={SW} className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl">افتح طلبك من صفحة التتبع</h1>
        <p className="mt-2 text-muted-foreground">لحماية بياناتك، اكتب رقم الطلب ورقم الموبايل اللي طلبت بيه.</p>
        <Link href={`/track?code=${encodeURIComponent(code)}`} className="btn-brand mt-6">تتبع الطلب</Link>
      </div>
    );
  }

  const transfer = o.paymentMethod !== "cod";
  const target = o.paymentMethod === "vodafone_cash" ? bp.payments.vodafoneCash.number : (bp.payments.instapay.address ?? bp.payments.instapay.number);

  return (
    <div className="container-x max-w-2xl py-12 text-center">
      <CheckCircle2 strokeWidth={SW} className="mx-auto size-16 text-success" />
      <h1 className="mt-4 text-3xl">تم استلام طلبك</h1>
      <p className="mt-2 text-muted-foreground">رقم طلبك</p>
      <p className="text-3xl font-black tracking-widest text-primary" dir="ltr">{o.code}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        احتفظ بالرقم لتتبع طلبك. هنتواصل معاك على <span dir="ltr">{prettyPhone(o.customerPhone)}</span> للتأكيد.
      </p>

      {transfer && (
        <div className="surface mt-8 p-6 text-start">
          <h2 className="text-lg">أكمل الدفع بالتحويل</h2>
          <p className="mt-2">
            حوّل <b className="text-primary">{formatEgp(o.totalPiasters)}</b> على {o.paymentMethod === "vodafone_cash" ? "فودافون كاش" : "إنستاباي"}
            {target && <>: <b dir="ltr" className="select-all">{target}</b></>}
          </p>
          {bp.payments.transferInstructions && <p className="mt-2 text-sm text-muted-foreground">{bp.payments.transferInstructions}</p>}
          {bp.payments.requireTransferProof && (
            <TransferProof subdomain={store.subdomain} code={o.code} accessPhone={cookieAccess ? undefined : legacyPhone} />
          )}
        </div>
      )}

      <div className="surface mt-8 p-6 text-start">
        <h2 className="mb-3 text-lg">تفاصيل الطلب</h2>
        <ul className="divide-y text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>{i.name}{i.variantLabel && ` (${i.variantLabel})`} × {i.quantity}</span>
              <span className="shrink-0">{formatEgp(i.totalPiasters)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          <p className="flex justify-between"><span>الشحن إلى {governorateName(o.governorate)}</span><span>{formatEgp(o.shippingPiasters + o.codFeePiasters)}</span></p>
          {o.discountPiasters > 0 && <p className="flex justify-between text-success"><span>خصم</span><span>- {formatEgp(o.discountPiasters)}</span></p>}
          <p className="flex justify-between text-lg font-black"><span>الإجمالي</span><span>{formatEgp(o.totalPiasters)}</span></p>
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link href={`/track?code=${encodeURIComponent(o.code)}`} className="btn-brand">تتبع الطلب</Link>
        <Link href="/" className="rounded-lg border-2 px-5 py-3 font-semibold">متابعة التسوق</Link>
      </div>
    </div>
  );
}