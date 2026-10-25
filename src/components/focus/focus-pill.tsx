"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { leftOf, running, useFocus } from "@/lib/focus";

import { Cup } from "./cup";

/** While a focus runs, a small timer follows you around the app — one tap back to the table. */
export function FocusPill() {
  const { active, now } = useFocus();
  const path = usePathname();
  if (!active || path === "/focus" || path.startsWith("/case")) return null;
  const s = Math.max(0, Math.round(leftOf(active, now) / 1000));
  return (
    <Link href="/focus" className="glass fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-3 z-[60] flex animate-pop items-center gap-2 rounded-full py-1 pr-3.5 pl-1 shadow-lg md:bottom-5" aria-label="Back to your focus timer">
      <Cup drink={active.drink} size={34} left={1} />
      <span className="font-mono text-[14px] font-semibold tabular">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>
      <span className="text-[11.5px] text-fg-2">{running(active) ? (active.phase === "focus" ? "focus" : "break") : "paused"}</span>
    </Link>
  );
}
