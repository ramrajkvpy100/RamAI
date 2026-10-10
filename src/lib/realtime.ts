"use client";

/**
 * Real-time mode for emergency cases: the clock keeps running while the
 * player thinks — one minute of case time every 20 seconds — so hesitation
 * costs what it costs at a real bedside. Paused while the tab is hidden.
 */
import { useEffect, useSyncExternalStore } from "react";

import type { CaseState } from "@/engine/types";

import { tick } from "./case-store";

const KEY = "ramai.realtime";
export const TICK_MS = 20_000;

let enabled: boolean | null = null;
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = localStorage.getItem(KEY) === "1";
  } catch {
    enabled = false;
  }
  return enabled;
}

export function setRealtimeEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}

export function useRealtimeEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readEnabled,
    () => false,
  );
}

/** Emergency cases only, while the case is live. */
export const realtimeEligible = (state: CaseState) => state.track === "emergency" && state.status === "active" && state.patientStatus !== "deceased";

/** Runs the clock while real-time mode is on. Returns whether it's running. */
export function useRealtimeClock(state: CaseState): boolean {
  const on = useRealtimeEnabled();
  const running = on && realtimeEligible(state);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void tick();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);
  return running;
}
