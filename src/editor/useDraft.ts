"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreBlueprint } from "@/blueprint/schema";

/** مسودة مع تاريخ Undo/Redo (حتى 100 خطوة) وحفظ تلقائي في localStorage كي لا يضيع عمل التاجر أبدًا */
export function useDraft(initial: StoreBlueprint, storeId: string) {
  const key = `clp-draft:${storeId}`;
  const [draft, setDraftState] = useState<StoreBlueprint>(() => { if (typeof window === "undefined") return initial; try { const saved = localStorage.getItem(key); if (saved) { const p = JSON.parse(saved); if (p.base === JSON.stringify(initial).length && p.draft) return p.draft; } } catch {} return initial; });
  const past = useRef<StoreBlueprint[]>([]); const future = useRef<StoreBlueprint[]>([]); const [, tick] = useState(0);
  const setDraft = useCallback((fn: (d: StoreBlueprint) => StoreBlueprint, coalesce = false) => setDraftState((d) => { const n = fn(d); if (JSON.stringify(n) === JSON.stringify(d)) return d; if (!coalesce || past.current.length === 0) past.current = [...past.current.slice(-99), d]; future.current = []; return n; }), []);
  const undo = useCallback(() => { const p = past.current.pop(); if (!p) return; setDraftState((d) => { future.current.push(d); return p; }); tick((x) => x + 1); }, []);
  const redo = useCallback(() => { const f = future.current.pop(); if (!f) return; setDraftState((d) => { past.current.push(d); return f; }); tick((x) => x + 1); }, []);
  const reset = useCallback((b: StoreBlueprint) => { past.current = []; future.current = []; setDraftState(b); localStorage.removeItem(key); }, [key]);
  useEffect(() => { const t = setTimeout(() => localStorage.setItem(key, JSON.stringify({ base: JSON.stringify(initial).length, draft, at: Date.now() })), 400); return () => clearTimeout(t); }, [draft, key, initial]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); } }; addEventListener("keydown", h); return () => removeEventListener("keydown", h); }, [undo, redo]);
  return { draft, setDraft, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0, dirty: JSON.stringify(draft) !== JSON.stringify(initial) };
}
/** تعيين قيمة في مسار نصي "items.2.title" داخل كائن (نسخة جديدة) */
export function setPath<T>(obj: T, path: string, value: unknown): T { const keys = path.split("."); const root: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) }; let cur = root; for (let i = 0; i < keys.length - 1; i++) { const k = keys[i]!; cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] }; cur = cur[k]; } cur[keys[keys.length - 1]!] = value; return root; }
