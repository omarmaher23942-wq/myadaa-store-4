// Root loading — مؤشر هادئ للمسارات العامة.
import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div
      dir="rtl"
      className="grid min-h-dvh place-items-center bg-[#07091a] px-6 py-16 text-[#eaf0ff]"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-14" aria-hidden="true">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/[0.06] border-t-[#6f86ff]" />
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="size-5 animate-pulse text-[#8fa8ff]" strokeWidth={2} />
          </div>
        </div>
        <p className="text-xs font-bold text-[#8d97c4]" role="status" aria-live="polite">
          جارٍ التحميل…
        </p>
      </div>
    </div>
  );
}