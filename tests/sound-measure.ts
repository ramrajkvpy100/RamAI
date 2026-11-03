/**
 * Measures what the stethoscope engine actually renders: event timing from the envelope, band energy from a DFT,
 * peaks and saturation after loud(). Nothing here reads the engine's parameters: only the audio it produces.
 * These are measurements of a synthesis. They say nothing about how it sounds to a listener.
 */
import { loud, renderAuscultation, SAMPLE_RATE, type SoundParams } from "@/engine/stethoscope-audio";

const R = SAMPLE_RATE;

export type Render = (s: SoundParams[], seed: number) => Float32Array;
let render: Render = renderAuscultation as Render;
/** Lets the same meter read another copy of the engine (the "before" column of the audit). */
export const useRender = (r: Render) => {
  render = r;
};

let defaultSeed = 7;
/** Which recording to read: the noise and, in AF, the rhythm change with the seed; the findings shouldn't. */
export const useSeed = (seed: number) => {
  defaultSeed = seed;
};

/** What a listener receives: the engine through loud(). */
export const played = (s: SoundParams, seed = defaultSeed) => loud(render([s], seed));

/* ------------------------------- primitives ------------------------------ */

function biquad(type: "lp" | "hp", f: number, x: Float32Array): Float32Array {
  const w = (2 * Math.PI * f) / R;
  const c = Math.cos(w);
  const a = Math.sin(w) / (2 * Math.SQRT1_2);
  const [b0, b1, b2] = type === "lp" ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const [a0, a1, a2] = [1 + a, -2 * c, 1 - a];
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i]! + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]!; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** A band of the signal: 4th-order Butterworth edges. */
export const band = (x: Float32Array, lo: number, hi: number) => biquad("lp", hi, biquad("lp", hi, biquad("hp", lo, biquad("hp", lo, x))));

/** RMS envelope at 1 ms steps. */
export function envelope(x: Float32Array, winMs = 5): Float32Array {
  const win = Math.max(1, Math.round((winMs / 1000) * R));
  const hop = R / 1000;
  const n = Math.floor(x.length / hop);
  const sq = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) sq[i + 1] = sq[i]! + x[i]! * x[i]!;
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const c = Math.round(k * hop);
    const a = Math.max(0, c - (win >> 1));
    const b = Math.min(x.length, a + win);
    out[k] = Math.sqrt((sq[b]! - sq[a]!) / Math.max(1, b - a));
  }
  return out;
}

const median = (v: number[]) => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s[s.length >> 1]!;
};
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const rms = (x: ArrayLike<number>) => {
  let n = 0;
  for (let i = 0; i < x.length; i++) n += x[i]! * x[i]!;
  return Math.sqrt(n / Math.max(1, x.length));
};

/** Averaged Hann-windowed power spectrum of the given stretches of signal (times in seconds), 20–5000 Hz. */
export function spectrum(x: Float32Array, stretches: [number, number][], step = 10) {
  const freqs: number[] = [];
  for (let f = 20; f <= 5000; f += f < 1000 ? step : step * 4) freqs.push(f);
  const power = new Float64Array(freqs.length);
  let used = 0;
  // A long stretch is read as four evenly spaced 1024-sample pieces: much faster, and a sound in only part of it isn't missed.
  const pieces = stretches.flatMap(([from, to]): [number, number][] => {
    const a = Math.max(0, Math.floor(from * R));
    const b = Math.min(x.length, Math.floor(to * R));
    if (b - a <= 2048) return [[a, b]];
    return [0, 1, 2, 3].map((i) => {
      const at = a + Math.floor(((b - a - 1024) * i) / 3);
      return [at, at + 1024] as [number, number];
    });
  });
  for (const [a, b] of pieces) {
    const n = b - a;
    if (n < 16) continue;
    used++;
    freqs.forEach((f, k) => {
      const w = (2 * Math.PI * f) / R;
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
        re += x[a + i]! * h * Math.cos(w * i);
        im += x[a + i]! * h * Math.sin(w * i);
      }
      // Width of this frequency bin: the grid is coarser above 1 kHz.
      power[k]! += ((re * re + im * im) / n) * (f < 1000 ? step : step * 4);
    });
  }
  const total = power.reduce((a, b) => a + b, 0) || 1;
  const fraction = (lo: number, hi: number) => freqs.reduce((a, f, k) => a + (f >= lo && f <= hi ? power[k]! : 0), 0) / total;
  let top = 0;
  power.forEach((p, k) => {
    if (p > power[top]!) top = k;
  });
  const centroid = freqs.reduce((a, f, k) => a + f * power[k]!, 0) / total;
  /** Separate spectral peaks in a range standing at least `floor` of the tallest there. */
  const peaks = (lo: number, hi: number, floor = 0.15, apart = 30) => {
    const inside = freqs.map((f, k) => ({ f, p: power[k]! })).filter((v) => v.f >= lo && v.f <= hi);
    const max = Math.max(...inside.map((v) => v.p));
    const out: number[] = [];
    inside.forEach((v, i) => {
      if (v.p >= max * floor && v.p >= (inside[i - 1]?.p ?? 0) && v.p > (inside[i + 1]?.p ?? 0) && !out.some((f) => Math.abs(f - v.f) < apart)) out.push(v.f);
    });
    return out;
  };
  return { peakHz: freqs[top]!, centroid, fraction, peaks, used };
}

/** Local maxima of an envelope at or above `floor` of its top, at least `apartMs` apart (taller wins). */
function localPeaks(env: Float32Array, from: number, to: number, floor: number, apartMs: number): number[] {
  const a = Math.max(1, from), b = Math.min(env.length - 1, to);
  let top = 0;
  for (let k = a; k < b; k++) top = Math.max(top, env[k]!);
  const out: number[] = [];
  for (let k = a; k < b; k++) {
    if (env[k]! < top * floor || env[k]! < env[k - 1]! || env[k]! < env[k + 1]!) continue;
    const last = out[out.length - 1];
    if (last !== undefined && k - last < apartMs) {
      if (env[k]! > env[last]!) out[out.length - 1] = k;
    } else out.push(k);
  }
  return out;
}

/** Where a peak's rise begins, and the width it holds above `level` of its height (−20 dB = 0.1). */
function extent(env: Float32Array, peak: number, level: number, lo: number, hi: number) {
  let a = peak;
  while (a > lo && env[a - 1]! >= env[peak]! * level) a--;
  let b = peak;
  while (b < hi && env[b + 1]! >= env[peak]! * level) b++;
  return { start: a, end: b, width: b - a };
}

/** Loudness through a stretch of time: `bins` slices of each [start, end], averaged across beats, top = 1. */
function shape(env: Float32Array, stretches: [number, number][], bins = 20): number[] {
  const out = new Array<number>(bins).fill(0);
  for (const [s, e] of stretches) {
    for (let b = 0; b < bins; b++) {
      const a = Math.floor(s * 1000 + ((e - s) * 1000 * b) / bins);
      const z = Math.max(a + 1, Math.floor(s * 1000 + ((e - s) * 1000 * (b + 1)) / bins));
      let n = 0;
      for (let k = a; k < z; k++) n += env[k] ?? 0;
      out[b]! += n / (z - a);
    }
  }
  const top = Math.max(...out) || 1;
  return out.map((v) => v / top);
}
const argmax = (v: number[]) => v.reduce((best, x, i) => (x > v[best]! ? i : best), 0);

/** The output's level: peak, RMS, and how much of the loud part sits in saturation (samples at or above 0.95, the top of loud()'s curve). */
export function level(y: Float32Array) {
  let peak = 0, sat = 0, loudN = 0;
  for (const v of y) {
    const a = Math.abs(v);
    peak = Math.max(peak, a);
    if (a >= 0.95) sat++;
    if (a >= 0.1) loudN++;
  }
  return { peak, rms: rms(y), saturated: sat / y.length, satOfLoud: loudN ? sat / loudN : 0 };
}

const round = (v: number, d = 0) => (Number.isFinite(v) ? Number(v.toFixed(d)) : NaN);

/* --------------------------------- heart --------------------------------- */

type Grid = { s1: number[]; s2: number[] };

/**
 * The beat grid, measured from a clean recording of the same rhythm (same rate and seed, no added sounds): the rhythm
 * comes from its own random stream in the engine, so it is the same in the sound under test. Onset = where the rise starts.
 */
export function heartGrid(rate: number, irregular: boolean | undefined, seed: number): Grid {
  const ref = played({ kind: "heart", rate, ...(irregular ? { irregular } : {}) }, seed);
  const env = envelope(band(ref, 20, 300), 5);
  const peaks = localPeaks(env, 0, env.length, 0.25, 130);
  const onsets = peaks.map((p) => extent(env, p, 0.15, Math.max(0, p - 60), p).start / 1000);
  const s1: number[] = [], s2: number[] = [];
  onsets.forEach((t, i) => (i % 2 === 0 ? s1 : s2).push(t));
  return { s1, s2 };
}

/** Times at which a new sound starts inside a window: steps up in the high band's envelope. */
function onsetsIn(env: Float32Array, from: number, to: number, floor = 0.35) {
  const score: number[] = [];
  const lead = 6;
  const a = Math.floor(from * 1000);
  const b = Math.floor(to * 1000);
  for (let k = a; k < b; k++) score.push(Math.max(0, (env[k + lead] ?? 0) - (env[k - 2] ?? 0)));
  const top = Math.max(...score, 1e-9);
  const out: { at: number; strength: number }[] = [];
  for (let i = 1; i < score.length - 1; i++) {
    if (score[i]! < top * floor || score[i]! < score[i - 1]! || score[i]! < score[i + 1]!) continue;
    const last = out[out.length - 1];
    const at = (a + i) / 1000;
    if (last && at - last.at < 0.012) {
      if (score[i]! > last.strength) { last.at = at; last.strength = score[i]!; }
    } else out.push({ at, strength: score[i]! });
  }
  return out;
}

/**
 * A2–P2 for each beat, in ms, by the phase of the engine's 4-second breath. Three recordings pooled: only three beats in
 * each fall at the emptiest of a breath, and one beat's reading can be thrown by noise in the two sounds' ringing.
 */
export function splitGap(s: Extract<SoundParams, { kind: "heart" }>, seed = defaultSeed) {
  const beats = [seed, seed + 1, seed + 2].flatMap((sd) => {
    const y = played(s, sd);
    const grid = heartGrid(s.rate, s.irregular, sd);
    const env = envelope(band(y, 110, 900), 3);
    return grid.s2.slice(0, -1).map((t) => {
      // The two strongest steps up are the two closures; a step under 40% of the strongest is ringing, not a valve.
      const ons = onsetsIn(env, t - 0.015, t + 0.11, 0.4).sort((a, b) => b.strength - a.strength).slice(0, 2);
      const gap = ons.length === 2 ? Math.abs(ons[0]!.at - ons[1]!.at) : 0;
      return { t, gap: gap * 1000, resp: Math.sin((2 * Math.PI * t) / 4) };
    });
  });
  const insp = beats.filter((b) => b.resp > 0.5).map((b) => b.gap);
  const exp = beats.filter((b) => b.resp < -0.5).map((b) => b.gap);
  return { beats, inspMs: median(insp), expMs: median(exp) };
}

/** Does the soft breath heard behind the beat rise with the engine's inspiration? +1 = in step. */
export function breathCue(y: Float32Array) {
  const env = envelope(band(y, 1000, 2600), 60);
  let a = 0, b = 0;
  for (let k = 500; k < env.length - 500; k++) (Math.sin((2 * Math.PI * k) / 4000) > 0 ? (a += env[k]!) : (b += env[k]!));
  return { insp: a, exp: b };
}

export interface HeartReading {
  s1Ms: number; s1Hz: number; s1Frac: number;
  s2Ms: number; s2Hz: number; s2Frac: number;
  systoleMs: number; diastoleMs: number;
  s3AfterS2Ms: number; s3Hz: number; s3Frac: number;
  s4BeforeS1Ms: number; s4Hz: number; s4Frac: number;
  sysHz: number; sysFrac: number; sysPeakAt: number; sysFlat: number; sysShape: number[]; sysRatio: number;
  diaHz: number; diaFrac200: number; diaFrac300: number; diaShape: number[]; diaRatio: number;
  s1Spread: number; rrSpread: number;
  rms: number; peak: number; satOfLoud: number;
}

/** Everything measurable about one heart sound. Timing bands: S1/S2/S3/S4 in 20–300 Hz; murmurs in 200–600 Hz. */
export function readHeart(s: Extract<SoundParams, { kind: "heart" }>, seed = defaultSeed): HeartReading {
  const y = played(s, seed);
  const lv = level(y);
  const g = heartGrid(s.rate, s.irregular, seed);
  const beats = g.s2.length - 1;
  const low = band(y, 20, 300);
  const lowEnv = envelope(low, 5);

  const event = (starts: number[], before: number, after: number) => {
    const widths: number[] = [];
    const stretches: [number, number][] = [];
    for (const t of starts) {
      const a = Math.max(0, Math.floor((t - before) * 1000));
      const b = Math.floor((t + after) * 1000);
      const p = localPeaks(lowEnv, a, b, 1, 1)[0] ?? a;
      const e = extent(lowEnv, p, 0.1, a, b);
      widths.push(e.width);
      stretches.push([e.start / 1000 - 0.003, e.start / 1000 + Math.max(0.05, e.width / 1000)]);
    }
    const sp = spectrum(y, stretches);
    return { ms: median(widths), sp };
  };

  const s1 = event(g.s1.slice(0, beats), 0.012, 0.2);
  const s2 = event(g.s2.slice(0, beats), 0.012, 0.16);
  const systoles = g.s2.map((t, i) => t - g.s1[i]!).slice(0, beats);
  const diastoles = g.s2.slice(0, beats).map((t, i) => (g.s1[i + 1] ?? NaN) - t);

  // S3: the next low sound 80–260 ms after S2. S4: the low sound 40–160 ms before S1.
  const lateStart = (from: number, to: number) => {
    const a = Math.floor(from * 1000), b = Math.floor(to * 1000);
    const p = localPeaks(lowEnv, a, b, 0.6, 30)[0];
    if (p === undefined) return null;
    return { start: extent(lowEnv, p, 0.15, a, p).start / 1000, height: lowEnv[p]! };
  };
  const s1Height = median(g.s1.slice(0, beats).map((t) => Math.max(...lowEnv.slice(Math.floor(t * 1000), Math.floor(t * 1000) + 50))));
  const s3Hits = g.s2.slice(0, beats).map((t) => ({ t, h: lateStart(t + 0.085, t + 0.26) })).filter((v) => v.h && v.h.height > s1Height * 0.12);
  const s4Hits = g.s1.slice(1, beats).map((t) => ({ t, h: lateStart(t - 0.16, t - 0.03) })).filter((v) => v.h && v.h.height > s1Height * 0.12);
  const s3 = s3Hits.length ? spectrum(y, s3Hits.map((v) => [v.h!.start, v.h!.start + 0.06])) : null;
  const s4 = s4Hits.length ? spectrum(y, s4Hits.map((v) => [v.h!.start, v.h!.start + 0.06])) : null;

  const murmurEnv = envelope(band(y, 200, 600), 10);
  const sysWin = g.s2.slice(0, beats).map((t, i): [number, number] => [g.s1[i]!, t]);
  const sysShape = shape(murmurEnv, sysWin);
  const sysSp = spectrum(y, sysWin.map(([a, b]) => [a + 0.05, b - 0.012]));
  const inner = sysShape.slice(4, 18);
  const coarse = shape(murmurEnv, sysWin, 10).slice(2, 9);
  const diaWin = g.s2.slice(0, beats).map((t, i): [number, number] => [t, g.s1[i + 1] ?? t + 0.4]);
  const diaEnv = envelope(band(y, 60, 600), 10);
  const diaShape = shape(diaEnv, diaWin);
  const diaSp = spectrum(y, diaWin.map(([a, b]) => [a + 0.06, b - 0.012]));

  const s1Amp = g.s1.slice(0, beats).map((t) => Math.max(...lowEnv.slice(Math.floor(t * 1000), Math.floor(t * 1000) + 60)));
  const rr = g.s1.slice(1).map((t, i) => t - g.s1[i]!);
  return {
    s1Ms: s1.ms, s1Hz: round(s1.sp.peakHz), s1Frac: round(s1.sp.fraction(50, 150), 2),
    s2Ms: s2.ms, s2Hz: round(s2.sp.peakHz), s2Frac: round(s2.sp.fraction(50, 200), 2),
    systoleMs: round(median(systoles) * 1000), diastoleMs: round(median(diastoles.filter(Number.isFinite)) * 1000),
    s3AfterS2Ms: s3Hits.length >= beats * 0.5 ? round(median(s3Hits.map((v) => v.h!.start - v.t)) * 1000) : NaN,
    s3Hz: s3 ? round(s3.peakHz) : NaN, s3Frac: s3 ? round(s3.fraction(40, 100), 2) : NaN,
    s4BeforeS1Ms: s4Hits.length >= beats * 0.5 ? round(median(s4Hits.map((v) => v.t - v.h!.start)) * 1000) : NaN,
    s4Hz: s4 ? round(s4.peakHz) : NaN, s4Frac: s4 ? round(s4.fraction(40, 100), 2) : NaN,
    sysHz: round(sysSp.centroid), sysFrac: round(sysSp.fraction(200, 600), 2),
    sysPeakAt: round(argmax(sysShape.slice(2, 19)) / 17 + 0.03, 2), sysFlat: round(Math.min(...coarse) / Math.max(...coarse), 2), sysShape: sysShape.map((v) => round(v, 2)),
    sysRatio: round(mean(inner) * Math.max(...shapeRaw(murmurEnv, sysWin)) / Math.max(s1Height, 1e-6), 2),
    diaHz: round(diaSp.centroid), diaFrac200: round(diaSp.fraction(200, 600), 2), diaFrac300: round(diaSp.fraction(300, 600), 2), diaShape: diaShape.map((v) => round(v, 2)),
    diaRatio: round(Math.max(...shapeRaw(diaEnv, diaWin).slice(3, 18)) / Math.max(s1Height, 1e-6), 2),
    s1Spread: round((Math.max(...s1Amp) - Math.min(...s1Amp)) / Math.max(...s1Amp), 2),
    rrSpread: round((Math.max(...rr) - Math.min(...rr)) / mean(rr), 2),
    rms: round(lv.rms, 3), peak: round(lv.peak, 3), satOfLoud: round(lv.satOfLoud, 3),
  };
}

function shapeRaw(env: Float32Array, stretches: [number, number][], bins = 20): number[] {
  const out = new Array<number>(bins).fill(0);
  for (const [s, e] of stretches) {
    for (let b = 0; b < bins; b++) {
      const a = Math.floor(s * 1000 + ((e - s) * 1000 * b) / bins);
      const z = Math.max(a + 1, Math.floor(s * 1000 + ((e - s) * 1000 * (b + 1)) / bins));
      let n = 0;
      for (let k = a; k < z; k++) n += env[k] ?? 0;
      out[b]! += n / (z - a);
    }
  }
  return out.map((v) => v / stretches.length);
}

/** Short bursts of loudness in one 20 ms-sliced window of the cycle, for the three parts of a pericardial rub. */
export function rubParts(s: Extract<SoundParams, { kind: "heart" }>, seed = defaultSeed) {
  const y = played(s, seed);
  const g = heartGrid(s.rate, s.irregular, seed);
  const env = envelope(band(y, 350, 2000), 10);
  const beats = g.s2.length - 1;
  const inWin = (a: (i: number) => number, b: (i: number) => number) => {
    let n = 0, c = 0;
    for (let i = 0; i < beats; i++) for (let k = Math.floor(a(i) * 1000); k < b(i) * 1000; k++) { n += env[k] ?? 0; c++; }
    return n / Math.max(1, c);
  };
  const sys = inWin((i) => g.s1[i]! + 0.04, (i) => g.s2[i]! - 0.02);
  const dia = (i: number) => (g.s1[i + 1] ?? g.s2[i]! + 0.5) - g.s2[i]!;
  const early = inWin((i) => g.s2[i]! + 0.06, (i) => g.s2[i]! + dia(i) * 0.5);
  const late = inWin((i) => g.s2[i]! + dia(i) * 0.65, (i) => g.s1[i + 1] ?? g.s2[i]! + dia(i));
  const quiet = inWin((i) => g.s2[i]! + dia(i) * 0.5, (i) => g.s2[i]! + dia(i) * 0.65);
  return { sys, early, late, quiet };
}

/* --------------------------------- lungs --------------------------------- */

export interface LungReading {
  insps: number[]; inspMs: number; cycleMs: number;
  crackles: { perBreath: number; atFraction: number; inInsp: number; peakHz: number; centroid: number; widthMs: number };
  inspFracAbove500: number; inspRms: number; expRms: number;
  expPeaks: number[]; expFrac400_800: number; expCentroid: number; inspPeaks: number[];
  pauseMs: number;
  rms: number; peak: number; satOfLoud: number; wholeCentroid: number;
}

/** Each inspiration's start, from a clean vesicular recording at the same rate and seed: the rise of its loudness, extrapolated to zero. */
export function breathGrid(rate: number, seed: number) {
  const ref = played({ kind: "lungs", rate, breath: "vesicular" }, seed);
  const env = envelope(ref, 60);
  const peaks = localPeaks(env, 0, env.length, 0.55, ((60 / rate) * 1000) / 2);
  const starts: number[] = [];
  const insp: number[] = [];
  for (const p of peaks) {
    let a = p, b = p;
    while (a > 0 && env[a]! > env[p]! * 0.25) a--;
    while (b > a && env[b]! > env[p]! * 0.75) b--;
    const slope = (env[b]! - env[a]!) / Math.max(1, b - a);
    const start = a - env[a]! / Math.max(slope, 1e-9);
    starts.push(start / 1000);
    insp.push((p - start) / 700);
  }
  return { starts, insp: median(insp), cycle: median(starts.slice(1).map((t, i) => t - starts[i]!)) };
}

export function readLungs(s: Extract<SoundParams, { kind: "lungs" }>, seed = defaultSeed): LungReading {
  const y = played(s, seed);
  const lv = level(y);
  const g = breathGrid(s.rate, seed);
  const inspSec = s.wheezeKind === "polyphonic" ? g.cycle * 0.3 : g.insp;

  // Crackles: sharp bursts standing well clear of the running level of the breath, in the band each kind lives in.
  const [cLo, cHi] = s.crackles === "coarse" ? [150, 350] : [450, 1000];
  const hi = band(y, cLo, cHi);
  const env = envelope(hi, 3);
  const hits: { at: number; h: number }[] = [];
  const typical = (k: number) => median(Array.from({ length: 40 }, (_, i) => env[k - 200 + i * 10] ?? 0));
  const gapMin = s.crackles === "coarse" ? 0.03 : 0.012;
  const tallest = env.reduce((a, v) => Math.max(a, v), 0);
  for (let k = 2; s.crackles && k < env.length - 2; k++) {
    if (env[k]! >= env[k - 1]! && env[k]! > env[k + 1]! && env[k]! > 0.4 * tallest && env[k]! > 2.2 * typical(k)) {
      const last = hits[hits.length - 1];
      if (last && k / 1000 - last.at < gapMin) {
        if (env[k]! > last.h) { last.at = k / 1000; last.h = env[k]!; }
      } else hits.push({ at: k / 1000, h: env[k]! });
    }
  }
  const whereIn = (t: number) => {
    let i = g.starts.length - 1;
    while (i > 0 && g.starts[i]! > t) i--;
    return (t - g.starts[i]!) / inspSec;
  };
  const fr = hits.map((h) => whereIn(h.at));
  const crackleSp = spectrum(y, hits.slice(0, 60).map((h) => [h.at - 0.012, h.at + 0.016] as [number, number]));
  const widths = hits.slice(0, 60).map((h) => extent(env, Math.floor(h.at * 1000), 0.316, Math.floor(h.at * 1000) - 25, Math.floor(h.at * 1000) + 40).width);

  const windows = g.starts.slice(0, -1).map((t, i) => ({ insp: [t + inspSec * 0.1, t + inspSec * 0.95] as [number, number], exp: [t + inspSec + 0.05, (g.starts[i + 1] ?? t) - 0.05] as [number, number] }));
  const inspSp = spectrum(y, windows.map((w) => w.insp));
  const expSp = spectrum(y, windows.map((w) => w.exp));
  const stretchRms = (ws: [number, number][]) => rms(ws.flatMap(([a, b]) => Array.from(y.subarray(Math.floor(a * R), Math.floor(b * R)))));

  // The longest near-silent stretch between inspiration's peak and the end of expiration.
  const breathEnv = envelope(y, 25);
  const pauses = g.starts.slice(0, -1).map((t, i) => {
    const from = Math.floor((t + inspSec * 0.7) * 1000);
    const to = Math.floor((g.starts[i + 1]! - 0.1) * 1000);
    const top = Math.max(...breathEnv.subarray(Math.floor(t * 1000), to));
    let run = 0, best = 0, seenExp = false;
    for (let k = from; k < to; k++) {
      if (breathEnv[k]! < top * 0.15) run++;
      else {
        if (run > best && k > from + 5) { best = run; seenExp = true; }
        run = 0;
      }
    }
    return seenExp ? best : 0;
  });

  return {
    insps: g.starts, inspMs: round(inspSec * 1000), cycleMs: round(g.cycle * 1000),
    crackles: {
      perBreath: round(hits.length / Math.max(1, g.starts.length), 1), atFraction: round(median(fr), 2),
      inInsp: round(fr.filter((f) => f >= 0 && f <= 1).length / Math.max(1, fr.length), 2),
      peakHz: hits.length ? round(crackleSp.peakHz) : NaN, centroid: hits.length ? round(crackleSp.centroid) : NaN, widthMs: round(median(widths)),
    },
    inspFracAbove500: round(inspSp.fraction(500, 5000), 2),
    inspRms: round(stretchRms(windows.map((w) => w.insp)), 3), expRms: round(stretchRms(windows.map((w) => w.exp)), 3),
    expPeaks: expSp.peaks(200, 1400), inspPeaks: inspSp.peaks(200, 1400), expFrac400_800: round(expSp.fraction(400, 800), 2), expCentroid: round(expSp.centroid),
    pauseMs: round(median(pauses)),
    rms: round(lv.rms, 3), peak: round(lv.peak, 3), satOfLoud: round(lv.satOfLoud, 3), wholeCentroid: round(spectrum(y, windows.map((w) => w.insp)).centroid),
  };
}

/* ---------------------------- abdomen and vessels ------------------------- */

export interface BowelReading { eventsPerMin: number; gapS: number; centroid: number; rms: number; peak: number; satOfLoud: number; activeFrac: number }

export function readBowel(s: Extract<SoundParams, { kind: "bowel" }>, seed = defaultSeed): BowelReading {
  const y = played(s, seed);
  const lv = level(y);
  const env = envelope(band(y, 80, 3000), 20);
  const floor = 0.04;
  const onsets: number[] = [];
  let was = false, active = 0;
  for (let k = 0; k < env.length; k++) {
    const on = env[k]! > floor;
    if (on) active++;
    // A new event: sound after at least 300 ms of quiet.
    if (on && !was && (!onsets.length || k / 1000 - lastOn(env, k, floor) > 0.3)) onsets.push(k / 1000);
    was = on;
  }
  const quietSpectrum = spectrum(y, onsets.length ? onsets.map((t) => [t, t + 0.3] as [number, number]) : [[1, 11]]);
  const gaps = onsets.slice(1).map((t, i) => t - onsets[i]!);
  return { eventsPerMin: round((onsets.length * 60) / (y.length / R), 1), gapS: round(median(gaps), 1), centroid: round(quietSpectrum.centroid), rms: round(lv.rms, 4), peak: round(lv.peak, 3), satOfLoud: round(lv.satOfLoud, 3), activeFrac: round(active / env.length, 3) };
}
function lastOn(env: Float32Array, k: number, floor: number) {
  let i = k - 1;
  while (i > 0 && env[i]! <= floor) i--;
  return i / 1000;
}

export interface VesselReading { centroid: number; frac: number; shape: number[]; sysLevel: number; diaLevel: number; rms: number; peak: number; satOfLoud: number; beatMs: number }

export function readVessel(s: Extract<SoundParams, { kind: "vessel" }>, seed = defaultSeed): VesselReading {
  const y = played(s, seed);
  const lv = level(y);
  const beat = (60 / s.rate) * 1000;
  // Pulse from a clean recording at the same rate and seed.
  const ref = envelope(band(played({ kind: "vessel", sound: "normal", rate: s.rate }, seed), 20, 150), 8);
  const peaks = localPeaks(ref, 0, ref.length, 0.4, beat * 0.6);
  const win = peaks.slice(0, -1).map((p, i): [number, number] => [p / 1000, peaks[i + 1]! / 1000]);
  const env = envelope(band(y, 90, 900), 15);
  const sh = shape(env, win);
  const raw = shapeRaw(env, win);
  const sp = spectrum(y, win.map(([a, b]) => [a + 0.03, b - 0.03]));
  const sysSlices = raw.slice(1, Math.round(20 * 0.38));
  const diaSlices = raw.slice(Math.round(20 * 0.5), 19);
  return { centroid: round(sp.centroid), frac: round(sp.fraction(90, 900), 2), shape: sh.map((v) => round(v, 2)), sysLevel: round(mean(sysSlices), 3), diaLevel: round(mean(diaSlices), 3), rms: round(lv.rms, 3), peak: round(lv.peak, 3), satOfLoud: round(lv.satOfLoud, 3), beatMs: round(median(peaks.slice(1).map((p, i) => p - peaks[i]!))) };
}

/* --------------------------- specific questions -------------------------- */

/** Loudness in a band through systole or diastole, 20 slices, top = 1. */
export function phaseShape(s: Extract<SoundParams, { kind: "heart" }>, phase: "systole" | "diastole", lo: number, hi: number, seed = defaultSeed) {
  const y = played(s, seed);
  const g = heartGrid(s.rate, s.irregular, seed);
  const env = envelope(band(y, lo, hi), 10);
  const n = g.s2.length - 1;
  const win = g.s2.slice(0, n).map((t, i): [number, number] => (phase === "systole" ? [g.s1[i]!, t] : [t, g.s1[i + 1] ?? t + 0.4]));
  return shape(env, win);
}

/** Mitral stenosis's rumble: the band's level in mid-diastole, the lull after it, and the last stretch before S1. */
export function readRumble(s: Extract<SoundParams, { kind: "heart" }>, seed = defaultSeed) {
  const y = played(s, seed);
  const g = heartGrid(s.rate, s.irregular, seed);
  const env = envelope(band(y, 60, 180), 10);
  const n = g.s2.length - 1;
  const raw = shapeRaw(env, g.s2.slice(0, n).map((t, i): [number, number] => [t, g.s1[i + 1] ?? t + 0.4]));
  const dia = median(g.s2.slice(0, n).map((t, i) => (g.s1[i + 1] ?? t + 0.4) - t));
  const part = (a: number, b: number) => mean(raw.slice(Math.round(a * 20), Math.round(b * 20)));
  const sp = spectrum(y, g.s2.slice(0, n).map((t) => [t + 0.135, t + dia - 0.01] as [number, number]));
  return { mid: round(part(0.3, 0.6), 3), late: round(part(0.82, 1), 3), lull: round(part(0.68, 0.76), 3), frac: round(sp.fraction(50, 200), 2), centroid: round(sp.centroid), s1: round(Math.max(...g.s1.slice(0, n).map((t) => Math.max(...envelope(band(y, 20, 300), 5).slice(Math.floor(t * 1000), Math.floor(t * 1000) + 60)))), 3) };
}

/** A short high sound (click, snap): when it comes after the given landmark, and its pitch. */
export function readClick(s: Extract<SoundParams, { kind: "heart" }>, after: "s1" | "s2", from: number, to: number, seed = defaultSeed) {
  const y = played(s, seed);
  const g = heartGrid(s.rate, s.irregular, seed);
  const env = envelope(band(y, 180, 1200), 4);
  const n = g.s2.length - 1;
  const hits = (after === "s1" ? g.s1 : g.s2).slice(0, n).map((t) => {
    const a = Math.floor((t + from) * 1000), b = Math.floor((t + to) * 1000);
    let p = a;
    for (let k = a; k < b; k++) if (env[k]! > env[p]!) p = k;
    const st = extent(env, p, 0.25, a, b).start;
    return { t, at: st / 1000 };
  });
  const sp = spectrum(y, hits.map((h) => [h.at - 0.002, h.at + 0.03] as [number, number]));
  return { afterMs: round(median(hits.map((h) => h.at - h.t)) * 1000), fractionOfSystole: round(median(hits.map((h, i) => (h.at - h.t) / (g.s2[i]! - g.s1[i]!))), 2), peakHz: sp.peakHz, centroid: round(sp.centroid) };
}

/** Systolic murmur level by breath: Carvallo's sign, measured. In = breath at its fullest, out = at its emptiest. */
export function respiratoryRatio(s: Extract<SoundParams, { kind: "heart" }>, seed = defaultSeed) {
  const y = played(s, seed);
  const g = heartGrid(s.rate, s.irregular, seed);
  const b = band(y, 200, 600);
  const by = g.s2.map((t, i) => ({ r: Math.sin((2 * Math.PI * g.s1[i]!) / 4), v: rms(b.subarray(Math.floor((g.s1[i]! + 0.05) * R), Math.floor((t - 0.01) * R))) }));
  return round(mean(by.filter((x) => x.r > 0.5).map((x) => x.v)) / mean(by.filter((x) => x.r < -0.5).map((x) => x.v)), 2);
}

/** Loudness around the end of inspiration (±250 ms) in the creak's band. */
export function endInspiration(s: Extract<SoundParams, { kind: "lungs" }>, seed = defaultSeed) {
  const y = played(s, seed);
  const g = breathGrid(s.rate, seed);
  const b = band(y, 250, 600);
  return round(mean(g.starts.slice(0, -1).map((t) => rms(b.subarray(Math.floor((t + g.insp - 0.26) * R), Math.floor((t + g.insp + 0.27) * R))))), 3);
}

/** Vessel loudness in systole (first 38% of the beat) and diastole (last 45%), in a chosen band. */
export function vesselPhases(s: Extract<SoundParams, { kind: "vessel" }>, lo: number, hi: number, seed = defaultSeed) {
  const y = played(s, seed);
  const beat = (60 / s.rate) * 1000;
  const ref = envelope(band(played({ kind: "vessel", sound: "normal", rate: s.rate }, seed), 20, 150), 8);
  const peaks = localPeaks(ref, 0, ref.length, 0.4, beat * 0.6);
  const raw = shapeRaw(envelope(band(y, lo, hi), 15), peaks.slice(0, -1).map((p, i): [number, number] => [p / 1000, peaks[i + 1]! / 1000]));
  return { sys: mean(raw.slice(2, 8)), dia: mean(raw.slice(11, 19)) };
}

export { median, mean };
