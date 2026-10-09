// db-errors.ts — قراءة رمز خطأ Postgres والقيد الذي خُرق من أخطاء السائق (Neon HTTP يضعها أحياناً في cause أو الرسالة).
export const PG_UNIQUE = "23505";
export const PG_CHECK = "23514";

export function dbErrorInfo(e: unknown): { code?: string; constraint?: string } {
  const x = e as {
    code?: unknown;
    constraint?: unknown;
    message?: unknown;
    cause?: { code?: unknown; constraint?: unknown; message?: unknown };
  } | null;
  const str = (a: unknown, b: unknown) => (typeof a === "string" ? a : typeof b === "string" ? b : undefined);
  const message = `${String(x?.message ?? "")} ${String(x?.cause?.message ?? "")}`;
  return {
    code: str(x?.code, x?.cause?.code),
    constraint: str(x?.constraint, x?.cause?.constraint) ?? message.match(/constraint "([^"]+)"/)?.[1],
  };
}
