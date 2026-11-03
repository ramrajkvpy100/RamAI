"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LoopVideo } from "@/components/ui/loop-video";
import { Portal } from "@/components/ui/portal";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { getPrefs, giveUp, growthOf, leftOf, pause, resume, running, setPrefs, startBreak, stop, studiedOf, todayMinutes, totalOf, type Active, type Ambience, type Done } from "@/lib/focus";
import { breakMinutes, PLANTS, stageOf, type GroveRecord, type PlantId } from "@/lib/grove";
import { tap } from "@/lib/haptics";

import { playAmbient, stopAmbient } from "./ambient";
import { CafeScene, STREET_VIEWS, StreetScene, type StreetView } from "./cafe-scene";
import styles from "./grove.module.css";
import { GrowthRing, PlantArt } from "./plant-art";
import { useWakeLock } from "./use-wake-lock";

const AMBIENCES: { id: Ambience; label: string }[] = [
  { id: "silent", label: "Silent" },
  { id: "rain", label: "Rain" },
  { id: "library", label: "Library" },
  { id: "cafe", label: "Café" },
  { id: "street", label: "Street" },
];

const clockText = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};

/** A session in progress: the plant, its ring, and the way out. */
export function GroveSession({ active, plant, done, now, onLost }: { active: Active; plant: PlantId; done: Done[]; now: number; onLost: (r: GroveRecord) => void }) {
  const info = PLANTS[plant];
  const [ambience, setAmbience] = useState<Ambience>("silent");
  const [volume, setVolume] = useState(0.35);
  const [street, setStreet] = useState<StreetView>("cafe");
  const [breathe, setBreathe] = useState(false);
  const [asking, setAsking] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const p = getPrefs();
    if (p.ambience) setAmbience(p.ambience);
    if (typeof p.volume === "number") setVolume(p.volume);
    if (p.street) setStreet(p.street);
    if (p.breathe) setBreathe(true);
  }, []);

  const isRunning = running(active);
  useWakeLock(isRunning);

  // The sounds: recordings for café and street, made on the phone for rain and library. Only while the clock runs.
  useEffect(() => {
    const a = audio.current;
    if (a) {
      a.volume = volume;
      if (isRunning) void a.play().catch(() => undefined);
      else a.pause();
    }
    if (isRunning && (ambience === "rain" || ambience === "library")) playAmbient(ambience, volume);
    else stopAmbient();
  }, [isRunning, ambience, volume]);
  useEffect(() => stopAmbient, []);

  const chooseAmbience = (a: Ambience) => {
    tap();
    setAmbience(a);
    setPrefs({ ambience: a });
  };
  const toggleBreathe = () => {
    tap();
    setBreathe((b) => {
      setPrefs({ breathe: !b });
      return !b;
    });
  };
  const confirmGiveUp = () => {
    setAsking(false);
    const withered = giveUp();
    if (withered) onLost(withered);
  };

  const left = leftOf(active, now);
  const growth = growthOf(active, now);
  const stage = stageOf(growth);
  const inBreak = active.phase === "break";
  const waitingBreak = inBreak && !active.endsAt && left === totalOf(active);
  const studied = studiedOf(active, now);
  const overScene = ambience === "cafe" || ambience === "street";

  return (
    <Portal>
      <div className={cn("fixed inset-0 z-[85] flex flex-col overflow-y-auto", ambience === "street" ? "bg-black" : "focus-table")}>
        {!overScene && <LoopVideo name="calm" className="fixed inset-0 h-full w-full opacity-40" />}
        {ambience === "cafe" && <div className="fixed inset-0"><CafeScene /></div>}
        {ambience === "street" && <div className="fixed inset-0"><StreetScene view={street} /></div>}
        {overScene && <audio key={ambience} ref={audio} loop preload="none" src={ambience === "street" ? "/focus/street-soft.m4a" : "/focus/cafe-soft.m4a"} />}

        <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-[max(14px,env(safe-area-inset-top))]">
          <Link href="/" className={cn(styles.pane, "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium")} aria-label="Back to RamAI. The timer keeps running">← Home</Link>
          <span className={cn(styles.pane, "rounded-full px-3 py-1.5 text-[13px] font-medium tabular")}>{todayMinutes(done)} min today</span>
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-4 py-4">
          <div className="relative w-[min(74vw,44vh,340px)]">
            {breathe && !inBreak && <span aria-hidden className={cn(styles.orb, "absolute -inset-[9%] rounded-full")} />}
            <GrowthRing progress={growth} className="relative">
              <PlantArt plant={plant} progress={growth} label={`${info.common}: ${info.stages[stage]}`} className="h-full w-full" />
            </GrowthRing>
          </div>

          <div className={cn(styles.pane, "w-full max-w-md rounded-3xl px-4 py-3 text-center")}>
            <p className="text-[14px] font-semibold">
              {info.common} <span className="font-normal text-fg-2 italic">{info.latin}</span>
            </p>
            <p role="timer" className="text-[44px] leading-[1.1] font-light tracking-tight tabular">{clockText(left)}</p>
            <p className="text-[13.5px] text-fg-2">
              {inBreak ? (waitingBreak ? `${info.stages.flowering}: planted in your garden` : "Break") : `${info.stages[stage]} · ${Math.floor(growth * 100)}%${isRunning ? "" : " · paused"}`}
              {active.name && !inBreak ? ` · I will ${active.name}` : ""}
            </p>
            {breathe && !inBreak && (
              <p className="mt-1 grid text-[14px] font-medium text-emerald-700 dark:text-emerald-300" aria-label="Breathing guide: in for 5.5 seconds, out for 5.5 seconds">
                <span aria-hidden className={styles.breatheIn}>Breathe in · 5.5 s</span>
                <span aria-hidden className={styles.breatheOut}>Breathe out · 5.5 s</span>
              </p>
            )}
            {(inBreak || growth >= 0.35) && <p key={String(inBreak)} className={cn(styles.pearlIn, "mt-2 border-t border-line pt-2 text-left text-[13px] leading-snug")}>{info.pearl}</p>}
          </div>
        </div>

        <div className={cn(styles.pane, "relative z-10 mx-auto mb-[max(12px,env(safe-area-inset-bottom))] flex w-[calc(100%-2rem)] max-w-md flex-col gap-2 rounded-3xl p-3")}>
          <div className="flex items-center gap-2">
            {inBreak ? (
              <>
                {waitingBreak && <button type="button" onClick={() => { tap(); startBreak(); }} className="focus-btn flex-1 !min-w-0 !px-3 !py-3 !text-[15px]">{breakMinutes(active.minutes ?? 0)}-min break</button>}
                <Button size="lg" className="flex-1" onClick={() => { tap(); stop(); }}>{waitingBreak ? "Done" : "End break"}</Button>
              </>
            ) : (
              <>
                <button type="button" aria-label={isRunning ? "Pause" : "Resume"} onClick={() => { tap(); if (isRunning) pause(); else resume(); }} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#3f7d63] text-[17px] font-bold text-white">{isRunning ? "❚❚" : "▶"}</button>
                <Button size="lg" aria-pressed={breathe} onClick={toggleBreathe} className={cn("flex-1 !px-2", breathe && "ring-2 ring-[#3f7d63] dark:ring-emerald-300")}>Breathe</Button>
                <Button size="lg" variant="danger" onClick={() => { tap(); setAsking(true); }} className="flex-1 !px-2">Give up</Button>
              </>
            )}
          </div>
          <div role="radiogroup" aria-label="Ambient sound" className="flex gap-1 overflow-x-auto">
            {AMBIENCES.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={ambience === a.id} onClick={() => chooseAmbience(a.id)} className={cn("flex-1 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors", ambience === a.id ? "bg-[#3f7d63] text-white" : "text-fg-2")}>{a.label}</button>
            ))}
          </div>
          {ambience !== "silent" && (
            <label className="flex items-center gap-2 px-1 text-fg-2">
              <Icon name="volume-off" size={13} />
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); setPrefs({ volume: v }); }} aria-label="Sound volume" className="min-w-0 flex-1 accent-[#3f7d63]" />
              <Icon name="volume" size={13} />
            </label>
          )}
          {ambience === "street" && (
            <div role="radiogroup" aria-label="Street view" className="flex gap-1">
              {(Object.keys(STREET_VIEWS) as StreetView[]).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={street === v} onClick={() => { tap(); setStreet(v); setPrefs({ street: v }); }} className={cn("flex-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium", street === v ? "bg-surface-3 text-fg" : "text-fg-2")}>{STREET_VIEWS[v]}</button>
              ))}
            </div>
          )}
        </div>

        <Sheet
          open={asking}
          onClose={() => setAsking(false)}
          placement="center"
          title={`Give up on your ${info.common}?`}
          description={`It will wither and stay in your garden as a withered ${info.stages[stage].toLowerCase()}. ${studied > 0 ? `The ${studied} min you've studied still count for today, but not towards your streak.` : "It won't count towards your streak."}`}
          footer={
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => setAsking(false)}>Keep growing</Button>
              <Button variant="danger" className="flex-1" onClick={confirmGiveUp}>Give up</Button>
            </div>
          }
        />
      </div>
    </Portal>
  );
}
