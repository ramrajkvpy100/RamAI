"use client";

/**
 * The monitor as a real one behaves: each number sits on the measured value
 * and moves a little with every beat and breath (more in AF). A new
 * measurement shows at once. One live monitor per encounter, shared by every
 * view of it. Presentation only: alarms, the chart and scoring use the
 * measured values.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { CaseState, EcgSpec } from "@/engine/types";

import { MonitorSignal } from "./monitor-signal";
import { vitalNumber } from "./scene";

export interface MonitorNumbers {
  hr: number | null;
  spo2: number | null;
  rr: number | null;
}

export interface LiveMonitor {
  numbers: MonitorNumbers;
  signal: MonitorSignal;
  /** Attached and the patient alive: traces move and numbers update. */
  running: boolean;
}

type Key = keyof MonitorNumbers;
const KEYS: Key[] = ["hr", "spo2", "rr"];
/** Seconds between wobbles: heart rate every beat or two, breathing over several breaths. */
const EVERY: Record<Key, number> = { hr: 1, spo2: 2, rr: 4 };

/** How far a displayed number wanders from the measured value. */
function spread(key: Key, value: number, rhythm: EcgSpec["rhythm"]): number {
  if (value <= 0) return 0;
  if (key === "hr") return rhythm === "afib" ? Math.max(3, Math.round(value * 0.07)) : Math.max(1, Math.round(value * 0.012));
  return 1;
}

const bounded = (key: Key, v: number) => (key === "spo2" ? Math.min(100, Math.max(0, v)) : Math.max(0, v));

export function useLiveVitals(measured: MonitorNumbers, live: boolean, rhythm: EcgSpec["rhythm"]): MonitorNumbers {
  // How far each number currently sits from the measured value. The display is
  // always measured + offset, so a new measurement shows the moment it arrives.
  const [offset, setOffset] = useState<Record<Key, number>>({ hr: 0, spo2: 0, rr: 0 });
  const latest = useRef({ measured, rhythm });
  latest.current = { measured, rhythm };

  useEffect(() => {
    if (!live) return;
    let tick = 0;
    const id = window.setInterval(() => {
      const { measured: m, rhythm: rh } = latest.current;
      tick += 1;
      setOffset((prev) => {
        const next = { ...prev };
        for (const key of KEYS) {
          if (tick % EVERY[key] !== 0) continue;
          const value = m[key];
          const a = value === null ? 0 : spread(key, value, rh);
          // AF jumps about from beat to beat; everything else wanders a step at a time.
          next[key] = key === "hr" && rh === "afib" ? Math.round((Math.random() * 2 - 1) * a) : Math.max(-a, Math.min(a, prev[key] + Math.round(Math.random() * 2 - 1)));
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const show = (key: Key) => {
    const value = measured[key];
    if (!live || value === null) return value;
    const a = spread(key, value, rhythm);
    return bounded(key, Math.round(value + Math.max(-a, Math.min(a, offset[key]))));
  };
  const hr = show("hr");
  const spo2 = show("spo2");
  const rr = show("rr");
  return useMemo(() => ({ hr, spo2, rr }), [hr, spo2, rr]);
}

function seedOf(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** The encounter's one live monitor: numbers on display and the signal behind the traces. */
function useLiveMonitor(state: CaseState): LiveMonitor {
  const running = state.monitored && state.patientStatus !== "deceased";
  const rhythm = state.monitorRhythm ?? "sinus";
  const numbers = useLiveVitals({ hr: vitalNumber(state, "hr"), spo2: vitalNumber(state, "spo2"), rr: vitalNumber(state, "rr") }, running, rhythm);
  // Created at the current rates (views draw their first screenful before effects run), then kept current.
  const signal = useMemo(() => {
    const s = new MonitorSignal(seedOf(state.sessionId));
    s.set(running ? (numbers.hr ?? 0) : 0, running ? (numbers.rr ?? 0) : 0, rhythm);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessionId]);
  useEffect(() => {
    signal.set(running ? (numbers.hr ?? 0) : 0, running ? (numbers.rr ?? 0) : 0, rhythm);
  }, [signal, running, numbers.hr, numbers.rr, rhythm]);
  return useMemo(() => ({ numbers, signal, running }), [numbers, signal, running]);
}

const LiveMonitorContext = createContext<LiveMonitor | null>(null);

/**
 * Runs the encounter's live monitor. Only the monitor views re-render as its
 * numbers move — the rest of the case screen is passed through as children.
 */
export function LiveMonitorProvider({ state, children }: { state: CaseState; children: ReactNode }) {
  const monitor = useLiveMonitor(state);
  return <LiveMonitorContext.Provider value={monitor}>{children}</LiveMonitorContext.Provider>;
}

/** The live monitor, or null outside an encounter (static readings, still traces). */
export const useLiveMonitorView = () => useContext(LiveMonitorContext);

