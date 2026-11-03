"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { growthOf, leftOf, running, todayMinutes, useFocus } from "@/lib/focus";
import { PLANTS, stageMark, stageOf } from "@/lib/grove";

import { Cup } from "./cup";

/** Home's focus card: today's focused minutes, or the timer that's running. */
export function FocusWidget() {
  const { active, done, now } = useFocus();
  const minutes = todayMinutes(done);
  const left = active ? leftOf(active, now) : 0;
  const s = Math.ceil(left / 1000);
  return (
    <Link href="/focus" className="panel widget-glass flex items-center gap-3 p-4 transition-transform active:scale-[0.99]">
      <span className="shrink-0">
        {active && !active.plant ? <Cup drink={active.drink} size={48} steam={running(active)} /> : <span aria-hidden className="flex h-12 w-12 items-center justify-center text-[32px]">{active?.plant ? stageMark(active.plant, stageOf(growthOf(active, now))) : "🌱"}</span>}
      </span>
      <span className="min-w-0 flex-1">
        {active ? (
          <>
            <span className="block font-mono text-[20px] leading-6 font-bold tabular">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>
            <span className="block truncate text-[12.5px] text-fg-2">{active.phase === "focus" ? `${running(active) ? "Focusing" : "Paused"}${active.plant ? ` · ${PLANTS[active.plant].common}` : ""}${active.name ? ` · ${active.name}` : ""}` : "Break"}</span>
          </>
        ) : (
          <>
            <span className="block text-[20px] leading-6 font-bold tabular">{minutes}<span className="text-[13px] font-normal text-fg-2"> min</span></span>
            <span className="block text-[12.5px] text-fg-2">{minutes ? "focused today" : "Clinical Grove: focus and grow a medicinal plant"}</span>
          </>
        )}
      </span>
      <Icon name="arrow-right" size={16} className="shrink-0 text-fg-3" />
    </Link>
  );
}
