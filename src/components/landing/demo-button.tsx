"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

import { useGuestStart } from "./use-guest-start";

/** Plays the guided demo case straight away — no account needed (the specialty is asked first). */
export function DemoButton({ className }: { className?: string }) {
  const { begin, busy, error, sheet } = useGuestStart();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => void begin()}
        disabled={busy}
        className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-[15px] font-semibold shadow-sm transition-[transform,background-color] hover:bg-surface-3 active:scale-[0.98] disabled:opacity-70", className)}
      >
        <Icon name="pulse" size={16} className="text-accent-text" />
        {busy ? "Opening the ER…" : "Try a demo case"}
      </button>
      {error && (
        <span role="alert" className="mt-2 text-[12.5px] text-danger">
          {error}
        </span>
      )}
      {sheet}
    </span>
  );
}

/** On the log-in and sign-up pages: play now as a guest — the demo first, which can be skipped. */
export function GuestButton() {
  const { begin, busy, error, sheet } = useGuestStart();
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void begin()}
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface text-[14px] font-semibold shadow-sm transition-colors hover:bg-surface-3 disabled:opacity-70"
      >
        <Icon name="user" size={15} className="text-fg-2" />
        {busy ? "Starting…" : "Continue as guest"}
      </button>
      <span className="text-[12px] text-fg-3">No account needed — a short demo first, or skip it.</span>
      {error && (
        <span role="alert" className="text-[12.5px] text-danger">
          {error}
        </span>
      )}
      {sheet}
    </div>
  );
}
