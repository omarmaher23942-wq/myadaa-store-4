// إيميل طلب جديد — يرسل للتاجر مع بيانات العميل ورابط المراجعة.
import {
  EmailLayout,
  EmailHeading,
  EmailParagraph,
  EmailButton,
  EmailDivider,
} from "./_layout";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          padding: "10px 0",
          fontSize: "13px",
          color: "#64748b",
          fontFamily: "'Cairo','Segoe UI',Tahoma,Arial,sans-serif",
          width: "40%",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "10px 0",
          fontSize: "14px",
          fontWeight: 800,
          color: "#0b0f1f",
          fontFamily: "'Cairo','Segoe UI',Tahoma,Arial,sans-serif",
          textAlign: "left",
        }}
      >
        {value}
      </td>
    </tr>
  );
}

export function NewOrderMerchantEmail({
  merchantEmail: _merchantEmail,
  storeName,
  orderCode,
  customerName,
  totalAmount,
  governorate,
  adminOrderUrl,
}: {
  merchantEmail: string;
  storeName: string;
  orderCode: string;
  customerName: string;
  totalAmount: string;
  governorate: string;
  adminOrderUrl: string;
}) {
  return (
    <EmailLayout
      brand={"colapia" as any}
      preheader={`طلب جديد (${orderCode}) — ${customerName} من ${governorate}`}
      footerNote={`أنت تتلقى هذا البريد لأنك صاحب متجر ${storeName} على Colapia.`}
    >
      <EmailHeading>وصل طلب جديد إلى متجرك</EmailHeading>
      <EmailParagraph>
        مبروك، لديك طلب جديد من عميل. إليك التفاصيل:
      </EmailParagraph>

      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{
          marginTop: "8px",
          marginBottom: "12px",
          border: "1px solid #eef1f7",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <tbody>
          <tr>
            <td style={{ padding: "4px 16px" }}>
              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
              >
                <tbody>
                  <Row label="رقم الطلب" value={orderCode} />
                  <Row label="اسم العميل" value={customerName} />
                  <Row label="المحافظة" value={governorate} />
                  <Row label="المبلغ الإجمالي" value={totalAmount} />
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <EmailParagraph>
        افتح لوحة التحكم لتأكيد الطلب أو طباعة بوليصة الشحن مباشرة.
      </EmailParagraph>

      <EmailDivider />

      <EmailButton href={adminOrderUrl}>مراجعة الطلب</EmailButton>
    </EmailLayout>
  );
}