// upload-hosts.ts — مضيفو الملفات الموثوقون (UploadThing). أي رابط صورة/إيصال
// يأتي من المتصفح يجب أن يشير إلى أحدهم، فلا تُخزَّن روابط خارجية عشوائية.
const TRUSTED_HOST = /^(?:utfs\.io|[a-z0-9-]+\.ufs\.sh)$/i;

export function isTrustedUploadUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && TRUSTED_HOST.test(u.hostname);
  } catch {
    return false;
  }
}
