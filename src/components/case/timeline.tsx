"use client";

import { EmptyState } from "@/components/ui/primitives";
import type { TimelineEvent } from "@/engine/types";
import { cn } from "@/lib/cn";

const DOT: Record<TimelineEvent["category"], string> = {
  arrival: "bg-fg-3",
  history: "bg-fg-3",
  exam: "bg-fg-3",
  investigation: "bg-accent",
  treatment: "bg-success",
  procedure: "bg-success",
  monitor: "bg-fg-3",
  status: "bg-danger",
  followup: "bg-accent",
  closure: "bg-fg",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <EmptyState title="No events" body="The encounter timeline builds as you work." />;
  let lastDay = -1;
  return (
    <ol className="relative flex flex-col" aria-label="Case timeline">
      {events.map((e, i) => {
        const showDay = e.day !== lastDay && (e.day > 0 || lastDay !== -1);
        lastDay = e.day;
        return (
          <li key={e.id}>
            {showDay && <div className="micro mt-3 mb-2 text-fg-3">Day {e.day + 1}</div>}
            <div className="grid grid-cols-[44px_12px_1fr] items-start gap-2 py-[5px]">
              <time className="pt-px text-[11.5px] text-fg-3 tabular">{e.clock}</time>
              <span className="relative flex h-5 justify-center">
                <span className={cn("mt-[6px] h-1.5 w-1.5 rounded-full", DOT[e.category])} aria-hidden />
                {i < events.length - 1 && <span className="absolute top-[14px] -bottom-[11px] w-px bg-line-2" aria-hidden />}
              </span>
              <div className="min-w-0">
                <p className={cn("text-ui leading-5", e.category === "status" ? "text-danger" : "text-fg")}>{e.label}</p>
                {e.detail && <p className="text-[12px] leading-5 text-fg-2">{e.detail}</p>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
