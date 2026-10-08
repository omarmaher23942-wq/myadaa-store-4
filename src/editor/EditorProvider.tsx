"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type ElementType,
  type ComponentPropsWithoutRef,
} from "react";
import type { StoreBlueprint } from "@/blueprint/schema";
import { EDITOR_PARAM, PLATFORM_ORIGIN, post, type ToStore, type FromStore } from "./bridge";
import { cn } from "@/lib/utils";
import { Image as ImageIcon } from "lucide-react";

type Ctx = {
  editing: boolean;
  draft: StoreBlueprint | null;
  selected: string | null;
  send: (m: FromStore) => void;
};

const C = createContext<Ctx>({
  editing: false,
  draft: null,
  selected: null,
  send: () => {},
});

export const useEditor = () => useContext(C);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StoreBlueprint | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.self === window.top ||
      !new URLSearchParams(location.search).has(EDITOR_PARAM)
    )
      return;

    setEditing(true);

    const onMsg = (e: MessageEvent<ToStore>) => {
      if (!PLATFORM_ORIGIN || e.origin !== PLATFORM_ORIGIN) return;
      const m = e.data;
      if (!m?.type?.startsWith("editor:")) return;
      if (m.type === "editor:init" || m.type === "editor:blueprint")
        setDraft(m.blueprint);
      if (m.type === "editor:select") setSelected(m.sectionId);
      if (m.type === "editor:scrollTo")
        document
          .getElementById(m.sectionId)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    addEventListener("message", onMsg);
    post(window.parent, { type: "store:ready" });

    // إبقاء الروابط داخل المحرر
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (a && a.origin === location.origin) {
        e.preventDefault();
        const u = new URL(a.href);
        u.searchParams.set(EDITOR_PARAM, "1");
        location.href = u.toString();
        post(window.parent, { type: "store:route", path: u.pathname });
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      removeEventListener("message", onMsg);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <C.Provider
      value={{
        editing,
        draft,
        selected,
        send: (m) => post(window.parent, m),
      }}
    >
      {children}
    </C.Provider>
  );
}

/** مكون النص القابل للتحرير المباشر داخل محرر المتجر */
export function T<E extends ElementType = "span">({
  sectionId,
  path,
  as,
  children,
  className,
  ...props
}: {
  sectionId: string;
  path: string;
  as?: E;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<E>, "as" | "children" | "className">) {
  const { editing, send } = useEditor();
  const Tag = as || "span";

  if (!editing) {
    return (
      <Tag className={className} {...props}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        send({ type: "store:select", sectionId, path } as any);
      }}
      className={cn(
        className,
        "cursor-pointer rounded transition-all hover:outline hover:outline-2 hover:outline-primary/50"
      )}
      data-editor-section={sectionId}
      data-editor-path={path}
      {...props}
    >
      {children}
    </Tag>
  );
}

/** طبقة تعديل الصورة داخل محرر المتجر */
export function ImgEdit({
  sectionId,
  path,
  className,
}: {
  sectionId: string;
  path: string;
  className?: string;
}) {
  const { editing, send } = useEditor();
  if (!editing) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        send({ type: "store:select", sectionId, path } as any);
      }}
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100",
        className
      )}
      title="تغيير الصورة"
    >
      <span className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-foreground shadow">
        <ImageIcon className="size-4" />
        تعديل الصورة
      </span>
    </button>
  );
}