"use client";

import { Smartphone } from "lucide-react";

export function ARPreviewButton({
  src,
  iosSrc,
  alt,
}: {
  src: string;
  iosSrc?: string;
  alt: string;
}) {
  const triggerAR = () => {
    const viewer = document.createElement("model-viewer") as any;
    viewer.src = src;
    if (iosSrc) viewer.iosSrc = iosSrc;
    viewer.alt = alt;
    viewer.ar = true;
    viewer.arModes = "webxr scene-viewer quick-look";
    document.body.appendChild(viewer);

    viewer.addEventListener("load", () => {
      viewer.activateAR();
      setTimeout(() => document.body.removeChild(viewer), 1000);
    });
  };

  return (
    <button
      onClick={triggerAR}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-xs font-black text-[var(--background)] shadow-lg transition-transform hover:scale-105 active:scale-95"
    >
      <Smartphone className="size-4" />
      شاهد المنتج في غرفتك (AR)
    </button>
  );
}