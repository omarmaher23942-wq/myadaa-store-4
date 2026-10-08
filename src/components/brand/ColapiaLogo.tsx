import Image from "next/image";
import { cn } from "@/lib/utils";

interface ColapiaLogoProps {
  size?: number;
  wordmark?: boolean;
  priority?: boolean;
  className?: string;
}

export function ColapiaLogo({
  size = 32,
  wordmark = true,
  priority = false,
  className,
}: ColapiaLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span
        className="relative inline-block shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.png"
          alt="Colapia"
          fill
          priority={priority}
          sizes={`${size}px`}
          className="object-contain drop-shadow-[0_0_16px_rgba(111,134,255,0.45)]"
        />
      </span>
      {wordmark && (
        <span className="text-mercury text-xl font-black tracking-tight" dir="ltr">
          Colapia
        </span>
      )}
    </span>
  );
}