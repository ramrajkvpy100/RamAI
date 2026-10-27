/**
 * The stethoscope, played from the server: heart, breath and bowel sounds
 * synthesised from a patient's acoustic parameters into a WAV file. The
 * browser receives the sound — never what it represents — so the only way to
 * know what's there is to listen.
 */
import { prngFrom } from "@/lib/prng";

import type { Auscultation, BowelSounds, BreathSounds, HeartSounds, VesselSounds } from "./types";

/** How long one listen lasts. */
export const LISTEN_SECONDS = 12;
/** Plenty for body sounds (all below ~2.5 kHz) and small on the wire. */
export const SAMPLE_RATE = 11025;

type Shape = "plateau" | "diamond" | "decrescendo" | "crescendo" | "breath-in" | "breath-out";

/** Envelope 0…1 at fraction x of a sound lasting dur seconds. */
function envelope(shape: Shape, x: number, dur: number): number {
  const edge = Math.min(0.03 / dur, 0.2);
  switch (shape) {
    case "plateau":
      return x < edge ? x / edge : x > 1 - edge ? (1 - x) / edge : 1;
    case "diamond":
      return x < 0.5 ? x / 0.5 : (1 - x) / 0.5;
    case "decrescendo": {
      const rise = Math.min(0.01 / dur, 0.1);
      return x < rise ? x / rise : (1 - x) / (1 - rise);
    }
    case "crescendo":
      return x < 0.9 ? x / 0.9 : (1 - x) / 0.1;
    case "breath-in":
      return x < 0.7 ? x / 0.7 : (1 - x) / 0.3;
    case "breath-out":
      return x < 0.15 ? x / 0.15 : (1 - x) / 0.85;
  }
}

/** A biquad filter (as in the Web Audio API): band-pass with 0 dB peak, or low-pass. */
function filter(type: "bandpass" | "lowpass", freq: number, q: number, rate: number) {
  const w0 = (2 * Math.PI * Math.min(freq, rate * 0.45)) / rate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const [b0, b1, b2] = type === "lowpass" ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [alpha, 0, -alpha];
  const [a0, a1, a2] = [1 + alpha, -2 * cos, 1 - alpha];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

class Mix {
  readonly data: Float32Array;
  constructor(
    readonly rate: number,
    seconds: number,
    readonly rand: () => number,
  ) {
    this.data = new Float32Array(Math.ceil(rate * seconds));
  }

  between = (a: number, b: number) => a + this.rand() * (b - a);

  /** Filtered noise under an envelope: murmurs, breath, gurgles, crackles. */
  hiss(at: number, dur: number, o: { type: "bandpass" | "lowpass"; freq: number; q: number; peak: number; shape: Shape }) {
    if (dur <= 0.002 || o.peak <= 0) return;
    const start = Math.floor(at * this.rate);
    const n = Math.floor(dur * this.rate);
    const f = filter(o.type, o.freq, o.q, this.rate);
    for (let i = 0; i < n; i++) {
      const k = start + i;
      if (k < 0 || k >= this.data.length) continue;
      this.data[k]! += f(this.rand() * 2 - 1) * o.peak * envelope(o.shape, i / n, dur);
    }
  }

  /** A soft thud — a heart sound: a low tone that drops in pitch, with a little grain. */
  thud(at: number, freq: number, dur: number, gain: number) {
    const start = Math.floor(at * this.rate);
    const n = Math.floor(dur * this.rate);
    const attack = Math.min(0.012, dur / 4);
    const decay = Math.log(1000) / Math.max(0.01, dur - attack);
    let p1 = 0;
    let p2 = 0;
    for (let i = 0; i < n; i++) {
      const k = start + i;
      if (k < 0 || k >= this.data.length) continue;
      const t = i / this.rate;
      const glide = 1 + 0.35 * Math.max(0, 1 - t / (dur * 0.6));
      p1 += (2 * Math.PI * freq * glide) / this.rate;
      p2 += (2 * Math.PI * freq * 2.3 * glide) / this.rate;
      const env = t < attack ? t / attack : Math.exp(-decay * (t - attack));
      this.data[k]! += gain * env * (Math.sin(p1) + 0.35 * (2 / Math.PI) * Math.asin(Math.sin(p2)));
    }
    this.hiss(at, dur * 0.7, { type: "bandpass", freq: freq * 3, q: 1.4, peak: gain * 0.25, shape: "decrescendo" });
  }

  /** A tone with a little vibrato — wheeze and stridor are musical. */
  tone(at: number, dur: number, freq: number, gain: number, wave: "sine" | "saw" = "sine") {
    const start = Math.floor(at * this.rate);
    const n = Math.floor(dur * this.rate);
    const vibrato = this.between(5, 8);
    const end = this.between(0.9, 1.05);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const k = start + i;
      if (k < 0 || k >= this.data.length) continue;
      const x = i / n;
      const t = i / this.rate;
      const f = freq * (1 + (end - 1) * x) * (1 + 0.012 * Math.sin(2 * Math.PI * vibrato * t));
      phase += (2 * Math.PI * f) / this.rate;
      const env = x < 0.2 ? x / 0.2 : x > 0.75 ? (1 - x) / 0.25 : 1;
      const v = wave === "sine" ? Math.sin(phase) : ((phase / (2 * Math.PI)) % 1) * 2 - 1;
      this.data[k]! += gain * env * v;
    }
  }
}

function heart(m: Mix, s: HeartSounds, from: number, until: number) {
  const base = 60 / s.rate;
  const loud = s.soft ? 0.35 : 1;
  let t = from + 0.25;
  while (t < until - 0.4) {
    const cycle = s.irregular ? base * m.between(0.65, 1.35) : base * m.between(0.985, 1.015);
    const systole = Math.min(0.36, Math.max(0.2, 0.42 - 0.0011 * s.rate)) * Math.min(1, cycle / base + 0.1);
    const s2 = t + systole;
    if (s.s4) m.thud(t - 0.09, 34, 0.07, 0.3 * loud);
    m.thud(t, 56, 0.11, 0.9 * loud);
    m.thud(t + 0.025, 50, 0.09, 0.45 * loud);
    m.thud(s2, 72, 0.08, 0.7 * loud);
    m.thud(s2 + 0.03, 66, 0.06, 0.32 * loud);
    if (s.s3) m.thud(s2 + 0.15, 36, 0.09, 0.4 * loud);
    if (s.click) m.thud(t + systole * 0.55, 140, 0.03, 0.55 * loud);
    if (s.snap) m.thud(s2 + 0.08, 150, 0.03, 0.5 * loud);
    if (s.murmur?.phase === "systolic") {
      const sh = s.murmur.shape;
      if (sh === "late") m.hiss(t + systole * 0.58, systole * 0.4, { type: "bandpass", freq: 320, q: 1.2, peak: 0.22, shape: "crescendo" });
      else if (sh === "harsh") m.hiss(t + 0.04, systole - 0.06, { type: "bandpass", freq: 420, q: 0.7, peak: 0.34, shape: "plateau" });
      else {
        const diamond = sh === "diamond";
        m.hiss(t + 0.06, systole - 0.08, { type: "bandpass", freq: diamond ? 190 : 300, q: diamond ? 0.9 : 1.3, peak: diamond ? 0.32 : 0.22, shape: diamond ? "diamond" : "plateau" });
      }
    }
    if (s.murmur?.phase === "continuous") {
      // Machinery: rising through systole to a peak at S2, fading through diastole — no gap.
      m.hiss(t + 0.03, systole, { type: "bandpass", freq: 260, q: 0.8, peak: 0.3, shape: "crescendo" });
      m.hiss(s2, cycle - systole - 0.02, { type: "bandpass", freq: 260, q: 0.8, peak: 0.3, shape: "decrescendo" });
    }
    if (s.murmur?.phase === "diastolic") {
      const diastole = cycle - systole;
      if (s.murmur.shape === "rumble") m.hiss(s2 + 0.16, diastole * 0.5, { type: "lowpass", freq: 95, q: 0.7, peak: 0.6, shape: "plateau" });
      else m.hiss(s2 + 0.02, Math.min(0.4, diastole * 0.6), { type: "bandpass", freq: 480, q: 0.9, peak: 0.16, shape: "decrescendo" });
    }
    if (s.rub) {
      m.hiss(t + 0.07, 0.12, { type: "bandpass", freq: 950, q: 3, peak: 0.12, shape: "diamond" });
      m.hiss(s2 + 0.12, 0.1, { type: "bandpass", freq: 900, q: 3, peak: 0.1, shape: "diamond" });
    }
    t += cycle;
  }
}

function lungs(m: Mix, s: BreathSounds, from: number, until: number) {
  const cycle = 60 / s.rate;
  const insp = cycle * 0.4;
  const exp = cycle * 0.6;
  const level = { vesicular: 0.26, bronchial: 0.42, reduced: 0.08, absent: 0.012 }[s.breath];
  let t = from + 0.15;
  while (t + insp + 0.3 < until) {
    const bronchial = s.breath === "bronchial";
    m.hiss(t, insp, { type: "bandpass", freq: bronchial ? 750 : 380, q: 0.55, peak: level, shape: "breath-in" });
    if (bronchial) m.hiss(t + insp + 0.12, exp * 0.75, { type: "bandpass", freq: 820, q: 0.6, peak: level * 1.1, shape: "plateau" });
    else m.hiss(t + insp, exp * 0.35, { type: "bandpass", freq: 320, q: 0.55, peak: level * 0.4, shape: "breath-out" });
    if (s.crackles === "fine") {
      for (let i = 0, n = Math.round(m.between(5, 9)); i < n; i++) m.hiss(t + insp * m.between(0.55, 0.97), 0.005, { type: "bandpass", freq: m.between(1500, 2400), q: 1.5, peak: 0.9, shape: "decrescendo" });
    }
    if (s.crackles === "coarse") {
      for (let i = 0, n = Math.round(m.between(4, 7)); i < n; i++) {
        const at = i % 2 ? t + insp + exp * m.between(0, 0.4) : t + insp * m.between(0.05, 0.5);
        m.hiss(at, 0.014, { type: "bandpass", freq: m.between(450, 750), q: 1.2, peak: 1.1, shape: "decrescendo" });
      }
    }
    if (s.wheeze) {
      const f = m.between(360, 520);
      m.tone(t + insp + 0.04, exp * 0.85, f, 0.07);
      m.tone(t + insp + 0.08, exp * 0.7, f * m.between(1.25, 1.45), 0.045);
    }
    if (s.stridor) m.tone(t + 0.04, insp * 0.9, m.between(850, 1000), 0.05, "saw");
    if (s.rub) m.hiss(t + insp * 0.85, 0.18, { type: "bandpass", freq: 380, q: 4, peak: 0.2, shape: "diamond" });
    t += cycle * m.between(0.95, 1.05);
  }
}

function bowel(m: Mix, s: BowelSounds, from: number, until: number) {
  const perMinute = { normal: 14, sluggish: 3, absent: 0, hyperactive: 45, tinkling: 18 }[s.activity];
  m.hiss(from, until - from, { type: "lowpass", freq: 200, q: 0.5, peak: 0.015, shape: "plateau" });
  let t = from + m.between(0.4, s.activity === "sluggish" ? 4 : 1.8);
  while (perMinute && t < until - 0.5) {
    const tinkling = s.activity === "tinkling";
    for (let i = 0, n = Math.round(m.between(3, tinkling ? 5 : 9)); i < n; i++) {
      const at = t + i * m.between(0.04, 0.09);
      if (tinkling) m.tone(at, m.between(0.03, 0.06), m.between(1400, 2400), 0.05);
      else m.hiss(at, m.between(0.03, 0.09), { type: "bandpass", freq: m.between(160, 520), q: m.between(4, 9), peak: s.activity === "hyperactive" ? 0.8 : 0.5, shape: "diamond" });
    }
    t += (60 / perMinute) * m.between(0.4, 1.4);
  }
  if (s.bruit) {
    const beat = 60 / s.rate;
    for (let at = from + 0.3; at < until - 0.4; at += beat) m.hiss(at + 0.05, Math.min(0.28, beat * 0.4), { type: "bandpass", freq: 260, q: 1, peak: 0.14, shape: "diamond" });
  }
}

function vessel(m: Mix, s: VesselSounds, from: number, until: number) {
  const beat = 60 / s.rate;
  const freq = s.pitch === "low" ? 180 : 340;
  // The pulse itself, soft, in the background.
  for (let at = from + 0.25; at < until - 0.3; at += beat * m.between(0.98, 1.02)) {
    m.thud(at, 45, 0.06, 0.12);
    if (s.sound === "systolic-bruit") m.hiss(at + 0.04, Math.min(0.3, beat * 0.38), { type: "bandpass", freq, q: 1, peak: 0.3, shape: "diamond" });
    if (s.sound === "continuous-bruit") {
      m.hiss(at + 0.02, beat * 0.4, { type: "bandpass", freq, q: 0.8, peak: 0.34, shape: "crescendo" });
      m.hiss(at + beat * 0.42, beat * 0.56, { type: "bandpass", freq, q: 0.8, peak: 0.24, shape: "decrescendo" });
    }
  }
  // Venous hum: a soft, steady low roar, a little louder in diastole.
  if (s.sound === "venous-hum") m.hiss(from + 0.1, until - from - 0.2, { type: "lowpass", freq: 160, q: 0.6, peak: 0.25, shape: "plateau" });
  m.hiss(from, until - from, { type: "lowpass", freq: 200, q: 0.5, peak: 0.012, shape: "plateau" });
}

/** Breath and bowel sounds are quieter than the heart at the chest piece; bring them up so a phone speaker carries them. */
const LEVEL = { heart: 1, lungs: 3.2, bowel: 3, vessel: 2 } as const;

/** Several areas, one after another, as a stethoscope moves. Same parameters and seed, same sound. */
export function renderAuscultation(sounds: Auscultation[], seed: number, seconds = LISTEN_SECONDS, rate = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(Math.ceil(rate * seconds));
  const rand = prngFrom(seed);
  const each = seconds / Math.max(1, sounds.length);
  const fade = Math.floor(0.05 * rate);
  sounds.forEach((s, i) => {
    const from = i * each;
    const until = from + each;
    const m = new Mix(rate, seconds, rand);
    if (s.kind === "heart") heart(m, s, from, until);
    else if (s.kind === "lungs") lungs(m, s, from, until);
    else if (s.kind === "vessel") vessel(m, s, from, until);
    else bowel(m, s, from, until);
    // Each area stays in its own stretch of time, with a soft edge as the chest piece moves.
    const a = Math.floor(from * rate);
    const b = Math.min(out.length, Math.floor(until * rate));
    for (let k = a; k < b; k++) out[k]! += m.data[k]! * LEVEL[s.kind] * Math.min(1, (k - a) / fade, (b - k) / fade);
  });
  // Gentle saturation instead of hard clipping.
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i]! * 1.1);
  return out;
}

/** Louder for phone speakers: soft parts lifted about twice, peaks kept below clipping (soft stays relatively soft). */
export function loud(x: Float32Array) {
  const k = 2, norm = Math.tanh(k);
  return x.map((v) => (Math.tanh(v * k) / norm) * 0.98);
}

/** 16-bit mono PCM WAV. */
export function toWav(samples: Float32Array, rate = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i]!)) * 0x7fff, true);
  return bytes;
}

/** A stable seed from text (the session and message), so a replay sounds the same. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
