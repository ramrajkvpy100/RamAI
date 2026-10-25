"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { LoopVideo } from "@/components/ui/loop-video";
import { cn } from "@/lib/cn";

const STAGES = [
  "Gathering vital signs and the timeline of what you did",
  "Checking your decisions against the guidelines",
  "Comparing your diagnosis and differentials",
  "Writing your debrief",
];

/** While the debrief is prepared: what's happening, step by step — not a bare spinner. */
export function DebriefPipeline() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setN((x) => Math.min(STAGES.length - 1, x + 1)), 900);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[70] flex animate-fade items-center justify-center bg-bg/80 px-6 backdrop-blur-xl">
      <div className="glass w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <LoopVideo name="monitor" className="mb-4 h-28 w-full rounded-2xl" />
        <p className="text-[12px] font-semibold tracking-[0.16em] text-fg-3 uppercase">Case closed</p>
        <h2 className="mt-1 text-[20px] font-semibold">Preparing your debrief</h2>
        <ol className="mt-5 flex flex-col gap-3.5">
          {STAGES.map((s, i) => (
            <li key={s} className={cn("flex items-start gap-3 text-[14px] leading-5 transition-opacity duration-500", i > n && "opacity-35")}>
              <span className={cn("mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-500", i < n ? "border-success bg-success text-white" : i === n ? "border-accent" : "border-line")}>
                {i < n ? <Icon name="check" size={11} strokeWidth={3} /> : i === n ? <span className="h-2 w-2 animate-breathe rounded-full bg-accent" /> : null}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
