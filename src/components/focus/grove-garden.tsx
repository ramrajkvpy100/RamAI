"use client";

import { useState } from "react";

import { Tabs } from "@/components/ui/tabs";
import { focusedMinutes, focusXp, nextUnlock, PLANTS, plantedOf, plotOf, streaks, type GroveRecord, type Plot } from "@/lib/grove";

import styles from "./grove.module.css";
import { StillPlant } from "./plant-art";

/** The most drawn at once; the counts above still include everything. */
const SHOWN = 200;

const hours = (min: number) => (min < 60 ? `${min} min` : `${Math.round((min / 60) * 10) / 10} h`);

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="panel p-3">
      <p className="text-[20px] leading-6 font-bold tabular">{value}</p>
      <p className="mt-0.5 text-[12.5px] text-fg-2">{label}</p>
    </div>
  );
}

const nowMs = () => Date.now();

/** Every session on record: flowering plants for those completed, withered ones for those given up. */
export function GroveGarden({ records }: { records: GroveRecord[] }) {
  const [plot, setPlot] = useState<Plot>("today");
  const [now] = useState(nowMs);
  const shown = plotOf(records, plot, now);
  const planted = plantedOf(records).length;
  const { current, longest } = streaks(records, now);
  const next = nextUnlock(planted);
  const drawn = shown.slice(-SHOWN).reverse();
  return (
    <section aria-labelledby="garden-title" className="mt-8">
      <h2 id="garden-title" className="text-[20px] font-semibold">Your garden</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={hours(focusedMinutes(records))} label="total focused" />
        <Stat value={`${longest} ${longest === 1 ? "day" : "days"}`} label={current ? `longest streak · now ${current}` : "longest streak"} />
        <Stat value={focusXp(records)} label="focus XP" />
        <Stat value={planted} label={`planted · ${records.length - planted} withered`} />
      </div>
      <Tabs idPrefix="plot" label="Which plot" value={plot} onChange={setPlot} className="mt-4" items={[{ id: "today", label: "Today" }, { id: "week", label: "This week" }, { id: "all", label: "All-time" }]} />
      {drawn.length ? (
        <ul key={plot} className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-1.5 rounded-2xl bg-surface-2 p-2">
          {drawn.map((r, i) => {
            const p = PLANTS[r.plant];
            const what = r.status === "withered" ? `Withered ${p.stages[r.stage].toLowerCase()}: ${p.common}, ${r.minutes} of ${r.planned} min` : `${p.common}, ${r.minutes} min`;
            return (
              <li key={r.id} title={`${what}, ${new Date(r.at).toLocaleDateString()}`} className={`${styles.tile} rounded-xl`} style={{ "--i": i } as React.CSSProperties}>
                <StillPlant plant={r.plant} stage={r.stage} withered={r.status === "withered"} label={what} className="h-full w-full" />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl bg-surface-2 p-6 text-center text-[14px] text-fg-2">{plot === "all" ? "Nothing planted yet. Your first plant goes here." : "Nothing in this plot yet."}</p>
      )}
      {shown.length > SHOWN && <p className="mt-2 text-center text-[12.5px] text-fg-3">Showing the latest {SHOWN} of {shown.length}.</p>}
      <p className="mt-3 text-[13px] text-fg-2">{next ? `${next.unlockAt - planted} more ${next.unlockAt - planted === 1 ? "session" : "sessions"} to unlock ${next.common}.` : "Every rare plant unlocked."} Focus XP: 1 per completed minute, plus 10 for the day's first plant. It stays separate from your clinical rating.</p>
    </section>
  );
}
