// email-templates/OrderShippedEmail.tsx — إشعار شحن للعميل.
import {
  EmailLayout,
  EmailHeading,
  EmailParagraph,
  EmailButton,
  EmailDivider,
  EmailInfoBox,
} from "./_layout";

export function OrderShippedEmail({
  customerName,
  storeName,
  orderCode,
  trackingNumber,
  courierName,
  trackingUrl,
  logoUrl,
  primaryColor,
}: {
  customerName: string;
  storeName: string;
  orderCode: string;
  trackingNumber: string;
  courierName: string;
  trackingUrl: string;
  logoUrl?: string;
  primaryColor?: string;
}) {
  const primary = primaryColor ?? "#0f766e";

  return (
    <EmailLayout
      brand={{
        storeName,
        logoUrl,
        primaryColor: primary,
        poweredByColapia: false,
      }}
      preheader={`طلبك ${orderCode} في الطريق إليك — رقم التتبع ${trackingNumber}`}
      footerNote={`أرسلنا هذه الرسالة من متجر ${storeName}.`}
    >
      <EmailHeading>طلبك في الطريق إليك</EmailHeading>

      <EmailParagraph>
        {customerName}،
      </EmailParagraph>

      <EmailParagraph>
        خبر سار! طلبك <b>{orderCode}</b> خرج للتو من مخزننا مع شركة{" "}
        <b>{courierName}</b>، وسيصل إليك في الموعد المتفق عليه.
      </EmailParagraph>

      <EmailInfoBox tone="info">
        <div style={{ marginBottom: "6px" }}>
          <strong>رقم التتبع:</strong>
        </div>
        <div
          style={{
            fontFamily: "'SF Mono', 'Menlo', monospace",
            fontSize: "16px",
            fontWeight: 800,
            color: primary,
            letterSpacing: "0.5px",
            direction: "ltr",
            textAlign: "left",
          }}
        >
          {trackingNumber}
        </div>
        <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
          احتفظ بهذا الرقم للتواصل مع شركة الشحن لو احتجت.
        </div>
      </EmailInfoBox>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={trackingUrl} primaryColor={primary}>
          تتبّع الشحنة الآن
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        <strong>ملاحظة:</strong> عند وصول المندوب، يمكنك معاينة المنتج
        وفحصه بالكامل قبل الدفع — لراحتك التامة.
      </EmailParagraph>

      <EmailParagraph>
        شكراً لثقتك في {storeName}.
      </EmailParagraph>
    </EmailLayout>
  );
}