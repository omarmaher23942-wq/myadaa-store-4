"use client";

// Global error — يلتقط أخطاء الـ Root Layout. يجب أن يحتوي <html> و<body>.
import { useEffect } from "react";
import { AlertOctagon, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error.message, error.digest);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          background: "#07091a",
          color: "#eaf0ff",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif",
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div
            style={{
              display: "grid",
              placeItems: "center",
              width: "80px",
              height: "80px",
              borderRadius: "24px",
              border: "1px solid rgba(239,68,68,0.25)",
              background:
                "linear-gradient(135deg, rgba(239,68,68,0.15), transparent)",
            }}
            aria-hidden="true"
          >
            <AlertOctagon size={36} color="#fca5a5" strokeWidth={1.5} />
          </div>

          <p
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#8d97c4",
              margin: 0,
            }}
          >
            Critical Error
          </p>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 900,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            تعذّر تحميل التطبيق
          </h1>

          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.7,
              color: "rgba(195,205,240,0.8)",
              margin: 0,
            }}
          >
            نعتذر عن الإزعاج. حدث خطأ حرج أثناء تحميل الصفحة. حاول مرة أخرى،
            وإذا استمرت المشكلة تواصل مع فريق الدعم.
          </p>

          {error.digest ? (
            <code
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "10.5px",
                color: "#8d97c4",
                padding: "6px 12px",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              REF: {error.digest}
            </code>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                height: "48px",
                padding: "0 1.5rem",
                borderRadius: "16px",
                border: "none",
                background: "linear-gradient(to left, #6f86ff, #8fa8ff)",
                color: "#07091a",
                fontWeight: 900,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={18} strokeWidth={2.25} aria-hidden="true" />
              إعادة المحاولة
            </button>

            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                height: "48px",
                padding: "0 1.5rem",
                borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)",
                color: "#eaf0ff",
                fontWeight: 700,
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              <Home size={18} strokeWidth={2.25} aria-hidden="true" />
              الرئيسية
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}