// email-templates/OrderConfirmationCustomerEmail.tsx — تأكيد طلب للعميل (v2).
import {
  EmailLayout, EmailHeading, EmailParagraph, EmailButton,
  EmailDivider, EmailInfoBox, EmailOrderLine,
} from "./_layout";

export function OrderConfirmationCustomerEmail({
  customerName, storeName, storeSubdomain, orderCode,
  totalAmount, trackingUrl, items, logoUrl, primaryColor,
}: {
  customerName: string;
  storeName: string;
  storeSubdomain: string;
  orderCode: string;
  totalAmount: string;
  trackingUrl: string;
  items?: Array<{ name: string; variant?: string; qty: number; total: string }>;
  logoUrl?: string;
  primaryColor?: string;
}) {
  const primary = primaryColor ?? "#0f766e";

  return (
    <EmailLayout
      brand={{ storeName, logoUrl, primaryColor: primary, poweredByColapia: false }}
      preheader={`تم استلام طلبك ${orderCode} — سنبدأ بتجهيزه فوراً`}
      footerNote={`أرسلنا هذه الرسالة من متجر ${storeName}.`}
    >
      <EmailHeading>شكراً لك، {customerName}</EmailHeading>

      <EmailParagraph>
        استلمنا طلبك <b>{orderCode}</b> بنجاح، وبقيمة إجمالية <b>{totalAmount}</b>.
        سنبدأ بتجهيزه وتسليمه لشركة الشحن قريباً.
      </EmailParagraph>

      {items && items.length > 0 ? (
        <>
          <EmailDivider />
          <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 800, color: "#0b0f1f" }}>
            تفاصيل الطلب:
          </p>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}
            style={{ border: "1px solid #eef1f7", borderRadius: "12px", overflow: "hidden" }}>
            <tbody>
              {items.map((item, i) => (
                <EmailOrderLine key={i} name={item.name} variant={item.variant}
                  qty={item.qty} total={item.total} />
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <EmailInfoBox tone="success">
        <strong>معاينة وفحص الشحنة متاحة</strong>
        <br />
        عند وصول المندوب، يمكنك فتح الشحنة وفحص المنتج بالكامل قبل دفع أي مليم.
      </EmailInfoBox>

      <div style={{ marginTop: "20px", marginBottom: "20px" }}>
        <EmailButton href={trackingUrl} primaryColor={primary}>
          تتبّع طلبك
        </EmailButton>
      </div>

      <EmailDivider />

      <EmailParagraph>
        هل عندك سؤال عن الطلب؟ تواصل مع <b>{storeName}</b> مباشرة من صفحة المتجر.
      </EmailParagraph>
    </EmailLayout>
  );
}