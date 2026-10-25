"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { isStaleBuild, reloadOnce } from "@/lib/stale-build";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const stale = isStaleBuild(error);
  useEffect(() => {
    if (stale) reloadOnce();
  }, [stale]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="micro text-fg-2">{stale ? "Updating RamAI" : "Something went wrong"}</div>
      <p className="max-w-sm text-[15px] text-fg-2">{stale ? "A new version is ready — loading it now." : "Something on our side didn't load. Please try again."}</p>
      <Button variant="secondary" onClick={() => (stale ? window.location.reload() : reset())}>
        {stale ? "Reload" : "Retry"}
      </Button>
    </main>
  );
}
