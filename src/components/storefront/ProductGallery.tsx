"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Play,
  Box,
  Smartphone,
  RotateCw,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const SW = 1.75;

type Img = { url: string; alt?: string };
type VideoThumb = { url: string; poster?: string; duration?: number };

type ModelViewerProps = {
  src?: string;
  "ios-src"?: string;
  alt?: string;
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  "shadow-intensity"?: string | number;
  ar?: boolean;
  "ar-modes"?: string;
  style?: React.CSSProperties;
  className?: string;
};

// تعريف عنصر <model-viewer> المخصص لـ JSX يتطلب توسيع namespace (لا بديل نوعي له).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps & React.HTMLAttributes<HTMLElement>;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React.JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps & React.HTMLAttributes<HTMLElement>;
    }
  }
}

export function ProductGallery({
  images,
  videos = [],
  model3dUrl,
  modelUsdzUrl,
  name,
  immersive,
}: {
  images: Img[];
  videos?: VideoThumb[];
  model3dUrl?: string;
  modelUsdzUrl?: string;
  name: string;
  immersive?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [arOpen, setArOpen] = useState(false);
  const [view360, setView360] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const is360 = /\.(glb|gltf)$/i.test(model3dUrl ?? "");

  const mediaItems = useMemo(() => {
    const items: Array<{ kind: "image" | "video" | "model"; index: number }> = [];
    images.forEach((_, i) => items.push({ kind: "image", index: i }));
    videos.forEach((_, i) => items.push({ kind: "video", index: i }));
    if (model3dUrl) items.push({ kind: "model", index: 0 });
    return items;
  }, [images, videos, model3dUrl]);

  const current = images[idx] ?? images[0];
  const activeMedia = mediaItems[Math.min(idx, mediaItems.length - 1)] ?? mediaItems[0];

  const go = useCallback(
    (dir: -1 | 1) => {
      setIdx((cur) => {
        const total = mediaItems.length || 1;
        const n = cur + dir;
        if (n < 0) return total - 1;
        if (n >= total) return 0;
        return n;
      });
    },
    [mediaItems.length]
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") go(-1);
      if (e.key === "ArrowLeft") go(1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox, go]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.children[idx] as HTMLElement | undefined;
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [idx]);

  // View Transitions عند فتح/غلق الـ lightbox
  const openLightbox = useCallback(() => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (reduce || typeof doc.startViewTransition !== "function") {
      setLightbox(true);
      return;
    }
    doc.startViewTransition(() => setLightbox(true));
  }, [reduce]);

  const closeLightbox = useCallback(() => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (reduce || typeof doc.startViewTransition !== "function") {
      setLightbox(false);
      return;
    }
    doc.startViewTransition(() => setLightbox(false));
  }, [reduce]);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setZoomPos({ x, y });
  };

  if (!images.length && !videos.length && !model3dUrl) {
    return (
      <div
        className="aspect-square rounded-3xl border"
        style={{ background: "var(--muted)", borderColor: "var(--border)" }}
        aria-hidden="true"
      />
    );
  }

  const Thumbnails = (
    <div
      ref={stripRef}
      className={cn(
        "hide-scrollbar flex gap-2 overflow-x-auto",
        immersive
          ? "lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:max-h-[560px]"
          : "mt-3"
      )}
      role="tablist"
      aria-label="صور المنتج"
    >
      {images.map((im, k) => (
        <button
          key={`img-${im.url}-${k}`}
          type="button"
          role="tab"
          aria-selected={k === idx}
          aria-label={`صورة ${k + 1}`}
          onClick={() => setIdx(k)}
          className={cn(
            "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2",
            k === idx
              ? "border-[var(--primary)] opacity-100"
              : "border-transparent opacity-60 hover:opacity-100"
          )}
          style={{ background: "var(--muted)" }}
        >
          <Image src={im.url} alt="" fill sizes="64px" className="object-cover" />
        </button>
      ))}
      {videos.map((v, k) => {
        const videoIdx = images.length + k;
        return (
          <button
            key={`vid-${v.url}-${k}`}
            type="button"
            role="tab"
            aria-selected={videoIdx === idx}
            aria-label={`فيديو ${k + 1}`}
            onClick={() => setIdx(videoIdx)}
            className={cn(
              "relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2",
              videoIdx === idx
                ? "border-[var(--primary)] opacity-100"
                : "border-transparent opacity-60 hover:opacity-100"
            )}
            style={{ background: "var(--muted)" }}
          >
            {v.poster ? (
              <Image src={v.poster} alt="" fill sizes="64px" className="object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center bg-black/40">
                <Play className="size-6 fill-white text-white" aria-hidden="true" />
              </span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/30">
              <Play className="size-5 fill-white text-white" aria-hidden="true" />
            </span>
          </button>
        );
      })}
      {model3dUrl ? (
        <button
          type="button"
          role="tab"
          aria-selected={idx === images.length + videos.length}
          aria-label="عرض ثلاثي الأبعاد"
          onClick={() => setIdx(images.length + videos.length)}
          className={cn(
            "relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2",
            idx === images.length + videos.length
              ? "border-[var(--primary)] opacity-100"
              : "border-transparent opacity-60 hover:opacity-100"
          )}
          style={{ background: "var(--muted)" }}
        >
          <Box className="size-6" strokeWidth={SW} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div className={cn(immersive && "lg:grid lg:grid-cols-[80px_1fr] lg:gap-3")}>
        {immersive ? Thumbnails : null}

        {/* Main viewer */}
        <div
          className={cn(
            "group relative aspect-square overflow-hidden rounded-3xl border sm:aspect-[4/3]",
            !reduce && !zooming && "cursor-zoom-in",
            !reduce && zooming && "cursor-zoom-out"
          )}
          style={{ background: "var(--muted)", borderColor: "var(--border)" }}
          onMouseEnter={() => !reduce && setZooming(true)}
          onMouseLeave={() => setZooming(false)}
          onMouseMove={onMouseMove}
          onClick={openLightbox}
          role="button"
          tabIndex={0}
          aria-label="عرض الصورة بملء الشاشة"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openLightbox();
            }
          }}
        >
          {/* Content حسب نوع الوسائط الحالية */}
          {activeMedia?.kind === "video" && videos[activeMedia.index] ? (
            <video
              src={videos[activeMedia.index]!.url}
              poster={videos[activeMedia.index]!.poster}
              controls
              playsInline
              className="h-full w-full object-cover"
            />
          ) : activeMedia?.kind === "model" && model3dUrl ? (
            is360 ? (
              <div className="grid h-full w-full place-items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setView360(true);
                  }}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-black text-[var(--primary-foreground)]"
                >
                  <RotateCw className="size-4" strokeWidth={SW} aria-hidden="true" />
                  عرض 360 درجة
                </button>
              </div>
            ) : (
              <div className="grid h-full w-full place-items-center text-xs opacity-60">
                <Box className="size-10" strokeWidth={1.5} aria-hidden="true" />
              </div>
            )
          ) : current ? (
            <Image
              key={current.url}
              src={current.url}
              alt={current.alt || name}
              fill
              priority
              sizes="(max-width:1024px) 100vw, 50vw"
              className={cn(
                "object-cover transition-transform duration-300",
                zooming && !reduce ? "" : "group-hover:scale-105"
              )}
              style={
                zooming && !reduce
                  ? {
                      transform: "scale(2.5)",
                      transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    }
                  : undefined
              }
            />
          ) : null}

          {/* Zoom Lens marker */}
          {zooming && !reduce && activeMedia?.kind === "image" ? (
            <span
              className="pointer-events-none absolute size-14 rounded-full border-2 border-white/80 shadow-lg"
              style={{
                left: `calc(${zoomPos.x}% - 28px)`,
                top: `calc(${zoomPos.y}% - 28px)`,
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(2px)",
              }}
              aria-hidden="true"
            />
          ) : null}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openLightbox();
            }}
            className="absolute end-3 top-3 grid size-10 place-items-center rounded-xl bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="تكبير الصورة"
          >
            <ZoomIn className="size-4" strokeWidth={SW} aria-hidden="true" />
          </button>

          {arOpen || model3dUrl ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setArOpen(true);
              }}
              className="absolute end-3 top-16 grid size-10 place-items-center rounded-xl bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label="شاهد في مساحتك"
            >
              <Smartphone className="size-4" strokeWidth={SW} aria-hidden="true" />
            </button>
          ) : null}

          {mediaItems.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label="السابق"
                className="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronRight className="size-4" strokeWidth={SW} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                aria-label="التالي"
                className="absolute start-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronLeft className="size-4" strokeWidth={SW} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        {!immersive ? Thumbnails : null}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && current ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-md"
            onClick={closeLightbox}
            role="dialog"
            aria-modal="true"
            aria-label="عرض الصورة"
          >
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="إغلاق"
            >
              <X className="size-5" strokeWidth={SW} aria-hidden="true" />
            </button>

            {mediaItems.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(-1); }}
                  aria-label="السابق"
                  className="absolute end-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="size-6" strokeWidth={SW} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(1); }}
                  aria-label="التالي"
                  className="absolute start-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="size-6" strokeWidth={SW} aria-hidden="true" />
                </button>
              </>
            ) : null}

            {activeMedia?.kind === "video" && videos[activeMedia.index] ? (
              <video
                src={videos[activeMedia.index]!.url}
                controls
                autoPlay
                playsInline
                className="max-h-[85vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : current ? (
              <motion.img
                key={current.url}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.24 }}
                src={current.url}
                alt={name}
                className="max-h-[85vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 360 Viewer */}
      <AnimatePresence>
        {view360 && model3dUrl ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] grid place-items-center bg-black/95 p-4"
            onClick={() => setView360(false)}
            role="dialog"
            aria-modal="true"
            aria-label="عرض 360"
          >
            <button
              type="button"
              onClick={() => setView360(false)}
              className="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white"
              aria-label="إغلاق"
            >
              <X className="size-5" strokeWidth={SW} aria-hidden="true" />
            </button>
            <div
              className="h-[80vh] w-[90vw] overflow-hidden rounded-3xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <model-viewer
                src={model3dUrl}
                ios-src={modelUsdzUrl}
                alt={`عرض ثلاثي الأبعاد لـ ${name}`}
                camera-controls
                auto-rotate
                shadow-intensity="1"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* AR Preview */}
      <AnimatePresence>
        {arOpen && model3dUrl ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] grid place-items-center bg-black/95 p-4"
            onClick={() => setArOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="شاهد في مساحتك"
          >
            <button
              type="button"
              onClick={() => setArOpen(false)}
              className="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white"
              aria-label="إغلاق"
            >
              <X className="size-5" strokeWidth={SW} aria-hidden="true" />
            </button>
            <div
              className="h-[80vh] w-[90vw] overflow-hidden rounded-3xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <model-viewer
                src={model3dUrl}
                ios-src={modelUsdzUrl}
                alt={`شاهد ${name} في مساحتك`}
                ar
                ar-modes="webxr scene-viewer quick-look"
                camera-controls
                shadow-intensity="1"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}