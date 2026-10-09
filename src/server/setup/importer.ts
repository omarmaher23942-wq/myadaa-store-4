// importer.ts — استلام متجرك من Colapia إلى قاعدتك وحسابك على UploadThing.
//
// يعمل على خطوات قصيرة قابلة للاستئناف (كل خطوة ثوانٍ قليلة، والحالة محفوظة في قاعدتك):
//   media  → نسخ كل الصور والملفات إلى حساب UploadThing الخاص بك.
//   rows   → سحب الصفوف جدولاً جدولاً بالترتيب، مع استبدال روابط الصور بالنسخ الجديدة.
//   verify → مطابقة الأعداد مع ما أعلنته المنصة.
//   complete → تأكيد الاستلام للمنصة؛ إن وصلت صفوف جديدة أثناء النقل نعيد سحبها ثم نؤكد.
// كل إدراج يتجاهل الموجود مسبقاً، فإعادة أي خطوة لا تكرر شيئاً.
import "server-only";
import { count, eq } from "drizzle-orm";
import { UTApi } from "uploadthing/server";
import { db } from "@/db/client";
import { merchants } from "@/db/schema";
import { TRANSFER_ORDER, transferTable, rewriteMedia, reviveRows } from "@/db/transfer-tables";
import { hashPassword } from "@/server/passwords";
import { sha256, secureToken } from "@/lib/ids";
import { STORE } from "@/store.config";
import { getSetting, setSetting, deleteSetting, type SetupState } from "@/server/settings";

const SUPPORTED_FORMAT = 1;
const STEP_BUDGET_MS = 7_000;
const MEDIA_BATCH = 4;

type Manifest = {
  format: number;
  store: { id: string; name: string; subdomain: string };
  owner: { email: string | null; displayName: string };
  tables: { name: string; count: number }[];
  media: string[];
  pageSize: number;
};

type ImportState = {
  code: string;
  siteUrl: string;
  manifest: Manifest;
  owner: { email: string; passwordHash: string };
  phase: "media" | "rows" | "verify" | "complete";
  mediaIndex: number;
  media: Record<string, string>;
  /** صور تعذّر نسخها في الجولة السابقة، تُعاد قبل سحب الصفوف (حتى 3 جولات). */
  mediaRetry?: string[];
  mediaRounds?: number;
  /** الجداول المتبقية للسحب (بالترتيب)، والموضع داخل أولها. */
  queue: string[];
  offset: number;
  imported: Record<string, number>;
  rounds: number;
};

export type ImportProgress = {
  phase: ImportState["phase"] | "done";
  media: { done: number; total: number };
  tables: { name: string; label: string; done: number; total: number }[];
  message?: string;
};

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

const LABELS: Record<string, string> = {
  merchants: "حسابك",
  stores: "المتجر",
  store_blueprints: "التصميم",
  store_snapshots: "نسخ التصميم",
  categories: "الأقسام",
  products: "المنتجات",
  product_variants: "المقاسات والألوان",
  customers: "العملاء",
  shipping_zones: "مناطق الشحن",
  discounts: "أكواد الخصم",
  orders: "الطلبات",
  order_items: "تفاصيل الطلبات",
  payments: "المدفوعات",
  reviews: "التقييمات",
  abandoned_carts: "السلات المتروكة",
  analytics_events: "الزيارات",
  analytics_daily: "الإحصاءات اليومية",
  support_threads: "محادثات الدعم",
  support_messages: "رسائل الدعم",
  marketing_campaigns: "الحملات",
};

async function platform<T>(code: string, siteUrl: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const r = await fetch(`${STORE.importFrom}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${code}`, "x-site-url": siteUrl, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const body = (await r.json().catch(() => ({}))) as T;
  return { status: r.status, body };
}

function progressOf(s: ImportState): ImportProgress {
  return {
    phase: s.phase,
    media: { done: Math.min(s.mediaIndex, s.manifest.media.length), total: s.manifest.media.length },
    tables: s.manifest.tables
      .filter((t) => t.count > 0)
      .map((t) => ({ name: t.name, label: LABELS[t.name] ?? t.name, done: Math.min(s.imported[t.name] ?? 0, t.count), total: t.count })),
  };
}

/** يبدأ الاستلام: يتحقق من الكود مع المنصة ومن أن المتجر هو متجر هذا المشروع. */
export async function beginImport(input: {
  code: string;
  siteUrl: string;
  email: string;
  password: string;
  uploadthingToken: string;
  groqKey: string;
}): Promise<ImportProgress> {
  if (await getSetting<SetupState>("setup")) throw new ImportError("متجرك مستلَم بالفعل.");
  const { status, body } = await platform<Manifest & { error?: string }>(input.code, input.siteUrl, "/api/ownership/export?part=manifest");
  if (status !== 200) throw new ImportError(body.error ?? "تعذّر التحقق من كود الاستلام. تأكد من نسخه كاملاً.");
  if (body.format !== SUPPORTED_FORMAT) throw new ImportError("صيغة البيانات أحدث من هذا المشروع. حمّل نسخة محدثة من مشروعك من لوحة Colapia.");
  if (body.store.subdomain !== STORE.subdomain) throw new ImportError("هذا الكود لمتجر آخر غير المتجر الذي وُلّد له هذا المشروع.");

  await setSetting("keys.uploadthing", input.uploadthingToken);
  if (input.groqKey) await setSetting("keys.groq", input.groqKey);
  const state: ImportState = {
    code: input.code,
    siteUrl: input.siteUrl,
    manifest: body,
    owner: { email: input.email.trim().toLowerCase(), passwordHash: await hashPassword(input.password) },
    phase: body.media.length ? "media" : "rows",
    mediaIndex: 0,
    media: {},
    queue: TRANSFER_ORDER.map(([n]) => n).filter((n) => (body.tables.find((t) => t.name === n)?.count ?? 0) > 0),
    offset: 0,
    imported: {},
    rounds: 0,
  };
  await setSetting("import", state);
  return progressOf(state);
}

export async function currentProgress(): Promise<ImportProgress | null> {
  const s = await getSetting<ImportState>("import");
  return s ? progressOf(s) : null;
}

/** إلغاء استلام لم يكتمل (لإعادة البدء بكود جديد). البيانات المستوردة تبقى ولا تتكرر. */
export async function cancelImport(): Promise<void> {
  await deleteSetting("import");
}

// ─── الخطوات ─────────────────────────────────────────────────────────────────

const MEDIA_ROUNDS = 3;

/** هل ما زال الملف موجوداً على المنصة؟ (ملف محذوف أصلاً لا يوقف الاستلام). */
async function stillOnPlatform(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(8_000) });
    return r.status !== 404 && r.status !== 410;
  } catch {
    return true;
  }
}

/**
 * ينسخ الصور إلى حسابك على UploadThing. أي صورة يتعذّر نسخها تُعاد في جولات لاحقة، ولا يكتمل الاستلام
 * وصورة موجودة لم تُنسخ بعد: المنصة تحذف نسختها فور الاستلام، فلا بد أن تكون كل الصور في حسابك أولاً.
 */
async function copyMedia(s: ImportState, token: string) {
  const ut = new UTApi({ token });
  const retrying = s.mediaIndex >= s.manifest.media.length;
  const source = retrying ? s.mediaRetry ?? [] : s.manifest.media;
  const start = retrying ? 0 : s.mediaIndex;
  const batch = source.slice(start, start + MEDIA_BATCH);
  const results = await ut.uploadFilesFromUrl(batch).catch(() => batch.map(() => ({ data: null })));
  const failed: string[] = [];
  results.forEach((r, i) => {
    const from = batch[i]!;
    const to = (r as { data?: { ufsUrl?: string } | null }).data?.ufsUrl;
    if (to) s.media[from] = to;
    else failed.push(from);
  });
  if (retrying) {
    s.mediaRetry = [...(s.mediaRetry ?? []).slice(batch.length), ...failed];
  } else {
    s.mediaIndex += batch.length;
    s.mediaRetry = [...(s.mediaRetry ?? []), ...failed];
  }
  const passDone = retrying ? (s.mediaRetry ?? []).length === failed.length : s.mediaIndex >= s.manifest.media.length;
  if (!passDone) return;
  const pending = s.mediaRetry ?? [];
  if (!pending.length) {
    s.phase = "rows";
    return;
  }
  s.mediaRounds = (s.mediaRounds ?? 0) + 1;
  if (s.mediaRounds < MEDIA_ROUNDS) return;
  // آخر جولة: الملفات المحذوفة من المنصة أصلاً تبقى بروابطها، والموجودة تمنع الإكمال برسالة واضحة.
  const alive: string[] = [];
  for (const url of pending) if (await stillOnPlatform(url)) alive.push(url);
  for (const url of pending) if (!alive.includes(url)) s.media[url] = url;
  if (alive.length) {
    s.mediaRetry = alive;
    s.mediaRounds = 0;
    await setSetting("import", s);
    throw new ImportError(`تعذّر نقل ${alive.length} صورة إلى حسابك على UploadThing. تأكد أن المفتاح صحيح وأن مساحتك تكفي، ثم اضغط «أكمل الاستلام».`);
  }
  s.mediaRetry = [];
  s.phase = "rows";
}

async function importPage(s: ImportState) {
  const name = s.queue[0];
  if (!name) {
    s.phase = "verify";
    return;
  }
  const table = transferTable(name);
  if (!table) throw new ImportError(`جدول غير معروف: ${name}`);
  const { status, body } = await platform<{ rows?: unknown[]; done?: boolean; error?: string }>(
    s.code,
    s.siteUrl,
    `/api/ownership/export?table=${encodeURIComponent(name)}&offset=${s.offset}`
  );
  if (status !== 200 || !Array.isArray(body.rows)) throw new ImportError(body.error ?? "تعذّر سحب البيانات من المنصة، سنعيد المحاولة.");
  const rows = reviveRows(table, rewriteMedia(body.rows, s.media));
  for (let i = 0; i < rows.length; i += 100) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + 100) as any).onConflictDoNothing();
  }
  s.offset += rows.length;
  s.imported[name] = s.offset;
  if (body.done) {
    s.queue.shift();
    s.offset = 0;
  }
}

async function localCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const [name, table] of TRANSFER_ORDER) {
    const [r] = await db.select({ n: count() }).from(table);
    out[name] = r?.n ?? 0;
  }
  return out;
}

async function verify(s: ImportState) {
  const local = await localCounts();
  const short = s.manifest.tables.filter((t) => (local[t.name] ?? 0) < t.count);
  if (short.length && s.rounds < 2) {
    // سحب الجداول الناقصة من جديد (الإدراج يتجاهل الموجود).
    s.rounds++;
    s.queue = short.map((t) => t.name);
    s.offset = 0;
    s.phase = "rows";
    return;
  }
  if (short.length) throw new ImportError(`لم تكتمل بيانات: ${short.map((t) => LABELS[t.name] ?? t.name).join("، ")}. أعد المحاولة.`);
  s.imported = local;
  s.phase = "complete";
}

async function complete(s: ImportState): Promise<SetupState | null> {
  const stats = await localCounts();
  const { status, body } = await platform<{ ok?: boolean; behind?: { name: string }[]; error?: string }>(s.code, s.siteUrl, "/api/ownership/complete", {
    method: "POST",
    body: JSON.stringify({ siteUrl: s.siteUrl, stats }),
  });
  if (status === 409 && body.behind?.length) {
    // وصلت طلبات أو بيانات جديدة أثناء النقل: نسحبها ثم نؤكد من جديد.
    s.queue = body.behind.map((b) => b.name);
    s.offset = 0;
    s.phase = "rows";
    return null;
  }
  if (status !== 200 || !body.ok) throw new ImportError(body.error ?? "تعذّر تأكيد الاستلام مع المنصة، أعد المحاولة.");

  // حساب صاحب المتجر: البريد وكلمة المرور اللذان اخترتهما.
  const [owner] = await db.select({ id: merchants.id }).from(merchants).limit(1);
  const merchantId = owner?.id;
  if (!merchantId) throw new ImportError("لم يُستلم حساب صاحب المتجر.");
  await db
    .update(merchants)
    .set({ email: s.owner.email, passwordHash: s.owner.passwordHash, isActivated: true, googleId: null, updatedAt: new Date() })
    .where(eq(merchants.id, merchantId));

  const setup: SetupState = { completedAt: new Date().toISOString(), importedFrom: STORE.importFrom, stats };
  await setSetting("setup", setup);
  await deleteSetting("import");
  return setup;
}

/** خطوة واحدة (حتى ~7 ثوانٍ). الواجهة تستدعيها متتابعة حتى تعود phase = done. */
export async function runImportStep(): Promise<{ progress: ImportProgress; merchantId?: string; recoveryCode?: string }> {
  const s = await getSetting<ImportState>("import");
  if (!s) {
    if (await getSetting<SetupState>("setup")) return { progress: { phase: "done", media: { done: 0, total: 0 }, tables: [] } };
    throw new ImportError("لا يوجد استلام جارٍ. ابدأ من جديد.");
  }
  const token = (await getSetting<string>("keys.uploadthing")) ?? "";
  const t0 = Date.now();
  while (Date.now() - t0 < STEP_BUDGET_MS) {
    if (s.phase === "media") await copyMedia(s, token);
    else if (s.phase === "rows") await importPage(s);
    else if (s.phase === "verify") await verify(s);
    else if (s.phase === "complete") {
      const done = await complete(s);
      if (done) {
        const recoveryCode = `${secureToken(6)}-${secureToken(6)}`.toUpperCase();
        await setSetting("owner.recovery", await sha256(recoveryCode));
        const [m] = await db.select({ id: merchants.id }).from(merchants).limit(1);
        return { progress: { ...progressOf(s), phase: "done" }, merchantId: m?.id, recoveryCode };
      }
    }
    await setSetting("import", s);
  }
  await setSetting("import", s);
  return { progress: progressOf(s) };
}
