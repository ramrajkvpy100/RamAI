"use client";

/**
 * Bedside-monitor sounds via the Web Audio API — off unless the player turns
 * them on. Beeps follow the pulse (pitch falls as SpO₂ falls, like a real
 * oximeter); alarms repeat while a vital is out of range; a chime marks a
 * change in the patient's status.
 */
import { useSyncExternalStore } from "react";

const KEY = "ramai.sound";
type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
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

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext) as Ctor | undefined;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  // Called from a click, so the browser lets the audio context start.
  if (on) audio();
  listeners.forEach((l) => l());
}

export function useSoundEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readEnabled,
    () => false,
  );
}

function tone(freq: number, at: number, duration: number, gain: number, type: OscillatorType = "sine") {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

let lastBeep = 0;

/** One pulse beep. Pitch tracks saturation: ~890 Hz at 100%, lower as it falls. Two views of one monitor beep once. */
export function beep(spo2?: number | null) {
  if (!readEnabled()) return;
  const now = performance.now();
  if (now - lastBeep < 90) return;
  lastBeep = now;
  const s = typeof spo2 === "number" && spo2 > 0 ? Math.max(70, Math.min(100, spo2)) : 97;
  tone(440 + (s - 70) * 15, 0, 0.09, 0.05);
}

/** Medium priority: three tones. High priority: two bursts of three, higher and faster. */
export function alarm(level: "medium" | "high") {
  if (!readEnabled()) return;
  if (level === "medium") {
    [0, 0.22, 0.44].forEach((d, i) => tone([523, 659, 784][i]!, d, 0.18, 0.06, "triangle"));
  } else {
    [0, 0.14, 0.28, 0.62, 0.76, 0.9].forEach((d, i) => tone([880, 988, 1175][i % 3]!, d, 0.12, 0.07, "square"));
  }
}

const nibpBeeped = new Set<string>();

/** The monitor's short double beep when a cuff reading is ready. */
export function nibpDone(key: string) {
  if (nibpBeeped.has(key)) return;
  nibpBeeped.add(key);
  if (!readEnabled()) return;
  tone(988, 0, 0.08, 0.035);
  tone(988, 0.13, 0.08, 0.035);
}

/** A soft two-note cue when the patient's status changes. */
export function chime(worse: boolean) {
  if (!readEnabled()) return;
  if (worse) {
    tone(740, 0, 0.22, 0.05, "triangle");
    tone(554, 0.2, 0.3, 0.05, "triangle");
  } else {
    tone(554, 0, 0.18, 0.04, "triangle");
    tone(740, 0.16, 0.26, 0.04, "triangle");
  }
}
