"use client";

import { useLauncher } from "@/components/home/use-launcher";

/** "Dr X challenges you": one tap plays the same patient. */
export function DuelInvite({ id, host, open }: { id: string; host: string; open: boolean }) {
  const { launch, starting, error } = useLauncher();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="text-[44px]" aria-hidden>⚔️</div>
      <h1 className="text-[26px] font-bold tracking-[-0.02em]">Dr. {host} challenges you</h1>
      <p className="text-[15px] leading-7 text-fg-2">Same patient, two doctors. Play the case your way — when you both finish, you'll see who scored higher.</p>
      {open ? (
        <button type="button" disabled={starting} onClick={() => void launch({ duel: id })} className="mt-2 h-12 rounded-full bg-accent px-7 text-[15px] font-semibold text-on-accent shadow-glow disabled:opacity-70">
          {starting ? "Getting the patient ready…" : "Accept and play"}
        </button>
      ) : (
        <p className="text-[14px] text-fg-3">Someone has already taken this challenge.</p>
      )}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
