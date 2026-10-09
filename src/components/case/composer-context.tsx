"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import { applyInsert, type ToolItem } from "@/lib/tool-menus";

interface ComposerApi {
  draft: string;
  setDraft: (v: string) => void;
  insert: (item: ToolItem) => void;
  focus: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

const Ctx = createContext<ComposerApi | null>(null);

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const focus = useCallback(() => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);

  const insert = useCallback(
    (item: ToolItem) => {
      setDraft((d) => applyInsert(d, item));
      focus();
    },
    [focus],
  );

  const value = useMemo(() => ({ draft, setDraft, insert, focus, inputRef }), [draft, insert, focus]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useComposer(): ComposerApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useComposer outside ComposerProvider");
  return ctx;
}
