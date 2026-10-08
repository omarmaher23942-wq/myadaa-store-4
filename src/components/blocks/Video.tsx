// Video — تضمين Vimeo / YouTube آمن مع lazy loading.
import { SectionShell, SectionHeading } from "@/components/storefront/SectionShell";

type VideoBlock = {
  videoUrl?: string | null;
  title?: string | null;
  id?: string;
  [key: string]: unknown;
};

function parseEmbedUrl(url: string): string | null {
  try {
    if (url.includes("youtube.com/watch")) {
      const v = new URL(url).searchParams.get("v");
      return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
    }
    if (url.includes("youtu.be/")) {
      const v = url.split("youtu.be/")[1]?.split("?")[0];
      return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
    }
    if (url.includes("vimeo.com/")) {
      const v = url.split("vimeo.com/")[1]?.split("?")[0];
      return v ? `https://player.vimeo.com/video/${v}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function Video({ s }: { s: VideoBlock | Record<string, unknown> }) {
  const section = s as Partial<VideoBlock> & { id?: string };
  const shellSection = s as Parameters<typeof SectionShell>[0]["s"];

  const videoUrl = typeof section.videoUrl === "string" ? section.videoUrl : null;
  const title = typeof section.title === "string" ? section.title : null;
  const embedUrl = parseEmbedUrl(videoUrl ?? "");
  if (!embedUrl) return null;

  return (
    <SectionShell s={shellSection}>
      {title ? <SectionHeading title={title} sectionId={section.id} /> : null}
      <div
        className="mx-auto aspect-video max-w-4xl overflow-hidden rounded-3xl border shadow-xl"
        style={{ background: "var(--muted)", borderColor: "var(--border)" }}
      >
        <iframe
          src={embedUrl}
          className="size-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          title={title || "فيديو المتجر"}
        />
      </div>
    </SectionShell>
  );
}