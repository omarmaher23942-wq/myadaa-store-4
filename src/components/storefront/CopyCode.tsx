"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
export function CopyCode({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 1500); }} className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-current/40 bg-white/15 px-3 py-2 font-mono font-bold tracking-wider">{code}{ok ? <Check className="size-4" /> : <Copy className="size-4" />}</button>;
}
