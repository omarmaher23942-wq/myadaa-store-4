// src/lib/email-templates/GenericEmail.tsx — قالب عام موحد.
// الإصلاح الجذري:
// - EmailLayout الآن يستقبل `brand` ككائن موحّد بدلاً من `storeName` مباشرة.
// - نُمرّر brand بالحقول المطلوبة (storeName, primaryColor, logoUrl, poweredByColapia).
import {
  EmailLayout,
  EmailHeading,
  EmailParagraph,
  EmailButton,
} from "./_layout";

export function GenericEmail({
  storeName,
  headline,
  paragraphs,
  buttons,
  primaryColor = "#0f766e",
  logoUrl,
}: {
  storeName: string;
  headline?: string;
  paragraphs: string[];
  buttons?: { title: string; url: string }[];
  primaryColor?: string;
  logoUrl?: string;
}) {
  const safeButtons = (buttons ?? []).filter((b) =>
    /^https?:\/\//i.test(b.url)
  );

  return (
    <EmailLayout
      brand={{
        storeName,
        primaryColor,
        logoUrl,
        poweredByColapia: true,
      }}
      preheader={headline ?? paragraphs[0]?.slice(0, 120)}
      footerNote={`تم الإرسال تلقائياً من منصة Colapia.`}
    >
      {headline ? <EmailHeading>{headline}</EmailHeading> : null}
      {paragraphs.map((p, i) => (
        <EmailParagraph key={i}>{p}</EmailParagraph>
      ))}
      {safeButtons.length > 0 ? (
        <div style={{ marginTop: "20px" }}>
          {safeButtons.map((b, i) => (
            <span
              key={i}
              style={{ display: "inline-block", marginInlineEnd: "10px" }}
            >
              <EmailButton
                href={b.url}
                variant={i === 0 ? "primary" : "ghost"}
                primaryColor={primaryColor}
              >
                {b.title}
              </EmailButton>
            </span>
          ))}
        </div>
      ) : null}
    </EmailLayout>
  );
}