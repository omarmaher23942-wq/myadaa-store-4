import Link from "next/link";
import { Lock, Wrench } from "lucide-react";

const SW = 1.75;

/** يظهر للزوار عندما يكون المتجر مجمدًا أو قيد البناء، بدون كشف أي تفاصيل داخلية */
export function FrozenGate({ status, activateHref = "/admin/activate" }: { status: string; activateHref?: string }) {
  const frozen = status === "frozen";
  const Icon = frozen ? Lock : Wrench;
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20" aria-hidden="true">
          <Icon strokeWidth={SW} className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl">{frozen ? "المتجر محجوز لصاحبه" : "المتجر قيد التجهيز"}</h1>
        <p className="mt-2 text-muted-foreground">
          {frozen ? "لو أنت صاحب المتجر، أكمل التفعيل من لوحة التحكم ليعود المتجر للعمل فورًا." : "هنكون جاهزين قريبًا جدًا."}
        </p>
        {frozen && <Link href={activateHref} className="btn-brand mt-6">تفعيل المتجر</Link>}
      </div>
    </div>
  );
}
