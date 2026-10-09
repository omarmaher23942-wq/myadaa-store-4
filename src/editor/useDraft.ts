"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreBlueprint } from "@/blueprint/schema";
import { applyChanges, diffBlueprint, stableJson, type BpChange } from "@/lib/blueprint-patch";

/** بصمة نص (FNV-1a) لنسخة الـ Blueprint: المسودة المحلية تُستعاد فقط إن بُنيت على نفس النسخة تماماً. */
function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + ":" + s.length.toString(36);
}

/**
 * مسودة مع تراجع وإعادة (حتى 100 خطوة) تُحفظ على جهاز التاجر كي لا يضيع عمله.
 * - `base`: آخر نسخة من الخادم (عند الفتح أو بعد الحفظ)؛ «dirty» يقارن بها.
 * - المحفوظ محلياً «ما تغيّر» عن الأساس (diffBlueprint) لا نسخة كاملة، فيُعاد تطبيقه على نسخة الخادم الحالية عند العودة:
 *   ما حُفظ من صفحة أخرى بعد ذلك يبقى. `restored`: «same» إن لم يتغير المتجر منذها، و«moved» إن تغيّر (تنبيه للمراجعة).
 */
type Saved = { v: 2; base: string; changes: BpChange[]; at: number };
export function useDraft(initial: StoreBlueprint, storeId: string) {
  const key = `clp-draft:${storeId}`;
  const [base, setBase] = useState(initial);
  const [restored, setRestored] = useState<null | "same" | "moved">(null);
  const [draft, setDraftState] = useState<StoreBlueprint>(initial);
  const past = useRef<StoreBlueprint[]>([]);
  const future = useRef<StoreBlueprint[]>([]);
  const [, tick] = useState(0);
  const baseFp = useRef(fingerprint(stableJson(initial)));

  // الاستعادة بعد التركيب (التخزين المحلي غير متاح أثناء العرض على الخادم).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return;
      const p = JSON.parse(saved) as Partial<Saved>;
      const next = p.v === 2 && Array.isArray(p.changes) ? applyChanges(initial as unknown as Record<string, unknown>, p.changes) : null;
      if (next && stableJson(next) !== stableJson(initial)) {
        setDraftState(next as unknown as StoreBlueprint);
        setRestored(p.base === baseFp.current ? "same" : "moved");
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      /* تخزين غير متاح */
    }
    // مرة واحدة عند الفتح
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDraft = useCallback((fn: (d: StoreBlueprint) => StoreBlueprint, coalesce = false) => {
    setDraftState((d) => {
      const n = fn(d);
      if (JSON.stringify(n) === JSON.stringify(d)) return d;
      if (!coalesce || past.current.length === 0) past.current = [...past.current.slice(-99), d];
      future.current = [];
      return n;
    });
  }, []);
  const undo = useCallback(() => {
    const p = past.current.pop();
    if (!p) return;
    setDraftState((d) => {
      future.current.push(d);
      return p;
    });
    tick((x) => x + 1);
  }, []);
  const redo = useCallback(() => {
    const f = future.current.pop();
    if (!f) return;
    setDraftState((d) => {
      past.current.push(d);
      return f;
    });
    tick((x) => x + 1);
  }, []);
  /** بعد الحفظ: النسخة التي أعادها الخادم تصبح الأساس الجديد. */
  const reset = useCallback(
    (b: StoreBlueprint) => {
      past.current = [];
      future.current = [];
      baseFp.current = fingerprint(stableJson(b));
      setBase(b);
      setDraftState(b);
      setRestored(null);
      try {
        localStorage.removeItem(key);
      } catch {
        /* تخزين غير متاح */
      }
    },
    [key]
  );
  /** تجاهل المسودة المستعادة والعودة لنسخة الخادم. */
  const discard = useCallback(() => reset(base), [reset, base]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const changes = diffBlueprint(base as unknown as Record<string, unknown>, draft as unknown as Record<string, unknown>);
        if (!changes.length) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify({ v: 2, base: baseFp.current, changes, at: Date.now() } satisfies Saved));
      } catch {
        /* تخزين غير متاح */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [draft, base, key]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // داخل حقل نص: تراجع المتصفح الطبيعي للنص نفسه.
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [undo, redo]);

  return {
    draft,
    base,
    setDraft,
    undo,
    redo,
    reset,
    discard,
    restored,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    dirty: stableJson(draft) !== stableJson(base),
  };
}

/** تعيين قيمة في مسار نصي "items.2.title" داخل كائن (نسخة جديدة) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setPath<T>(obj: T, path: string, value: unknown): T { const keys = path.split("."); const root: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) }; let cur = root; for (let i = 0; i < keys.length - 1; i++) { const k = keys[i]!; cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] }; cur = cur[k]; } cur[keys[keys.length - 1]!] = value; return root; }
