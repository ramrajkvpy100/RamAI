"use client";

/**
 * The focus timer, kept on this device only. One session at a time: a 25-minute focus on something named, paused
 * and resumed at will, then a 5-minute break started by hand. Only completed focus counts; a cancel records nothing;
 * breaks never count. The running timer is stored as timestamps, so it survives closing and reopening the app.
 */
import { useEffect, useState } from "react";

export const FOCUS_MIN = 25;
export const BREAK_MIN = 5;

export type Phase = "focus" | "break";
export interface Active {
  name: string;
  phase: Phase;
  /** When it ends, if running. */
  endsAt: number | null;
  /** Time left when paused (ms). */
  leftMs: number;
  startedAt: number;
}
export interface Done {
  name: string;
  minutes: number;
  at: number;
}

const ACTIVE = "ramai.focus.active";
const DONE = "ramai.focus.done";

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

export function leftOf(a: Active, now = Date.now()) {
  return a.endsAt ? Math.max(0, a.endsAt - now) : a.leftMs;
}

export function start(name: string, phase: Phase = "focus") {
  const ms = (phase === "focus" ? FOCUS_MIN : BREAK_MIN) * 60_000;
  write(ACTIVE, { name: name.trim() || "Focus", phase, endsAt: Date.now() + ms, leftMs: ms, startedAt: Date.now() } satisfies Active);
  emit();
}
export function pause() {
  const a = getActive();
  if (!a?.endsAt) return;
  write(ACTIVE, { ...a, endsAt: null, leftMs: leftOf(a) });
  emit();
}
export function resume() {
  const a = getActive();
  if (!a || a.endsAt) return;
  write(ACTIVE, { ...a, endsAt: Date.now() + a.leftMs });
  emit();
}
/** Stops without recording anything. */
export function cancel() {
  write(ACTIVE, null);
  emit();
}
/** A focus that ran its full time: recorded; a break: just ends. */
export function complete() {
  const a = getActive();
  if (!a) return;
  if (a.phase === "focus") write(DONE, [...getDone().filter((d) => d.at > Date.now() - 60 * 86_400_000), { name: a.name, minutes: FOCUS_MIN, at: Date.now() }]);
  write(ACTIVE, a.phase === "focus" ? { ...a, phase: "break", endsAt: null, leftMs: BREAK_MIN * 60_000 } : null);
  emit();
}

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const todayMinutes = (done = getDone()) => done.filter((d) => d.at >= startOfDay()).reduce((n, d) => n + d.minutes, 0);
export const todaySessions = (done = getDone()) => done.filter((d) => d.at >= startOfDay());

/** The timer, ticking: re-renders each second while running. */
export function useFocus() {
  const [s, setS] = useState<{ active: Active | null; done: Done[]; now: number }>({ active: null, done: [], now: 0 });
  useEffect(() => {
    const f = () => setS({ active: getActive(), done: getDone(), now: Date.now() });
    f();
    subs.add(f);
    const t = window.setInterval(f, 1000);
    const vis = () => f();
    document.addEventListener("visibilitychange", vis);
    return () => {
      subs.delete(f);
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return s;
}
