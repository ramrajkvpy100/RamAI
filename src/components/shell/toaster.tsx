"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { dismissToast, subscribeToasts, type Toast } from "@/lib/toast";

const TONE: Record<Toast["tone"], [string, "check" | "info" | "alert"]> = {
  success: ["text-success", "check"],
  info: ["text-accent-text", "info"],
  warning: ["text-warning", "alert"],
  danger: ["text-danger", "alert"],
};

/** Confirmation banners at the bottom of the screen (above the phone tab bar), with Undo when there is one. */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {items.map((t) => {
        const [color, icon] = TONE[t.tone];
        return (
          <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-md animate-toast items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg">
            <Icon name={icon} size={17} className={cn("shrink-0", color)} />
            <span className="min-w-0 flex-1 text-[14px] leading-5">{t.text}</span>
            {t.action && (
              <button type="button" onClick={t.action.run} className="shrink-0 rounded-full bg-accent-soft px-3.5 py-1.5 text-[13px] font-semibold text-accent-text">
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="shrink-0 text-fg-3 hover:text-fg">
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
