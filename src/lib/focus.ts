"use client";

/**
 * The focus timer ("café pomodoro"), kept on this device only. One session at a time: pick a drink and a size,
 * write what you'll do, then focus. Only completed focus counts (and, for the unlimited stopwatch, the time when
 * stopped); a cancel records nothing; breaks never count. The running timer is stored as timestamps, so it
 * survives closing and reopening the app. Nothing here needs notifications.
 */
import { useEffect, useState } from "react";

export type Drink = "chai" | "americano" | "matcha" | "cappuccino" | "latte" | "black-tea";
export type Size = "tall" | "grande" | "flow" | "unlimited";
export type Phase = "focus" | "break";
export type Scene = "focus" | "social" | "window";

/** Each size: focus and break minutes (unlimited: a stopwatch, no break). Flow repeats by itself. */
export const SIZES: Record<Size, { label: string; focus: number; brk: number; note: string }> = {
  tall: { label: "tall", focus: 25, brk: 5, note: "25 min focus · 5 min break" },
  grande: { label: "grande", focus: 50, brk: 10, note: "50 min focus · 10 min break" },
  flow: { label: "flowmodoro", focus: 5, brk: 1, note: "5 min study · 1 min break, on repeat" },
  unlimited: { label: "unlimited", focus: 0, brk: 0, note: "a stopwatch — stop when you're done" },
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
const emit = () => subs.forEach((f) => f());

export const getActive = () => read<Active | null>(ACTIVE, null);
export const getDone = () => read<Done[]>(DONE, []);
export const getPrefs = () => read<{ drink?: Drink; size?: Size; scene?: Scene; volume?: number }>(PREFS, {});
export const setPrefs = (p: Partial<ReturnType<typeof getPrefs>>) => write(PREFS, { ...getPrefs(), ...p });

const phaseMs = (size: Size, phase: Phase) => (phase === "focus" ? SIZES[size].focus : SIZES[size].brk) * 60_000;

/** Time left in this phase (or, unlimited, time elapsed). */
export function leftOf(a: Active, now = Date.now()) {
  if (a.size === "unlimited") return a.leftMs + (a.runFrom ? now - a.runFrom : 0);
  return a.endsAt ? Math.max(0, a.endsAt - now) : a.leftMs;
}
export const totalOf = (a: Active) => phaseMs(a.size, a.phase);
export const running = (a: Active | null) => !!a && (a.size === "unlimited" ? !!a.runFrom : !!a.endsAt);

export function start(drink: Drink, size: Size, name: string) {
  const ms = phaseMs(size, "focus");
  const now = Date.now();
  write(ACTIVE, { drink, size, name: name.trim(), phase: "focus", endsAt: size === "unlimited" ? null : now + ms, leftMs: size === "unlimited" ? 0 : ms, runFrom: size === "unlimited" ? now : null, startedAt: now, rounds: 0 } satisfies Active);
  setPrefs({ drink, size });
  emit();
}
export function startBreak() {
  const a = getActive();
  if (!a) return;
  const ms = phaseMs(a.size, "break");
  write(ACTIVE, { ...a, phase: "break", endsAt: Date.now() + ms, leftMs: ms });
  emit();
}
export function pause() {
  const a = getActive();
  if (!a || !running(a)) return;
  write(ACTIVE, a.size === "unlimited" ? { ...a, leftMs: leftOf(a), runFrom: null } : { ...a, endsAt: null, leftMs: leftOf(a) });
  emit();
}
export function resume() {
  const a = getActive();
  if (!a || running(a)) return;
  write(ACTIVE, a.size === "unlimited" ? { ...a, runFrom: Date.now() } : { ...a, endsAt: Date.now() + a.leftMs });
  emit();
}
const record = (name: string, minutes: number) => {
  if (minutes < 1) return;
  write(DONE, [...getDone().filter((d) => d.at > Date.now() - 60 * 86_400_000), { name: name || "Focus", minutes, at: Date.now() }]);
};
/** Stops. A cancelled timed focus records nothing; the stopwatch records the minutes it ran. */
export function stop() {
  const a = getActive();
  if (a?.size === "unlimited" && a.phase === "focus") record(a.name, Math.floor(leftOf(a) / 60_000));
  write(ACTIVE, null);
  emit();
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
    record(a.name, SIZES[a.size].focus);
    const brk = phaseMs(a.size, "break");
    write(ACTIVE, a.size === "flow" ? { ...a, phase: "break", endsAt: now + brk, leftMs: brk, rounds: a.rounds + 1 } : { ...a, phase: "break", endsAt: null, leftMs: brk, rounds: a.rounds + 1 });
    emit();
    return "focus-done";
  }
  if (a.size === "flow") {
    const ms = phaseMs("flow", "focus");
    write(ACTIVE, { ...a, phase: "focus", endsAt: now + ms, leftMs: ms });
  } else write(ACTIVE, null);
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
