"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="micro text-fg-2">Something went wrong</div>
      <p className="max-w-sm text-[15px] text-fg-2">Something on our side didn't load. Please try again.</p>
      <Button variant="secondary" onClick={reset}>
        Retry
      </Button>
    </main>
  );
}
