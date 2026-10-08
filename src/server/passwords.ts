// passwords.ts — تجزئة كلمات مرور فريق المنصة في مكان واحد.
// الصيغة: salt:iterations:hash (PBKDF2-SHA256). التحقق بمقارنة ثابتة الزمن.
import "server-only";
import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const ITERATIONS = 310_000;
const KEY_LEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await pbkdf2Async(password, salt, ITERATIONS, KEY_LEN, "sha256");
  return `${salt}:${ITERATIONS}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, iterationsText, expectedHex] = stored.split(":");
  const iterations = Number(iterationsText);
  if (!salt || !expectedHex || !Number.isInteger(iterations) || iterations <= 0) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = await pbkdf2Async(password, salt, iterations, expected.length, "sha256");
  return expected.length > 0 && actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** الحد الأدنى المقبول لكلمة مرور عضو فريق المنصة. */
export const MIN_PASSWORD_LENGTH = 12;

/** مقارنة ثابتة الزمن لسرّين نصيين أياً كان طولهما (للأسرار المشتركة مثل CRON_SECRET). */
export function secretsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
