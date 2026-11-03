"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { getPrefs, start, startGrove, type Size } from "@/lib/focus";
import { DURATIONS, isPlantId, isUnlocked, PLANT_IDS, PLANTS, plantedOf, type GroveRecord, type PlantId } from "@/lib/grove";
import { success, tap } from "@/lib/haptics";

import { GroveGarden } from "./grove-garden";
import styles from "./grove.module.css";
import { PlantArt, StillPlant } from "./plant-art";
import { lockScreen } from "./settle";

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Before a session: the time and the plant, then the garden so far. */
export function GroveSetup({ records, lost, onDismissLost }: { records: GroveRecord[]; lost: GroveRecord | null; onDismissLost: () => void }) {
  const completed = plantedOf(records).length;
  const [plant, setPlant] = useState<PlantId>("salix");
  const [minutes, setMinutes] = useState<number>(25);
  const [note, setNote] = useState("");

  useEffect(() => {
    const p = getPrefs();
    if (p.plant && isPlantId(p.plant)) setPlant(p.plant);
    if (p.minutes && (DURATIONS as readonly number[]).includes(p.minutes)) setMinutes(p.minutes);
  }, []);

  // A remembered plant is only offered once it's open on this account (a new sign-in can have fewer sessions).
  const chosen = isUnlocked(plant, completed) ? plant : "salix";
  const info = PLANTS[chosen];

  const begin = () => {
    tap();
    success();
    startGrove(chosen, minutes, note);
    onDismissLost();
    void lockScreen(`Growing ${info.common}${note ? `: ${note}` : ""}`, `Until ${clock(Date.now() + minutes * 60_000)}`);
  };
  const free = (size: Size) => {
    tap();
    start(getPrefs().drink ?? "chai", size, note);
    onDismissLost();
  };

  return (
    <div className="mx-auto w-full max-w-2xl pb-8">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-emerald-700 uppercase dark:text-emerald-300">Focus</p>
      <h1 className="mt-0.5 text-[26px] leading-tight font-semibold">Clinical Grove</h1>
      <p className="mt-1 text-[14.5px] text-fg-2">Grow a medicinal plant while you study. Your cases and Skills Lab keep it growing; giving up withers it.</p>

      {lost && <Withered record={lost} onDismiss={onDismissLost} />}

      <h2 className="mt-6 text-[15px] font-semibold">How long?</h2>
      <div role="radiogroup" aria-label="Minutes" className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {DURATIONS.map((d) => (
          <button key={d} type="button" role="radio" aria-checked={minutes === d} onClick={() => { tap(); setMinutes(d); }} className={cn("rounded-xl border py-2.5 text-[15px] font-semibold tabular", minutes === d ? "border-transparent bg-[#3f7d63] text-white" : "border-line bg-surface text-fg")}>
            {d}<span className="ml-0.5 text-[12px] font-normal opacity-80">min</span>
          </button>
        ))}
      </div>

      <h2 className="mt-6 text-[15px] font-semibold">What will you grow?</h2>
      <div role="radiogroup" aria-label="Plant" className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {PLANT_IDS.map((id) => {
          const p = PLANTS[id];
          const open = isUnlocked(id, completed);
          const on = chosen === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} disabled={!open} onClick={() => { tap(); setPlant(id); }} className={cn(styles.pick, on && styles.picked, "flex w-[124px] shrink-0 snap-start flex-col items-center rounded-2xl border p-2 text-center sm:w-auto", on ? "border-transparent bg-surface shadow-md ring-2 ring-[#3f7d63] dark:ring-emerald-300" : "border-line bg-surface", !open && "opacity-60")}>
              <span className={cn(styles.plate, "relative block aspect-square w-full max-w-[104px] overflow-hidden rounded-full")}>
                <StillPlant plant={id} stage={open ? "flowering" : "seed"} className="h-full w-full" />
                {!open && <span className="absolute inset-0 flex items-center justify-center text-[#33443c]"><Icon name="lock" size={18} /></span>}
              </span>
              <span className="mt-1.5 text-[13px] leading-4 font-semibold">{p.common}</span>
              <span className="text-[11.5px] leading-4 text-fg-2 italic">{p.latin}</span>
              {!open && <span className="mt-0.5 text-[11.5px] leading-4 font-medium text-fg-2">Rare: {p.unlockAt} sessions</span>}
            </button>
          );
        })}
      </div>

      <div key={chosen} className={cn(styles.pearlIn, "panel mt-3 p-4")}>
        <p className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300">{info.drug}</p>
        <p className="mt-1 text-[14.5px] leading-relaxed">{info.pearl}</p>
      </div>

      <label className="mt-5 block">
        <span className="text-[15px] font-semibold">I will… <span className="font-normal text-fg-2">(optional)</span></span>
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 80))} placeholder="revise antibiotics…" className="mt-2 h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] outline-none placeholder:text-fg-3" />
      </label>

      <button type="button" onClick={begin} className="focus-btn mt-5 w-full">Plant {info.common} · {minutes} min</button>

      <p className="mt-4 text-center text-[13px] text-fg-2">
        No plant, just a clock:{" "}
        <button type="button" onClick={() => free("flow")} className="font-medium text-fg underline">flowmodoro</button>
        {" · "}
        <button type="button" onClick={() => free("unlimited")} className="font-medium text-fg underline">stopwatch</button>
      </p>

      <GroveGarden records={records} />
    </div>
  );
}

/** The plant just given up on, withering in front of you. */
function Withered({ record, onDismiss }: { record: GroveRecord; onDismiss: () => void }) {
  const [dry, setDry] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setDry(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const p = PLANTS[record.plant];
  return (
    <div className={cn(styles.pearlIn, "panel mt-4 flex items-center gap-3 p-3")} role="status">
      <span className={cn(styles.plate, "block h-20 w-20 shrink-0 overflow-hidden rounded-full")}>
        <PlantArt plant={record.plant} progress={progressOf(record)} withered={dry} className="h-full w-full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">Your {p.common} withered</span>
        <span className="block text-[13px] text-fg-2">A withered {p.stages[record.stage].toLowerCase()} stays in your garden. The {record.minutes} min you studied still count for today.</span>
      </span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 p-1 text-fg-2"><Icon name="x" size={16} /></button>
    </div>
  );
}

const progressOf = (r: GroveRecord) => (r.planned ? Math.min(0.999, r.minutes / r.planned) : 0);
