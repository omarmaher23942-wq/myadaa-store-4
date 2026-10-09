// lib/email.ts — محرك الإيميلات (v3).
//
// القاعدة الحاسمة:
// كل الإيميلات تُرسَل من النطاق الجذر (colapia.com) — NEVER from a
// subdomain. Resend يرفض أي sender من subdomain غير موثّق. هذا يعني أن
// hello@, orders@, noreply@ — كلها من colapia.com. متوافق مع SPF/DKIM.
import "server-only";
import type { ReactElement } from "react";
import { env, clientEnv } from "@/lib/env";
import { db } from "@/db/client";
import { systemEvents } from "@/db/schema";
import { log } from "@/lib/logger";

export type EmailButton = { title: string; url: string };

export type SenderKind = "orders" | "hello" | "noreply" | "custom";

export type SendTemplatedOptions = {
  to: string | string[];
  subject: string;
  element: ReactElement;
  preheader?: string;
  replyTo?: string;
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
  senderKind?: SenderKind;
  /** اسم المرسل الظاهر للعميل (اسم المتجر في رسائل الطلبات)، وإلا Colapia. */
  fromName?: string;
  storeSubdomain?: string;
  merchantId?: string;
  storeId?: string;
  entityId?: string;
  tracking?: boolean;
  reqId?: string;
};

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  headline?: string;
  paragraphs: string[];
  buttons?: EmailButton[];
  storeName?: string;
  replyTo?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [0, 800, 2_400];

function validRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e));
}

/**
 * كل الإيميلات تُرسَل من النطاق الجذر (colapia.com).
 *
 * السبب الجذري: Resend يتحقق من DKIM/SPF لكل نطاق على حدة. wildcard
 * verification للـ subdomains غير مدعوم. لذلك أي إيميل من
 * orders@store.colapia.com سيُرفض. الحل: استخدام colapia.com دائماً.
 *
 * @param senderKind - يحدد البادئة (orders/hello/noreply).
 * @param _storeSubdomain - مهمَل. محفوظ للتوقيع API فقط.
 */
function resolveFrom(
  senderKind: SenderKind,
  _storeSubdomain?: string,
  fromName?: string
): string {
  const rootDomain = clientEnv.NEXT_PUBLIC_ROOT_DOMAIN || "colapia.com";
  // اسم العرض بلا رموز تكسر ترويسة البريد.
  const displayName = (fromName ?? "").replace(/[<>"\r\n]/g, "").trim().slice(0, 60) || "Colapia";

  if (senderKind === "custom") {
    return env.EMAIL_FROM || `${displayName} <hello@${rootDomain}>`;
  }
  // نسخة التاجر: عنوان الإرسال من EMAIL_FROM (نطاقه الموثّق في Resend) باسم متجره.
  if (env.EMAIL_FROM && !env.EMAIL_FROM.includes(rootDomain)) {
    const addr = /<([^>]+)>/.exec(env.EMAIL_FROM)?.[1] ?? env.EMAIL_FROM;
    return `${displayName} <${addr}>`;
  }

  const prefix =
    senderKind === "orders"
      ? "orders"
      : senderKind === "noreply"
      ? "noreply"
      : "hello";

  return `${displayName} <${prefix}@${rootDomain}>`;
}

export async function renderEmail(element: ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = renderToStaticMarkup(element);
  return `<!DOCTYPE html>${html}`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function buildOpenPixel(logId: string): string {
  const url = `${clientEnv.NEXT_PUBLIC_APP_URL}/api/email/track/open?eid=${encodeURIComponent(logId)}`;
  return `<img src="${url}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
}

function wrapLinksForTracking(html: string, logId: string): string {
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL;
  const host = (() => {
    try {
      return new URL(appUrl).hostname;
    } catch {
      return null;
    }
  })();

  if (!host) return html;

  const linkRe = /(<a\s+[^>]*href=["'])([^"']+)(["'][^>]*>)/gi;

  return html.replace(linkRe, (full, before, url, after) => {
    if (/^(mailto:|tel:|#|javascript:)/i.test(url)) return full;
    if (url.includes("/api/email/track/")) return full;
    if (url.includes("unsubscribe")) return full;

    try {
      const parsed = new URL(url, appUrl);
      if (parsed.hostname !== host) return full;
      const wrapped = `${appUrl}/api/email/track/click?eid=${encodeURIComponent(logId)}&u=${encodeURIComponent(url)}`;
      return `${before}${wrapped}${after}`;
    } catch {
      return full;
    }
  });
}

async function sendViaResend(args: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
}): Promise<{ ok: boolean; id?: string; error?: string; status?: number }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY missing" };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (args.idempotencyKey) {
    headers["Idempotency-Key"] = args.idempotencyKey.slice(0, 250);
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: args.from,
        to: args.to,
        subject: args.subject.slice(0, 150),
        html: args.html,
        text: args.text,
        reply_to: args.replyTo,
        tags: args.tags,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: errText.slice(0, 500) || `HTTP ${res.status}`,
      };
    }

    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}

export async function sendTemplatedEmail(
  opts: SendTemplatedOptions
): Promise<{ ok: boolean; logId?: string; resendId?: string; error?: string }> {
  const recipients = validRecipients(opts.to);
  if (recipients.length === 0) {
    return { ok: false, error: "no_valid_recipients" };
  }
  // نسخة التاجر الخاصة تعمل بلا مزوّد بريد حتى يضيف مفتاح Resend؛ الإشعارات داخل اللوحة تكفي.
  if (!env.RESEND_API_KEY) return { ok: false, error: "email_disabled" };

  const senderKind = opts.senderKind ?? "hello";
  const from = resolveFrom(senderKind, opts.storeSubdomain, opts.fromName);
  const shouldTrack = opts.tracking !== false;

  const logId = crypto.randomUUID();

  let html: string;
  try {
    html = await renderEmail(opts.element);
  } catch (err) {
    log.error(
      "ops",
      "email_render_failed",
      { reqId: opts.reqId, storeId: opts.storeId },
      "فشل تحويل React element إلى HTML",
      err
    );
    return { ok: false, error: "render_failed" };
  }

  if (shouldTrack) {
    html = wrapLinksForTracking(html, logId);
    html = html.replace(/<\/body>/i, `${buildOpenPixel(logId)}</body>`);
  }

  const text = htmlToText(html);

  let lastError: string | undefined;
  let lastStatus: number | undefined;
  let resendId: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) =>
        setTimeout(r, RETRY_BACKOFF_MS[attempt] ?? 2_400)
      );
    }

    const result = await sendViaResend({
      from,
      to: recipients,
      subject: opts.subject,
      html,
      text,
      replyTo: opts.replyTo,
      idempotencyKey: opts.idempotencyKey
        ? `${opts.idempotencyKey}:attempt-${attempt}`
        : undefined,
      tags: opts.tags,
    });

    if (result.ok) {
      resendId = result.id;
      break;
    }

    lastError = result.error;
    lastStatus = result.status;

    if (result.status && result.status >= 400 && result.status < 500) {
      break;
    }
  }

  try {
    await db.insert(systemEvents).values({
      scope: "ops",
      level: resendId ? "info" : "error",
      message: resendId
        ? `email_sent: ${opts.subject}`
        : `email_failed: ${opts.subject}`,
      data: {
        logId,
        resendId,
        from,
        to: recipients,
        senderKind,
        storeSubdomain: opts.storeSubdomain,
        storeId: opts.storeId,
        entityId: opts.entityId,
        attempts: MAX_ATTEMPTS,
        error: lastError,
        status: lastStatus,
        reqId: opts.reqId,
      },
    });
  } catch {
    // لا نكسر الإرسال بسبب فشل التسجيل.
  }

  if (!resendId) {
    log.warn(
      "ops",
      "email_send_failed",
      {
        reqId: opts.reqId,
        storeId: opts.storeId,
      },
      `فشل إرسال إيميل "${opts.subject}": ${lastError ?? "unknown"}`,
      lastError
    );
    return { ok: false, logId, error: lastError ?? "send_failed" };
  }

  return { ok: true, logId, resendId };
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const { GenericEmail } = await import("./email-templates/GenericEmail");
  const result = await sendTemplatedEmail({
    to: opts.to,
    subject: opts.subject,
    replyTo: opts.replyTo,
    element: GenericEmail({
      storeName: opts.storeName ?? "Colapia",
      headline: opts.headline,
      paragraphs: opts.paragraphs,
      buttons: opts.buttons,
    }),
    senderKind: "custom",
    tracking: false,
  });
  return result.ok;
}

export async function sendMerchantOnboardingReceivedEmail(
  merchantEmail: string,
  storeName: string,
  storeSubdomain?: string
) {
  const { GenericEmail } = await import("./email-templates/GenericEmail");
  return sendTemplatedEmail({
    to: merchantEmail,
    subject: `استلمنا استمارتك — جاري بناء متجر ${storeName}`,
    element: GenericEmail({
      storeName,
      headline: "استلمنا استمارتك",
      paragraphs: [
        `بدأنا العمل على بناء متجر ${storeName}. سنرسل إليك رسالة أخرى فور جاهزيته.`,
      ],
    }),
    senderKind: "hello",
    storeSubdomain,
    tracking: true,
  });
}

export async function sendMerchantStoreReadyEmail(args: {
  merchantEmail: string;
  storeName: string;
  storeUrl: string;
  adminUrl: string;
  storeSubdomain: string;
  storeId: string;
  merchantId: string;
  logoUrl?: string;
}) {
  const { StoreReadyEmail } = await import("./email-templates/StoreReadyEmail");
  return sendTemplatedEmail({
    to: args.merchantEmail,
    subject: `مبروك — متجر ${args.storeName} جاهز الآن`,
    element: StoreReadyEmail({
      storeName: args.storeName,
      storeUrl: args.storeUrl,
      adminUrl: args.adminUrl,
      logoUrl: args.logoUrl,
    } as never),
    senderKind: "hello",
    storeSubdomain: args.storeSubdomain,
    storeId: args.storeId,
    merchantId: args.merchantId,
    tracking: true,
  });
}

export async function sendMerchantNewOrderEmail(args: {
  merchantEmail: string;
  storeName: string;
  storeSubdomain: string;
  storeId: string;
  merchantId: string;
  orderCode: string;
  customerName: string;
  totalAmount: string;
  governorate: string;
  adminOrderUrl: string;
  logoUrl?: string;
}) {
  const { NewOrderMerchantEmail } = await import(
    "./email-templates/NewOrderMerchantEmail"
  );
  return sendTemplatedEmail({
    to: args.merchantEmail,
    subject: `طلب جديد في ${args.storeName} (${args.orderCode})`,
    element: NewOrderMerchantEmail(args),
    senderKind: "orders",
    storeSubdomain: args.storeSubdomain,
    storeId: args.storeId,
    merchantId: args.merchantId,
    entityId: args.orderCode,
    tags: [{ name: "category", value: "order" }],
    tracking: true,
  });
}

export async function sendCustomerOrderConfirmationEmail(args: {
  customerEmail: string;
  customerName: string;
  storeName: string;
  storeSubdomain: string;
  storeId: string;
  orderCode: string;
  totalAmount: string;
  trackingUrl: string;
  items?: Array<{ name: string; variant?: string; qty: number; total: string }>;
  logoUrl?: string;
  primaryColor?: string;
}) {
  const { OrderConfirmationCustomerEmail } = await import(
    "./email-templates/OrderConfirmationCustomerEmail"
  );
  return sendTemplatedEmail({
    to: args.customerEmail,
    subject: `تم استلام طلبك ${args.orderCode} من ${args.storeName}`,
    element: OrderConfirmationCustomerEmail(args),
    senderKind: "orders",
    fromName: args.storeName,
    storeSubdomain: args.storeSubdomain,
    storeId: args.storeId,
    entityId: args.orderCode,
    tags: [{ name: "category", value: "order_customer" }],
    tracking: true,
  });
}

export async function sendCustomerOrderShippedEmail(args: {
  customerEmail: string;
  customerName: string;
  storeName: string;
  storeSubdomain: string;
  storeId: string;
  orderCode: string;
  trackingNumber: string;
  courierName: string;
  trackingUrl: string;
  logoUrl?: string;
  primaryColor?: string;
}) {
  const { OrderShippedEmail } = await import(
    "./email-templates/OrderShippedEmail"
  );
  return sendTemplatedEmail({
    to: args.customerEmail,
    subject: `طلبك ${args.orderCode} في الطريق إليك`,
    element: OrderShippedEmail(args),
    senderKind: "orders",
    fromName: args.storeName,
    storeSubdomain: args.storeSubdomain,
    storeId: args.storeId,
    entityId: args.orderCode,
    tags: [{ name: "category", value: "order_shipped" }],
    tracking: true,
  });
}

export async function sendBulkTemplated(
  items: SendTemplatedOptions[],
  options: { concurrency?: number; delayMs?: number } = {}
): Promise<{ sent: number; failed: number }> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 5));
  const delayMs = options.delayMs ?? 600;

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((item) => sendTemplatedEmail(item))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) sent++;
      else failed++;
    }
    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { sent, failed };
}

export const _TEST_PIXEL = TRANSPARENT_PIXEL;