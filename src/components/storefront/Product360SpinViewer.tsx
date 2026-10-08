"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { RotateCw } from "lucide-react";

export function Product360SpinViewer({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX.current;
    
    // تغيير الصورة كل 15 بكسل سحب
    if (Math.abs(deltaX) > 15) {
      const direction = deltaX > 0 ? -1 : 1;
      setIndex((prev) => {
        let next = prev + direction;
        if (next < 0) next = images.length - 1;
        if (next >= images.length) next = 0;
        return next;
      });
      startX.current = e.clientX;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Preload images
  useEffect(() => {
    images.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, [images]);

  if (!images.length) return null;

  return (
    <div 
      ref={containerRef}
      className="relative aspect-square w-full cursor-ew-resize overflow-hidden rounded-3xl bg-[var(--muted)] touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Image
        src={images[index]!}
        alt="360 view"
        fill
        sizes="(max-width: 640px) 100vw, 50vw"
        className="object-cover pointer-events-none"
        priority
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-md px-3 py-1.5 text-[10px] font-bold text-white pointer-events-none">
        <RotateCw className="size-3.5" /> اسحب للدوران 360°
      </div>
    </div>
  );
}