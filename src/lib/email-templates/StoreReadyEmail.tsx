// email-templates/StoreReadyEmail.tsx — متجر جاهز (v2).
import {
  EmailLayout,
  EmailHeading,
  EmailParagraph,
  EmailButton,
  EmailDivider,
  EmailInfoBox,
} from "./_layout";

export function StoreReadyEmail({
  storeName,
  storeUrl,
  adminUrl,
  logoUrl,
}: {
  storeName: string;
  storeUrl: string;
  adminUrl: string;
  logoUrl?: string;
}) {
  return (
    <EmailLayout
      brand={{
        storeName: "Colapia",
        logoUrl,
        primaryColor: "#0f766e",
      }}
      preheader={`متجر ${storeName} جاهز الآن — ابدأ باستقبال الطلبات`}
      footerNote={`أنت تتلقى هذا البريد لأنك بدأت بناء متجر ${storeName} على Colapia.`}
    >
      <EmailHeading>متجرك جاهز للانطلاق</EmailHeading>

      <EmailParagraph>
        أهلاً بك،
      </EmailParagraph>

      <EmailParagraph>
        انتهينا من بناء وتنسيق متجر <b>{storeName}</b> بالكامل، وهو متاح
        الآن على الإنترنت لاستقبال أول طلباتك.
      </EmailParagraph>

      <EmailInfoBox tone="success">
        <strong>بدأت تجربتك النشطة (180 دقيقة).</strong>
        <br />
        جرّب متجرك كأنك عميل، أضف منتجاً للسلة، وأكمل عملية الطلب — لترى كيف
        تصلك تفاصيل الطلب وبوليصة الشحن بضغطة زر.
      </EmailInfoBox>

      <EmailDivider />

      <div
        style={{
          marginTop: "8px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <EmailButton href={storeUrl} primaryColor="#0f766e">
          معاينة متجرك
        </EmailButton>
        <span style={{ display: "inline-block", width: "10px" }} />
        <EmailButton href={adminUrl} variant="ghost">
          فتح لوحة التحكم
        </EmailButton>
      </div>

      <EmailParagraph>
        <br />
        <strong>نصائح سريعة:</strong>
      </EmailParagraph>

      <ul
        style={{
          margin: "0 0 12px",
          padding: "0 20px",
          fontSize: "14px",
          lineHeight: 1.8,
        }}
      >
        <li style={{ marginBottom: "6px" }}>
          شارك رابط متجرك على فيسبوك وواتساب لجذب أول العملاء
        </li>
        <li style={{ marginBottom: "6px" }}>
          أضف 8 منتجات على الأقل لزيادة معدل التحويل
        </li>
        <li style={{ marginBottom: "6px" }}>
          فعّل شارات الثقة (المعاينة قبل الدفع، الاستبدال)
        </li>
      </ul>

      <EmailParagraph>
        شكراً لثقتك في Colapia — نتمنى لك مبيعات وفيرة.
      </EmailParagraph>
    </EmailLayout>
  );
}