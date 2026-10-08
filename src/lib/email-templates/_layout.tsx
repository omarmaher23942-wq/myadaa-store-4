// lib/email-templates/_layout.tsx — قالب إيميل موحّد فاخر.
//
// المبادئ:
//  - Table-based layout (كل عملاء البريد).
//  - Inline styles فقط.
//  - RTL كامل + lang="ar".
//  - Preheader مخفي بصرياً.
//  - Dark mode عبر @media (prefers-color-scheme: dark).
//  - 600px max width.
//  - CTA buttons بشكل "bulletproof" (anchor + padding).
//  - صفر emoji.
//  - صفر <script>.
import type { CSSProperties, ReactNode } from "react";

const FONT_STACK =
  "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";

const MONO_STACK =
  "'SF Mono', 'Menlo', 'Consolas', monospace";

export type EmailBrand = {
  storeName: string;
  storeUrl?: string;
  logoUrl?: string;
  /** لون أساسي (HEX) — يُستخدم في الأزرار والروابط. */
  primaryColor?: string;
  /** لون الخلفية (HEX). */
  backgroundColor?: string;
  /** هل نستخدم "Colapia" في الفوتر بدل اسم المتجر؟ */
  poweredByColapia?: boolean;
};

export function EmailLayout({
  brand,
  preheader,
  children,
  footerNote,
  showUnsubscribe = false,
  unsubscribeUrl,
}: {
  brand: EmailBrand;
  preheader?: string;
  children: ReactNode;
  footerNote?: string;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}) {
  const primary = brand.primaryColor ?? "#0f766e";
  const bg = brand.backgroundColor ?? "#f5f7fb";

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>{brand.storeName}</title>
        <style
          type="text/css"
          dangerouslySetInnerHTML={{
            __html: `
              /* Reset */
              body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
              table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
              img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
              body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: ${bg}; }
              a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }

              /* Dark mode */
              @media (prefers-color-scheme: dark) {
                .clp-body-bg { background-color: #07091a !important; }
                .clp-card { background-color: #0b0f2a !important; border-color: #1f2a56 !important; }
                .clp-text-primary { color: #eaf0ff !important; }
                .clp-text-secondary { color: #c3cdf0 !important; }
                .clp-text-muted { color: #8d97c4 !important; }
                .clp-divider { border-color: #1f2a56 !important; }
                .clp-soft { background-color: #10153a !important; }
                .clp-footer-bg { background-color: #0b0f2a !important; }
              }
            `,
          }}
        />
      </head>
      <body
        className="clp-body-bg"
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: bg,
          fontFamily: FONT_STACK,
          WebkitFontSmoothing: "antialiased",
          textRendering: "optimizeLegibility",
          direction: "rtl",
        }}
      >
        {/* Preheader — مخفي في العرض، يظهر في معاينة صندوق البريد */}
        {preheader ? (
          <div
            style={{
              display: "none",
              fontSize: "1px",
              color: bg,
              lineHeight: "1px",
              maxHeight: 0,
              maxWidth: 0,
              opacity: 0,
              overflow: "hidden",
            }}
          >
            {preheader}
            {"\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}
            {"\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}
            {"\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"}
          </div>
        ) : null}

        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ backgroundColor: bg, padding: "32px 12px" }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  border={0}
                  className="clp-card"
                  style={{
                    maxWidth: "600px",
                    backgroundColor: "#ffffff",
                    borderRadius: "20px",
                    border: "1px solid #e6eaf3",
                    overflow: "hidden",
                    boxShadow: "0 6px 20px -10px rgba(15,23,42,0.08)",
                  }}
                >
                  <tbody>
                    {/* ─── Header ─── */}
                    <tr>
                      <td
                        style={{
                          padding: "26px 32px 20px",
                          borderBottom: "1px solid #eef1f7",
                        }}
                        className="clp-divider"
                      >
                        <table
                          role="presentation"
                          width="100%"
                          cellPadding={0}
                          cellSpacing={0}
                          border={0}
                        >
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  fontSize: "22px",
                                  fontWeight: 900,
                                  color: "#0b0f1f",
                                  letterSpacing: "-0.4px",
                                  fontFamily: FONT_STACK,
                                  verticalAlign: "middle",
                                }}
                                className="clp-text-primary"
                              >
                                {brand.logoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={brand.logoUrl}
                                    alt={brand.storeName}
                                    width={140}
                                    style={{
                                      display: "block",
                                      height: "auto",
                                      maxWidth: "140px",
                                      border: 0,
                                    }}
                                  />
                                ) : (
                                  brand.storeName
                                )}
                              </td>
                              <td align="left" style={{ verticalAlign: "middle" }}>
                                {brand.poweredByColapia !== false ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "5px 11px",
                                      borderRadius: "999px",
                                      background: "rgba(15,118,110,0.08)",
                                      color: primary,
                                      fontSize: "10.5px",
                                      fontWeight: 800,
                                      letterSpacing: "0.2px",
                                      fontFamily: FONT_STACK,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Colapia
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* ─── Body ─── */}
                    <tr>
                      <td
                        style={{ padding: "32px 32px 28px" }}
                        className="clp-text-primary"
                      >
                        {children}
                      </td>
                    </tr>

                    {/* ─── Footer ─── */}
                    <tr>
                      <td
                        style={{
                          padding: "20px 32px 26px",
                          backgroundColor: "#f8fafc",
                          borderTop: "1px solid #eef1f7",
                          textAlign: "center",
                        }}
                        className="clp-footer-bg clp-divider"
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            color: "#64748b",
                            lineHeight: 1.7,
                            fontFamily: FONT_STACK,
                          }}
                          className="clp-text-muted"
                        >
                          {footerNote ??
                            (brand.poweredByColapia !== false
                              ? `تم الإرسال تلقائياً من منصة Colapia — للتجارة الإلكترونية العربية.`
                              : `© ${new Date().getFullYear()} ${brand.storeName}. جميع الحقوق محفوظة.`)}
                        </p>

                        {brand.storeUrl ? (
                          <p
                            style={{
                              margin: "8px 0 0",
                              fontSize: "11px",
                              color: "#94a3b8",
                              fontFamily: FONT_STACK,
                            }}
                            className="clp-text-muted"
                          >
                            <a
                              href={brand.storeUrl}
                              style={{
                                color: "#94a3b8",
                                textDecoration: "none",
                                fontFamily: MONO_STACK,
                                direction: "ltr",
                                display: "inline-block",
                              }}
                              dir="ltr"
                            >
                              {brand.storeUrl.replace(/^https?:\/\//, "")}
                            </a>
                          </p>
                        ) : null}

                        {showUnsubscribe && unsubscribeUrl ? (
                          <p
                            style={{
                              margin: "10px 0 0",
                              fontSize: "10.5px",
                              color: "#94a3b8",
                              fontFamily: FONT_STACK,
                            }}
                            className="clp-text-muted"
                          >
                            <a
                              href={unsubscribeUrl}
                              style={{
                                color: "#94a3b8",
                                textDecoration: "underline",
                              }}
                            >
                              إلغاء الاشتراك
                            </a>
                          </p>
                        ) : null}

                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: "11px",
                            color: "#94a3b8",
                            fontFamily: FONT_STACK,
                          }}
                          className="clp-text-muted"
                        >
                          إن وصلتك هذه الرسالة بالخطأ، يمكنك تجاهلها بأمان.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        margin: "0 0 16px",
        fontSize: "22px",
        fontWeight: 900,
        color: "#0b0f1f",
        lineHeight: 1.4,
        letterSpacing: "-0.2px",
        fontFamily: FONT_STACK,
      }}
      className="clp-text-primary"
    >
      {children}
    </h1>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 14px",
        fontSize: "15px",
        lineHeight: 1.85,
        color: "#1f2937",
        fontFamily: FONT_STACK,
      }}
      className="clp-text-secondary"
    >
      {children}
    </p>
  );
}

export function EmailButton({
  href,
  children,
  variant = "primary",
  primaryColor,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  primaryColor?: string;
}) {
  const isPrimary = variant === "primary";
  const primary = primaryColor ?? "#0b0f1f";

  const buttonStyle: CSSProperties & { msoPaddingAlt?: string } = {
    display: "inline-block",
    padding: "13px 24px",
    borderRadius: "12px",
    background: isPrimary ? primary : "#f1f5f9",
    color: isPrimary ? "#ffffff" : "#0b0f1f",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 800,
    fontFamily: FONT_STACK,
    border: isPrimary ? `1px solid ${primary}` : "1px solid #e2e8f0",
    textAlign: "center",
    lineHeight: 1.2,
    msoPaddingAlt: "0px",
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={buttonStyle}
    >
      {children}
    </a>
  );
}

export function EmailDivider() {
  return (
    <hr
      style={{
        border: 0,
        borderTop: "1px solid #eef1f7",
        margin: "22px 0",
      }}
      className="clp-divider"
    />
  );
}

export function EmailInfoBox({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const tones = {
    neutral: { bg: "#f8fafc", border: "#e2e8f0" },
    success: { bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.25)" },
    warning: { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.25)" },
    info: { bg: "rgba(111,134,255,0.06)", border: "rgba(111,134,255,0.25)" },
  };
  const t = tones[tone];

  return (
    <div
      className="clp-soft"
      style={{
        padding: "16px",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "12px",
        margin: "16px 0",
        fontFamily: FONT_STACK,
        fontSize: "13.5px",
        lineHeight: 1.75,
        color: "#1f2937",
      }}
    >
      {children}
    </div>
  );
}

export function EmailOrderLine({
  name,
  variant,
  qty,
  total,
}: {
  name: string;
  variant?: string;
  qty: number;
  total: string;
}) {
  return (
    <tr>
      <td
        style={{
          padding: "12px 0",
          borderBottom: "1px solid #eef1f7",
          fontSize: "13.5px",
          fontWeight: 700,
          color: "#0b0f1f",
          fontFamily: FONT_STACK,
        }}
        className="clp-text-primary clp-divider"
      >
        {name}
        {variant ? (
          <span
            style={{
              display: "block",
              marginTop: "2px",
              fontSize: "11.5px",
              fontWeight: 500,
              color: "#64748b",
            }}
            className="clp-text-muted"
          >
            {variant}
          </span>
        ) : null}
      </td>
      <td
        style={{
          padding: "12px 0",
          borderBottom: "1px solid #eef1f7",
          fontSize: "13.5px",
          textAlign: "center",
          color: "#64748b",
          fontFamily: MONO_STACK,
          direction: "ltr",
          width: "60px",
        }}
        className="clp-text-muted clp-divider"
      >
        ×{qty}
      </td>
      <td
        style={{
          padding: "12px 0",
          borderBottom: "1px solid #eef1f7",
          fontSize: "13.5px",
          textAlign: "left",
          fontWeight: 800,
          color: "#0b0f1f",
          fontFamily: MONO_STACK,
          direction: "ltr",
          width: "100px",
        }}
        className="clp-text-primary clp-divider"
      >
        {total}
      </td>
    </tr>
  );
}