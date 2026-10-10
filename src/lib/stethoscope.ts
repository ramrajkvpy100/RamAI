/**
 * A stethoscope in the browser: heart, breath and bowel sounds synthesised
 * from the patient's acoustic parameters with the Web Audio API — nothing is
 * downloaded, and nothing names what's heard. Best with headphones.
 */
import type { Auscultation, BowelSounds, BreathSounds, HeartSounds } from "@/engine/types";

/** How long one listen lasts. */
export const LISTEN_SECONDS = 12;

type Ctx = AudioContext;
let ac: Ctx | null = null;
let stopCurrent: (() => void) | null = null;
let noiseBuf: AudioBuffer | null = null;

function context(): Ctx {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ac ??= new Ctor();
  // On iPhone, play even with the ring/silent switch on: this is something the player asked to hear.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

function noise(c: Ctx): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return (noiseBuf = buf);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A soft thud — a heart sound: a low tone that drops in pitch, with a little grain. */
function thud(c: Ctx, out: AudioNode, at: number, freq: number, dur: number, gain: number) {
  for (const [type, mult, level] of [["sine", 1, 1], ["triangle", 2.3, 0.35]] as const) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult * 1.35, at);
    osc.frequency.exponentialRampToValueAtTime(freq * mult, at + dur * 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain * level, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  }
  hiss(c, out, at, dur * 0.7, { type: "bandpass", freq: freq * 3, q: 1.4, peak: gain * 0.25, shape: "decrescendo" });
}

type Shape = "plateau" | "diamond" | "decrescendo" | "crescendo" | "breath-in" | "breath-out";

/** Filtered noise under an envelope: murmurs, breath, gurgles, crackles. */
function hiss(c: Ctx, out: AudioNode, at: number, dur: number, o: { type: BiquadFilterType; freq: number; q: number; peak: number; shape: Shape }) {
  if (dur <= 0.002 || o.peak <= 0) return;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = o.type;
  f.frequency.value = o.freq;
  f.Q.value = o.q;
  const g = c.createGain();
  const p = g.gain;
  const end = at + dur;
  p.setValueAtTime(0, at);
  switch (o.shape) {
    case "plateau":
      p.linearRampToValueAtTime(o.peak, at + Math.min(0.03, dur * 0.2));
      p.setValueAtTime(o.peak, end - Math.min(0.03, dur * 0.2));
      break;
    case "diamond":
      p.linearRampToValueAtTime(o.peak, at + dur * 0.5);
      break;
    case "decrescendo":
      p.linearRampToValueAtTime(o.peak, at + Math.min(0.01, dur * 0.1));
      break;
    case "crescendo":
      p.linearRampToValueAtTime(o.peak, end - dur * 0.1);
      break;
    case "breath-in":
      p.linearRampToValueAtTime(o.peak, at + dur * 0.7);
      break;
    case "breath-out":
      p.linearRampToValueAtTime(o.peak, at + dur * 0.15);
      break;
  }
  p.linearRampToValueAtTime(0, end);
  src.connect(f).connect(g).connect(out);
  src.start(at, rand(0, 2));
  src.stop(end + 0.02);
}

/** A tone with a little vibrato — wheeze and stridor are musical. */
function tone(c: Ctx, out: AudioNode, at: number, dur: number, freq: number, gain: number, type: OscillatorType = "sine") {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.linearRampToValueAtTime(freq * rand(0.9, 1.05), at + dur);
  const lfo = c.createOscillator();
  lfo.frequency.value = rand(5, 8);
  const depth = c.createGain();
  depth.gain.value = freq * 0.012;
  lfo.connect(depth).connect(osc.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + dur * 0.2);
  g.gain.setValueAtTime(gain, at + dur * 0.75);
  g.gain.linearRampToValueAtTime(0, at + dur);
  osc.connect(g).connect(out);
  for (const n of [osc, lfo]) {
    n.start(at);
    n.stop(at + dur + 0.05);
  }
}

function heart(c: Ctx, out: AudioNode, s: HeartSounds, from: number, until: number) {
  const base = 60 / s.rate;
  const loud = s.soft ? 0.35 : 1;
  let t = from + 0.25;
  while (t < until - 0.4) {
    const cycle = s.irregular ? base * rand(0.65, 1.35) : base * rand(0.985, 1.015);
    const systole = Math.min(0.36, Math.max(0.2, 0.42 - 0.0011 * s.rate)) * Math.min(1, cycle / base + 0.1);
    const s2 = t + systole;
    if (s.s4) thud(c, out, t - 0.09, 34, 0.07, 0.3 * loud);
    thud(c, out, t, 56, 0.11, 0.9 * loud); // S1 — mitral
    thud(c, out, t + 0.025, 50, 0.09, 0.45 * loud); // S1 — tricuspid
    thud(c, out, s2, 72, 0.08, 0.7 * loud); // S2 — aortic
    thud(c, out, s2 + 0.03, 66, 0.06, 0.32 * loud); // S2 — pulmonary
    if (s.s3) thud(c, out, s2 + 0.15, 36, 0.09, 0.4 * loud);
    if (s.murmur?.phase === "systolic") {
      const diamond = s.murmur.shape === "diamond";
      hiss(c, out, t + 0.06, systole - 0.08, { type: "bandpass", freq: diamond ? 190 : 300, q: diamond ? 0.9 : 1.3, peak: diamond ? 0.2 : 0.13, shape: diamond ? "diamond" : "plateau" });
    }
    if (s.murmur?.phase === "diastolic") {
      const diastole = cycle - systole;
      if (s.murmur.shape === "rumble") hiss(c, out, s2 + 0.16, diastole * 0.5, { type: "lowpass", freq: 95, q: 0.7, peak: 0.45, shape: "plateau" });
      else hiss(c, out, s2 + 0.02, Math.min(0.4, diastole * 0.6), { type: "bandpass", freq: 480, q: 0.9, peak: 0.09, shape: "decrescendo" });
    }
    if (s.rub) {
      hiss(c, out, t + 0.07, 0.12, { type: "bandpass", freq: 950, q: 3, peak: 0.07, shape: "diamond" });
      hiss(c, out, s2 + 0.12, 0.1, { type: "bandpass", freq: 900, q: 3, peak: 0.06, shape: "diamond" });
    }
    t += cycle;
  }
}

function lungs(c: Ctx, out: AudioNode, s: BreathSounds, from: number, until: number) {
  const cycle = 60 / s.rate;
  const insp = cycle * 0.4;
  const exp = cycle * 0.6;
  const level = { vesicular: 0.16, bronchial: 0.26, reduced: 0.05, absent: 0.008 }[s.breath];
  let t = from + 0.15;
  while (t < until - 0.3) {
    const bronchial = s.breath === "bronchial";
    hiss(c, out, t, insp, { type: "bandpass", freq: bronchial ? 750 : 380, q: 0.55, peak: level, shape: "breath-in" });
    if (bronchial) hiss(c, out, t + insp + 0.12, exp * 0.75, { type: "bandpass", freq: 820, q: 0.6, peak: level * 1.1, shape: "plateau" });
    else hiss(c, out, t + insp, exp * 0.35, { type: "bandpass", freq: 320, q: 0.55, peak: level * 0.4, shape: "breath-out" });
    if (s.crackles === "fine") {
      for (let i = 0, n = Math.round(rand(5, 9)); i < n; i++) hiss(c, out, t + insp * rand(0.55, 0.97), 0.005, { type: "bandpass", freq: rand(1500, 2400), q: 1.5, peak: 0.6, shape: "decrescendo" });
    }
    if (s.crackles === "coarse") {
      for (let i = 0, n = Math.round(rand(4, 7)); i < n; i++) {
        const at = i % 2 ? t + insp + exp * rand(0, 0.4) : t + insp * rand(0.05, 0.5);
        hiss(c, out, at, 0.014, { type: "bandpass", freq: rand(450, 750), q: 1.2, peak: 0.7, shape: "decrescendo" });
      }
    }
    if (s.wheeze) {
      const f = rand(360, 520);
      tone(c, out, t + insp + 0.04, exp * 0.85, f, 0.05);
      tone(c, out, t + insp + 0.08, exp * 0.7, f * rand(1.25, 1.45), 0.03);
    }
    if (s.stridor) tone(c, out, t + 0.04, insp * 0.9, rand(850, 1000), 0.04, "sawtooth");
    if (s.rub) hiss(c, out, t + insp * 0.85, 0.18, { type: "bandpass", freq: 380, q: 4, peak: 0.12, shape: "diamond" });
    t += cycle * rand(0.95, 1.05);
  }
}

function bowel(c: Ctx, out: AudioNode, s: BowelSounds, from: number, until: number) {
  const perMinute = { normal: 14, sluggish: 3, absent: 0, hyperactive: 45, tinkling: 18 }[s.activity];
  hiss(c, out, from, until - from, { type: "lowpass", freq: 200, q: 0.5, peak: 0.01, shape: "plateau" });
  let t = from + rand(0.4, s.activity === "sluggish" ? 4 : 1.8);
  while (perMinute && t < until - 0.5) {
    const tinkling = s.activity === "tinkling";
    for (let i = 0, n = Math.round(rand(3, tinkling ? 5 : 9)); i < n; i++) {
      const at = t + i * rand(0.04, 0.09);
      if (tinkling) tone(c, out, at, rand(0.03, 0.06), rand(1400, 2600), 0.035);
      else hiss(c, out, at, rand(0.03, 0.09), { type: "bandpass", freq: rand(160, 520), q: rand(4, 9), peak: s.activity === "hyperactive" ? 0.5 : 0.32, shape: "diamond" });
    }
    t += (60 / perMinute) * rand(0.4, 1.4);
  }
  if (s.bruit) {
    const beat = 60 / s.rate;
    for (let at = from + 0.3; at < until - 0.4; at += beat) hiss(c, out, at + 0.05, Math.min(0.28, beat * 0.4), { type: "bandpass", freq: 260, q: 1, peak: 0.09, shape: "diamond" });
  }
}

/**
 * Plays what the stethoscope picks up — several areas one after another.
 * Returns a function that stops it; starting another listen stops this one.
 */
export function playSounds(sounds: Auscultation[], seconds = LISTEN_SECONDS, onEnd?: () => void): () => void {
  stopCurrent?.();
  const c = context();
  const master = c.createGain();
  master.gain.value = 0.9;
  const comp = c.createDynamicsCompressor();
  master.connect(comp).connect(c.destination);
  const start = c.currentTime + 0.05;
  const each = seconds / Math.max(1, sounds.length);
  sounds.forEach((s, i) => {
    const from = start + i * each;
    const until = from + each;
    if (s.kind === "heart") heart(c, master, s, from, until);
    else if (s.kind === "lungs") lungs(c, master, s, from, until);
    else bowel(c, master, s, from, until);
  });
  const timer = window.setTimeout(() => stop(), (seconds + 0.2) * 1000);
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    master.gain.setTargetAtTime(0, c.currentTime, 0.03);
    window.setTimeout(() => master.disconnect(), 200);
    if (stopCurrent === stop) stopCurrent = null;
    onEnd?.();
  }
  stopCurrent = stop;
  return stop;
}

export const stethoscopeSupported = () => typeof window !== "undefined" && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
