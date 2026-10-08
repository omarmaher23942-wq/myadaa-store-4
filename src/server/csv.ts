import "server-only";
// csv.ts — ملفات CSV تفتح في Excel العربي مباشرة (UTF-8 مع BOM)، بحماية من حقن الصيغ.

const FORMULA = /^[=+\-@\t\r]/;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString().replace("T", " ").slice(0, 16) : String(v);
  // نص يبدأ بـ = أو + قد يُنفَّذ كصيغة في Excel: نسبقه بفاصلة عليا.
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function csvResponse(name: string, body: string): Response {
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export const egpCell = (piasters: number | null | undefined) => (typeof piasters === "number" ? Math.round(piasters) / 100 : "");
