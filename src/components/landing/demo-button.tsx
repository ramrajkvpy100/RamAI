"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { caseSnapshot, hydrate, startCase } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { countryFromLocale } from "@/engine/countries";
import { startGuest } from "@/lib/engine-client";

/** Plays the guided demo case straight away — no account needed. */
export function DemoButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const { user } = await startGuest(countryFromLocale(navigator.language));
      hydrate(user.id);
      if (await startCase({ tutorial: true })) {
        router.push("/case");
        return;
      }
      setError(caseSnapshot().error?.message ?? "The demo couldn't start. Please try again.");
    } catch {
      setError("The demo couldn't start. Please try again.");
    }
    setBusy(false);
  };

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => void go()}
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
    </span>
  );
}
