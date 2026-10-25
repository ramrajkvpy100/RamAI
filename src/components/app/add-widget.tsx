"use client";

import { useInAndroidApp } from "@/lib/in-app";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/cn";

/** Inside the Android app: put RamAI's widget (focus timer and today's case) on the home screen in one tap. */
export function AddWidgetButton({ className }: { className?: string }) {
  const inApp = useInAndroidApp();
  if (!inApp) return null;
  return (
    <a
      href="intent://widget#Intent;scheme=ramai;package=com.ramai.app;end"
      onClick={() => tap()}
      className={cn("flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left", className)}
    >
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-[20px]">🧩</span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold">Add the RamAI widget</span>
        <span className="block text-[12.5px] text-fg-2">Focus timer and today&apos;s case on your home screen</span>
      </span>
    </a>
  );
}
