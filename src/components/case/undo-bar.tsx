"use client";

import { useEffect, useState } from "react";

import { clearUndo, undo, useCase } from "@/lib/case-store";

/** "Ordered — Undo": a few seconds to take back an accidental order. */
export function UndoBar() {
  const { undoable } = useCase();
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!undoable) return;
    const tickOnce = () => {
      const ms = undoable.until - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) clearUndo();
    };
    tickOnce();
    const t = window.setInterval(tickOnce, 250);
    return () => window.clearInterval(t);
  }, [undoable]);
  if (!undoable || left <= 0) return null;
  return (
    <div className="mb-2 flex animate-enter items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2 text-[13px] shadow-sm" role="status">
      <span className="min-w-0 truncate text-fg-2">Ordered: <span className="text-fg">{undoable.label}</span></span>
      <button type="button" onClick={() => undo()} className="shrink-0 rounded-full bg-accent px-3 py-1 text-[12.5px] font-semibold text-on-accent">
        Undo · {left}s
      </button>
    </div>
  );
}
