// redis.ts — كاش في الذاكرة لنسخة المتجر الواحد (بدل Upstash): نفس الواجهة، بلا أي حساب إضافي.
// كل نسخة خادم لها كاشها؛ المدد قصيرة فيبقى المحتوى حديثاً، والقاعدة هي المصدر الوحيد للحقيقة.
type Entry = { v: unknown; exp: number };
const store = new Map<string, Entry>();
const MAX_KEYS = 5_000;

function live(key: string): Entry | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.exp && e.exp < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return e;
}

function zset(key: string): Map<string, number> {
  const e = live(key);
  if (e && e.v instanceof Map) return e.v as Map<string, number>;
  const z = new Map<string, number>();
  store.set(key, { v: z, exp: e?.exp ?? 0 });
  return z;
}

const clone = <T,>(v: T): T =>
  v === undefined || v === null || v instanceof Map ? v : (JSON.parse(JSON.stringify(v)) as T);

type Op = () => Promise<unknown>;

/** تجميع أوامر تُنفذ بالترتيب (مثل pipeline في Upstash). */
function pipeline() {
  const ops: Op[] = [];
  const p = {
    zadd: (k: string, m: { score: number; member: string }) => (ops.push(() => redis.zadd(k, m)), p),
    zremrangebyscore: (k: string, min: number, max: number) => (ops.push(() => redis.zremrangebyscore(k, min, max)), p),
    expire: (k: string, s: number) => (ops.push(() => redis.expire(k, s)), p),
    incr: (k: string) => (ops.push(() => redis.incr(k)), p),
    set: (k: string, v: unknown, o?: { ex?: number; nx?: boolean }) => (ops.push(() => redis.set(k, v, o)), p),
    async exec<T extends unknown[] = unknown[]>(): Promise<T> {
      const out: unknown[] = [];
      for (const op of ops) out.push(await op());
      return out as T;
    },
  };
  return p;
}

export const redis = {
  pipeline,
  async getdel<T = unknown>(key: string): Promise<T | null> {
    const e = live(key);
    store.delete(key);
    return e ? (e.v as T) : null;
  },
  async zadd(key: string, m: { score: number; member: string }): Promise<number> {
    const z = zset(key);
    const isNew = !z.has(m.member);
    z.set(m.member, m.score);
    return isNew ? 1 : 0;
  },
  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const z = zset(key);
    let n = 0;
    for (const [k, s] of z) if (s >= min && s <= max) (z.delete(k), n++);
    return n;
  },
  async zcount(key: string, min: number | string, max: number | string): Promise<number> {
    const lo = min === "-inf" ? -Infinity : Number(min);
    const hi = max === "+inf" ? Infinity : Number(max);
    return [...zset(key).values()].filter((s) => s >= lo && s <= hi).length;
  },
  async zrange<T = string[]>(key: string, start: number, stop: number, opts?: { rev?: boolean }): Promise<T> {
    const sorted = [...zset(key).entries()].sort((a, b) => (opts?.rev ? b[1] - a[1] : a[1] - b[1])).map(([m]) => m);
    return sorted.slice(start, stop < 0 ? undefined : stop + 1) as T;
  },
  async get<T = unknown>(key: string): Promise<T | null> {
    const e = live(key);
    return e ? clone(e.v as T) : null;
  },
  async set(key: string, value: unknown, opts?: { ex?: number; px?: number; nx?: boolean }): Promise<"OK" | null> {
    if (opts?.nx && live(key)) return null;
    if (store.size >= MAX_KEYS) store.delete(store.keys().next().value as string);
    const ttl = opts?.ex ? opts.ex * 1000 : opts?.px ?? 0;
    store.set(key, { v: clone(value), exp: ttl ? Date.now() + ttl : 0 });
    return "OK";
  },
  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) if (store.delete(k)) n++;
    return n;
  },
  async incr(key: string): Promise<number> {
    const e = live(key);
    const n = (Number(e?.v) || 0) + 1;
    store.set(key, { v: n, exp: e?.exp ?? 0 });
    return n;
  },
  async incrby(key: string, by: number): Promise<number> {
    const e = live(key);
    const n = (Number(e?.v) || 0) + by;
    store.set(key, { v: n, exp: e?.exp ?? 0 });
    return n;
  },
  async expire(key: string, seconds: number): Promise<number> {
    const e = live(key);
    if (!e) return 0;
    e.exp = Date.now() + seconds * 1000;
    return 1;
  },
  async ttl(key: string): Promise<number> {
    const e = live(key);
    if (!e) return -2;
    return e.exp ? Math.ceil((e.exp - Date.now()) / 1000) : -1;
  },
};

export const rkeys = {
  storeBySubdomain: (sub: string) => `store:sub:${sub}`,
  blueprint: (storeId: string) => `store:bp:${storeId}`,
  storefrontHome: (storeId: string) => `sf:home:${storeId}`,
  recentOrdersProof: (storeId: string) => `sf:proof:${storeId}`,
  productViews: (storeId: string) => `an:views:${storeId}`,
  coPurchase: (storeId: string, productId: string) => `rec:co:${storeId}:${productId}`,
} as const;

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = await redis.get<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await fn();
  if (value !== null && value !== undefined) await redis.set(key, value, { ex: ttlSeconds });
  return value;
}
