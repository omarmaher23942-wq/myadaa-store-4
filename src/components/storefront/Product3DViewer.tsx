"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function Product3DViewer({
  src,
  iosSrc,
  alt,
}: {
  src: string;
  iosSrc?: string;
  alt: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    import("@google/model-viewer").then(() => setMounted(true));
  }, []);

  if (!mounted) {
    return (
      <div className="grid h-full w-full place-items-center bg-[var(--muted)]">
        <Loader2 className="size-8 animate-spin text-[var(--primary)] opacity-50" />
      </div>
    );
  }

  const modelViewerProps = {
    src,
    "ios-src": iosSrc,
    alt,
    "auto-rotate": true,
    "camera-controls": true,
    "shadow-intensity": "1",
    exposure: "1",
    "environment-image": "neutral",
    style: {
      width: "100%",
      height: "100%",
      backgroundColor: "transparent",
    },
  } as any;

  return (
    <div
      className="h-full w-full bg-[var(--muted)] relative"
      dir="ltr"
    >
      <model-viewer {...modelViewerProps}>
        <div
          slot="progress-bar"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <Loader2 className="size-8 animate-spin text-[var(--primary)]" />
        </div>
      </model-viewer>
    </div>
  );
}