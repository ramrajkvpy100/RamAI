"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { FOCUS_MIN, leftOf, todayMinutes, useFocus } from "@/lib/focus";

/** Home's focus card: today's focused minutes, or the timer that's running. */
export function FocusWidget() {
  const { active, done, now } = useFocus();
  const minutes = todayMinutes(done);
  const left = active ? leftOf(active, now) : 0;
  const s = Math.ceil(left / 1000);
  return (
    <Link href="/focus" className="panel flex items-center gap-3 p-4 transition-transform active:scale-[0.99]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-300">
        <Icon name="clock" size={22} />
      </span>
      <span className="min-w-0 flex-1">
        {active ? (
          <>
            <span className="block font-mono text-[20px] leading-6 font-bold tabular">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>
            <span className="block truncate text-[12.5px] text-fg-2">{active.phase === "focus" ? `${active.endsAt ? "Focusing" : "Paused"} · ${active.name}` : "Break"}</span>
          </>
        ) : (
          <>
            <span className="block text-[20px] leading-6 font-bold tabular">{minutes}<span className="text-[13px] font-normal text-fg-2"> min</span></span>
            <span className="block text-[12.5px] text-fg-2">{minutes ? "focused today" : `Start a ${FOCUS_MIN}-minute focus`}</span>
          </>
        )}
      </span>
      <Icon name="arrow-right" size={16} className="shrink-0 text-fg-3" />
    </Link>
  );
}
