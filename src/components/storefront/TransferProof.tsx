"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { UploadButton } from "@/lib/uploadthing-client";
import { submitTransferProofAction } from "@/server/actions/checkout";
import { normalizeEgyptianPhone } from "@/lib/phone";

const SW = 1.75;

/** رفع إثبات التحويل. accessPhone يُمرر فقط لو الصفحة فُتحت برابط قديم فيه الموبايل (بدون cookie الطلب) */
export function TransferProof({ subdomain, code, accessPhone }: { subdomain: string; code: string; accessPhone?: string }) {
  const [url, setUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const validPhone = normalizeEgyptianPhone(phone) !== null;

  if (done) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 p-3 font-bold text-success">
        <CheckCircle2 strokeWidth={SW} className="size-5 shrink-0" />
        استلمنا إثبات التحويل وهنأكد طلبك في أقرب وقت
      </p>
    );
  }

  const submit = () => start(async () => {
    setErr(null);
    try {
      const r = await submitTransferProofAction(subdomain, { code, senderPhone: phone, screenshotUrl: url, accessPhone });
      if (r.ok) {
        setDone(true);
      } else {
        setErr(r.error);
        toast.error(r.error);
      }
    } catch {
      toast.error("تعذّر الإرسال، حاول تاني");
    }
  });

  return (
    <div className="mt-4 space-y-3">
      <div>
        <input
          className="w-full rounded-lg border bg-background px-3 py-3 outline-none focus:ring-2 ring-primary/30"
          placeholder="الرقم اللي حوّلت منه"
          inputMode="tel"
          dir="ltr"
          maxLength={20}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {phone && !validPhone && <p className="mt-1 text-xs text-danger">اكتب رقم موبايل مصري صحيح</p>}
      </div>

      {url ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="إثبات التحويل" className="max-h-56 rounded-lg border" />
          <button type="button" onClick={() => setUrl("")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <RefreshCw strokeWidth={SW} className="size-4" />تغيير الصورة
          </button>
        </div>
      ) : (
        <UploadButton
          endpoint="transferProof"
          input={{ subdomain }}
          onClientUploadComplete={(r) => setUrl(r[0]?.ufsUrl ?? r[0]?.url ?? "")}
          onUploadError={(e) => { toast.error(e.message || "فشل رفع الصورة"); }}
          content={{ button: "ارفع صورة التحويل" }}
          appearance={{ button: "btn-brand w-full" }}
        />
      )}

      {err && <p className="text-sm text-danger">{err}</p>}

      <button type="button" disabled={!url || !validPhone || pending} onClick={submit} className="btn-brand w-full disabled:opacity-60">
        {pending && <Loader2 strokeWidth={SW} className="size-4 animate-spin" />}
        إرسال إثبات الدفع
      </button>
    </div>
  );
}