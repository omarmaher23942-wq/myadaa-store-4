// auth.ts — دخول صاحب المتجر إلى لوحة التحكم في نسخة متجرك الخاصة.
//
// الدخول بالبريد وكلمة المرور التي اخترتها في صفحة الإعداد الأول (/setup)، والجلسة في قاعدتك.
// لا Google ولا أي خدمة خارجية. نسيت كلمة المرور؟ كود الاسترجاع الذي حفظته عند الإعداد يعيد تعيينها.
// نفس واجهة auth.ts في المنصة، فتعمل كل صفحات اللوحة كما هي.
import "server-only";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants, stores, sessions, customers } from "@/db/schema";
import { secureToken, sha256 } from "@/lib/ids";
import { hashPassword, verifyPassword } from "@/server/passwords";

const MERCHANT_COOKIE = "clp_m";
const SESSION_DAYS = 30;

type Merchant = typeof merchants.$inferSelect;
type Store = typeof stores.$inferSelect;
type Customer = typeof customers.$inferSelect;

async function writeCookie(token: string) {
  const jar = await cookies();
  jar.set(MERCHANT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

/** يبدأ جلسة صاحب المتجر بعد التحقق من هويته. */
export async function startOwnerSession(merchantId: string, storeId: string): Promise<void> {
  const token = secureToken();
  const h = await headers();
  await db.insert(sessions).values({
    tokenHash: await sha256(token),
    subjectType: "merchant",
    subjectId: merchantId,
    storeId,
    userAgent: h.get("user-agent")?.slice(0, 300),
    ip: h.get("x-real-ip") ?? undefined,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5),
  });
  await writeCookie(token);
}

/** المتجر الوحيد في قاعدتك. */
export async function getTheStore(): Promise<Store | null> {
  const [s] = await db.select().from(stores).where(isNull(stores.deletedAt)).orderBy(asc(stores.createdAt)).limit(1);
  return s ?? null;
}

/** دخول بالبريد وكلمة المرور. يعيد false بلا تفاصيل عند أي خطأ (لا نكشف إن كان البريد صحيحاً). */
export async function signInOwner(email: string, password: string): Promise<boolean> {
  const [m] = await db.select().from(merchants).where(eq(merchants.email, email.trim().toLowerCase())).limit(1);
  if (!m?.passwordHash || !(await verifyPassword(password, m.passwordHash))) return false;
  const store = await getTheStore();
  if (!store || store.merchantId !== m.id) return false;
  await db.update(merchants).set({ lastLoginAt: new Date() }).where(eq(merchants.id, m.id));
  await startOwnerSession(m.id, store.id);
  return true;
}

export async function setOwnerPassword(merchantId: string, password: string): Promise<void> {
  await db.update(merchants).set({ passwordHash: await hashPassword(password), isActivated: true, updatedAt: new Date() }).where(eq(merchants.id, merchantId));
  // كل الجلسات القديمة تنتهي عند تغيير كلمة المرور.
  await db.delete(sessions).where(and(eq(sessions.subjectType, "merchant"), eq(sessions.subjectId, merchantId)));
}

export type MerchantSession = {
  sessionId: string;
  merchantId: string;
  merchant: Merchant;
  storeId: string | null;
  store: Store | null;
  stores: Store[];
} | null;

export type MerchantStoreSession = NonNullable<MerchantSession> & { storeId: string; store: Store };

export async function getMerchantSession(): Promise<MerchantSession> {
  const jar = await cookies();
  const token = jar.get(MERCHANT_COOKIE)?.value;
  if (!token) return null;
  const [s] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, await sha256(token)), eq(sessions.subjectType, "merchant"), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!s) return null;
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, s.subjectId)).limit(1);
  if (!merchant) return null;
  const store = await getTheStore();
  if (!store || store.merchantId !== merchant.id) return null;
  return { sessionId: s.id, merchantId: merchant.id, merchant, storeId: store.id, store, stores: [store] };
}

export async function getMerchantStoreOrNull(): Promise<MerchantStoreSession | null> {
  const session = await getMerchantSession();
  return session?.store ? (session as MerchantStoreSession) : null;
}

export async function requireMerchantStore(): Promise<MerchantStoreSession> {
  const session = await getMerchantStoreOrNull();
  if (!session) redirect("/login");
  return session;
}

export async function listMerchantStores(): Promise<Store[]> {
  const s = await getTheStore();
  return s ? [s] : [];
}

/** متجر واحد فقط: لا تبديل. */
export async function setActiveStore(storeId: string): Promise<boolean> {
  const session = await getMerchantSession();
  return session?.storeId === storeId;
}

export async function logout(_kind: "merchant" | "platform" = "merchant") {
  const jar = await cookies();
  const token = jar.get(MERCHANT_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
  jar.delete({ name: MERCHANT_COOKIE, path: "/" });
}

// ─── حسابات العملاء ──────────────────────────────────────────────────────────
// حساب العميل (دخول Google أو رابط بالبريد) ميزة على المنصة. في متجرك يطلب العميل ويتتبع طلبه
// بكود الطلب ورقم موبايله، بلا حساب.

export type CustomerSession = { customerId: string; customer: Customer; storeId: string } | null;

export async function getCustomerSession(_storeId: string): Promise<CustomerSession> {
  return null;
}

export async function customerLogout(_storeId: string): Promise<void> {}

export async function issueCustomerMagicLink(_params: {
  store: { id: string; subdomain: string; name: string };
  customerId: string;
  email: string;
  redirectAfter: string;
}): Promise<boolean> {
  return false;
}

export async function consumeCustomerMagicLink(_token: string, _storeId: string): Promise<boolean> {
  return false;
}
