"use client";

import { FillingBar } from "@/components/ui/filling-bar";
import { LoopVideo } from "@/components/ui/loop-video";
import { useCase } from "@/lib/case-store";
import { useStartingMessage } from "@/lib/use-starting-message";

/**
 * While a new patient is being prepared — wherever it was started from — a
 * card with what's happening and a bar filling up, so it's plain it's working.
 */
export function StartingOverlay() {
  const { starting } = useCase();
  const label = useStartingMessage(starting);
  if (!starting) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-4" role="status" aria-live="polite">
      <div className="popover pointer-events-auto flex w-full max-w-sm animate-enter flex-col gap-3 rounded-2xl px-4 py-3.5 shadow-lg">
        <div className="flex items-center gap-3">
          <LoopVideo name="monitor" className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">Preparing your patient</div>
            <div className="truncate text-[12.5px] text-fg-2">{label}</div>
          </div>
        </div>
        <FillingBar active={starting} expectedMs={18_000} label="Preparing your patient" />
      </div>
    </div>
  );
}
