"use client";

/**
 * Interface sounds — only where a sound means something (in the spirit of Duolingo's): a rising
 * two-note chime for a right answer, a gentle "bonk" for a wrong one, a fanfare for a finished round
 * or a good score, a sparkle when an achievement opens. Buttons, sends and likes stay quiet.
 * Synthesised with the Web Audio API — no audio files. On unless the player turns them off (separate
 * from the bedside monitor's sounds).
 */
import { useSyncExternalStore } from "react";

export type Sfx = "correct" | "wrong" | "win" | "levelup" | "reveal" | "streak";

const KEY = "ramai.sfx";
let enabled: boolean | null = null;
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = localStorage.getItem(KEY) !== "0";
  } catch {
    enabled = true;
  }
  return enabled;
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
  if (on) playSfx("correct");
}

export function useSfxEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readEnabled,
    () => true,
  );
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/** One note: a quick attack, an exponential fall — the "ding" shape. */
function note(a: AudioContext, out: AudioNode, freq: number, at: number, dur: number, gain: number, type: OscillatorType = "sine", slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** A bright bell: the note, its octave and a quiet fifth above. */
function bell(a: AudioContext, out: AudioNode, freq: number, at: number, dur: number, gain: number) {
  note(a, out, freq, at, dur, gain, "triangle");
  note(a, out, freq * 2, at, dur * 0.6, gain * 0.35);
  note(a, out, freq * 3, at, dur * 0.35, gain * 0.12);
}

export function playSfx(kind: Sfx) {
  if (!readEnabled()) return;
  const a = audio();
  if (!a) return;
  const out = a.createGain();
  out.gain.value = 0.55;
  out.connect(a.destination);
  const t = a.currentTime + 0.01;
  switch (kind) {
    case "correct":
      // The right-answer chime: two quick rising bell notes.
      bell(a, out, 784, t, 0.16, 0.2);
      bell(a, out, 1175, t + 0.09, 0.32, 0.22);
      break;
    case "wrong":
      note(a, out, 240, t, 0.2, 0.16, "square", 150);
      note(a, out, 180, t + 0.12, 0.22, 0.1, "triangle", 120);
      break;
    case "streak":
      [659, 784, 988].forEach((f, i) => bell(a, out, f, t + i * 0.07, 0.22, 0.16));
      break;
    case "win":
      // A little fanfare: up the major chord, then all of it together.
      [523, 659, 784, 1047].forEach((f, i) => bell(a, out, f, t + i * 0.085, 0.28, 0.18));
      [523, 659, 784, 1047].forEach((f) => bell(a, out, f, t + 0.42, 0.9, 0.09));
      break;
    case "levelup":
      note(a, out, 300, t, 0.45, 0.08, "sawtooth", 1200);
      [784, 988, 1175, 1568].forEach((f, i) => bell(a, out, f, t + 0.3 + i * 0.07, 0.35, 0.16));
      [1568, 1975, 2349].forEach((f, i) => note(a, out, f, t + 0.65 + i * 0.05, 0.12, 0.05));
      break;
    case "reveal":
      // A whoosh up, a burst, and sparkles.
      note(a, out, 180, t, 0.5, 0.07, "sawtooth", 900);
      bell(a, out, 1047, t + 0.45, 0.6, 0.2);
      bell(a, out, 1568, t + 0.5, 0.6, 0.12);
      for (let i = 0; i < 6; i++) note(a, out, 2000 + i * 260, t + 0.55 + i * 0.045, 0.08, 0.04);
      break;
  }
}
