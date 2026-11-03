"use client";

/**
 * The focus timer, kept on this device. One session at a time. A grove session grows a medicinal plant for a chosen
 * time (see grove.ts); flowmodoro and the stopwatch are the free timers, with no plant. Time focused goes to today's
 * minutes; breaks never count. The running timer is stored as timestamps, so it keeps running through the rest of the
 * app and survives closing and reopening it. Nothing here needs notifications.
 */
import { useEffect, useState } from "react";

import { addToGrove, breakMinutes, plantedRecord, PLANTS, witheredRecord, type GroveRecord, type PlantId } from "./grove";
import { androidAppVersion } from "./in-app";

export type Drink = "chai" | "americano" | "matcha" | "cappuccino" | "latte" | "black-tea";
export type Size = "tall" | "grande" | "flow" | "unlimited" | "grove";
export type Phase = "focus" | "break";
export type Scene = "focus" | "social" | "window";
export type Ambience = "silent" | "rain" | "library" | "cafe" | "street";

/** Each size: focus and break minutes (unlimited: a stopwatch, no break). Flow repeats by itself. */
export const SIZES: Record<Size, { label: string; focus: number; brk: number; note: string }> = {
  tall: { label: "tall", focus: 25, brk: 5, note: "25 min focus · 5 min break" },
  grande: { label: "grande", focus: 50, brk: 10, note: "50 min focus · 10 min break" },
  flow: { label: "flowmodoro", focus: 0, brk: 0, note: "study freely — every 5 min earns 1 min of break" },
  unlimited: { label: "unlimited", focus: 0, brk: 0, note: "a stopwatch — stop when you're done" },
  grove: { label: "grove", focus: 0, brk: 0, note: "the minutes you chose" },
};

export const FOCUS_MIN = 25;

export interface Active {
  drink: Drink;
  size: Size;
  /** "I will…" — optional. */
  name: string;
  phase: Phase;
  /** When the current phase ends, while running (unlimited: null). */
  endsAt: number | null;
  /** Time left (ms) when paused; for unlimited, time elapsed so far. */
  leftMs: number;
  /** Unlimited, running: when this run began. */
  runFrom: number | null;
  startedAt: number;
  /** Flowmodoro: focus rounds completed in this sitting. */
  rounds: number;
  /** Flowmodoro: break minutes earned and not yet taken (1 per 5 studied). */
  earned?: number;
  /** A grove session: the plant growing, and the minutes chosen. */
  plant?: PlantId;
  minutes?: number;
}
export interface Done {
  name: string;
  minutes: number;
  at: number;
}

const ACTIVE = "ramai.focus.active.v2";
const DONE = "ramai.focus.done";
const PREFS = "ramai.focus.prefs";

const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const subs = new Set<() => void>();
const emit = () => {
  syncAlarm();
  subs.forEach((f) => f());
};

/**
 * In the Android app (1.5.0+): Android itself keeps the timer — an alarm clock set to when this phase ends, so it
 * vibrates and notifies even with the phone locked. Sent only when the end time changes.
 */
let alarmSent: string | null = null;
function syncAlarm() {
  if (typeof window === "undefined" || androidAppVersion() < 8) return;
  const a = getActive();
  const ends = a && !countsUp(a) && a.endsAt && a.endsAt > Date.now() ? a.endsAt : null;
  const key = String(ends);
  if (key === alarmSent) return;
  const first = alarmSent === null;
  alarmSent = key;
  if (first && !ends) return; // nothing was set by this page; nothing to clear
  const label = a?.phase === "break" ? "Break over — back to focus 📚" : a?.plant ? `Focus done: your ${PLANTS[a.plant].common} has finished growing` : "Focus done ☕ — time for a break";
  const q = ends ? `ends=${ends}&label=${encodeURIComponent(label)}` : "stop=1";
  window.location.href = `intent://focus?${q}#Intent;scheme=ramai;package=com.ramai.app;end`;
}

export const getActive = () => read<Active | null>(ACTIVE, null);
export const getDone = () => read<Done[]>(DONE, []);
export const getPrefs = () => read<{ drink?: Drink; size?: Size; scene?: Scene; volume?: number; street?: "cafe" | "tokyo"; plant?: PlantId; minutes?: number; ambience?: Ambience; breathe?: boolean }>(PREFS, {});
export const setPrefs = (p: Partial<ReturnType<typeof getPrefs>>) => write(PREFS, { ...getPrefs(), ...p });

const phaseMs = (a: Pick<Active, "size" | "phase" | "minutes">) => {
  if (a.size === "grove") return (a.phase === "focus" ? (a.minutes ?? 0) : breakMinutes(a.minutes ?? 0)) * 60_000;
  return (a.phase === "focus" ? SIZES[a.size].focus : SIZES[a.size].brk) * 60_000;
};

/** Time left in this phase (or, unlimited, time elapsed). */
/** Counting up: the unlimited stopwatch, and flowmodoro while studying. */
const countsUp = (a: Pick<Active, "size" | "phase">) => a.size === "unlimited" || (a.size === "flow" && a.phase === "focus");

export function leftOf(a: Active, now = Date.now()) {
  if (countsUp(a)) return a.leftMs + (a.runFrom ? now - a.runFrom : 0);
  return a.endsAt ? Math.max(0, a.endsAt - now) : a.leftMs;
}
export const totalOf = (a: Active) => phaseMs(a);
export const running = (a: Active | null) => !!a && (countsUp(a) ? !!a.runFrom : !!a.endsAt);

/** Flowmodoro: break minutes in hand — those carried over plus 1 for every 5 studied in this stretch. */
export const breakEarned = (a: Active, now = Date.now()) => (a.earned ?? 0) + (a.size === "flow" && a.phase === "focus" ? Math.floor(leftOf(a, now) / 300_000) : 0);

export function start(drink: Drink, size: Size, name: string) {
  const ms = phaseMs({ size, phase: "focus" });
  const now = Date.now();
  const up = size === "unlimited" || size === "flow";
  write(ACTIVE, { drink, size, name: name.trim(), phase: "focus", endsAt: up ? null : now + ms, leftMs: up ? 0 : ms, runFrom: up ? now : null, startedAt: now, rounds: 0, earned: 0 } satisfies Active);
  setPrefs({ drink, size });
  emit();
}
/** Starts a grove session: this plant, for these minutes. */
export function startGrove(plant: PlantId, minutes: number, name: string) {
  const ms = minutes * 60_000;
  const now = Date.now();
  write(ACTIVE, { drink: getPrefs().drink ?? "chai", size: "grove", name: name.trim(), phase: "focus", endsAt: now + ms, leftMs: ms, runFrom: null, startedAt: now, rounds: 0, earned: 0, plant, minutes } satisfies Active);
  setPrefs({ plant, minutes });
  emit();
}
/** How much of a grove session has grown, 0–1. Its break keeps the finished plant. */
export const growthOf = (a: Active, now = Date.now()) => (a.phase === "break" ? 1 : Math.max(0, Math.min(1, 1 - leftOf(a, now) / Math.max(1, totalOf(a)))));

export function startBreak() {
  const a = getActive();
  if (!a) return;
  if (a.size === "flow") {
    // Take every break minute collected; the study time so far is recorded.
    const mins = breakEarned(a);
    if (mins < 1) return;
    record(a.name, Math.floor(leftOf(a) / 60_000));
    const ms = mins * 60_000;
    write(ACTIVE, { ...a, phase: "break", endsAt: Date.now() + ms, leftMs: ms, runFrom: null, earned: 0, rounds: a.rounds + 1 });
    emit();
    return;
  }
  const ms = phaseMs({ ...a, phase: "break" });
  write(ACTIVE, { ...a, phase: "break", endsAt: Date.now() + ms, leftMs: ms });
  emit();
}
export function pause() {
  const a = getActive();
  if (!a || !running(a)) return;
  write(ACTIVE, countsUp(a) ? { ...a, leftMs: leftOf(a), runFrom: null } : { ...a, endsAt: null, leftMs: leftOf(a) });
  emit();
}
export function resume() {
  const a = getActive();
  if (!a || running(a)) return;
  write(ACTIVE, countsUp(a) ? { ...a, runFrom: Date.now() } : { ...a, endsAt: Date.now() + a.leftMs });
  emit();
}
const record = (name: string, minutes: number) => {
  if (minutes < 1) return;
  write(DONE, [...getDone().filter((d) => d.at > Date.now() - 60 * 86_400_000), { name: name || "Focus", minutes, at: Date.now() }]);
};
/** Minutes of focus already done in this phase (counting up: the time so far; counting down: the time used). */
export function studiedOf(a: Active, now = Date.now()): number {
  if (a.phase !== "focus") return 0;
  return Math.floor((countsUp(a) ? leftOf(a, now) : totalOf(a) - leftOf(a, now)) / 60_000);
}

/** Stopping early still counts the time already studied (whole minutes). */
export function stop() {
  const a = getActive();
  if (a?.plant && a.phase === "focus") {
    giveUp();
    return;
  }
  const studied = a ? studiedOf(a) : 0;
  if (a && studied > 0) record(a.name, studied);
  write(ACTIVE, null);
  emit();
}
/**
 * Giving up on a growing plant: it withers, and stays in the record at the stage it reached. The minutes already
 * studied still count towards today. If the time had in fact run out, the session is complete instead.
 */
export function giveUp(): GroveRecord | null {
  const a = getActive();
  if (!a?.plant || a.phase !== "focus") return null;
  if (a.endsAt && leftOf(a) <= 0) {
    complete();
    return null;
  }
  const withered = witheredRecord({ plant: a.plant, planned: a.minutes ?? 0, progress: growthOf(a), startedAt: a.startedAt, at: Date.now() });
  addToGrove(withered);
  record(a.name, studiedOf(a));
  write(ACTIVE, null);
  emit();
  return withered;
}

/**
 * A phase ran its full time. Focus: recorded, then the break waits for a tap (flowmodoro: the break starts by
 * itself). Break: tall/grande end; flowmodoro goes straight into the next 5 minutes.
 */
export function complete(): "focus-done" | "break-done" | null {
  const a = getActive();
  if (!a || a.size === "unlimited") return null;
  const now = Date.now();
  if (a.phase === "focus") {
    if (a.plant) addToGrove(plantedRecord({ plant: a.plant, minutes: a.minutes ?? 0, startedAt: a.startedAt, at: a.endsAt ?? now }));
    record(a.name, a.size === "grove" ? (a.minutes ?? 0) : SIZES[a.size].focus);
    const brk = phaseMs({ ...a, phase: "break" });
    write(ACTIVE, a.size === "flow" ? { ...a, phase: "break", endsAt: now + brk, leftMs: brk, rounds: a.rounds + 1 } : { ...a, phase: "break", endsAt: null, leftMs: brk, rounds: a.rounds + 1 });
    emit();
    return "focus-done";
  }
  // Flowmodoro: back to studying, counting up from zero again.
  if (a.size === "flow") write(ACTIVE, { ...a, phase: "focus", endsAt: null, leftMs: 0, runFrom: now });
  else write(ACTIVE, null);
  emit();
  return "break-done";
}

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const todayMinutes = (done = getDone()) => done.filter((d) => d.at >= startOfDay()).reduce((n, d) => n + d.minutes, 0);
export const todaySessions = (done = getDone()) => done.filter((d) => d.at >= startOfDay());

/** The timer, ticking: re-renders each second while open. */
export function useFocus() {
  const [s, setS] = useState<{ active: Active | null; done: Done[]; now: number }>({ active: null, done: [], now: 0 });
  useEffect(() => {
    const f = () => setS({ active: getActive(), done: getDone(), now: Date.now() });
    f();
    subs.add(f);
    const t = window.setInterval(f, 1000);
    document.addEventListener("visibilitychange", f);
    return () => {
      subs.delete(f);
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", f);
    };
  }, []);
  return s;
}
