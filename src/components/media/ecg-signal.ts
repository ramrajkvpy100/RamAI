/**
 * ECG signal synthesis, shared by the 12-lead tracing and the bedside monitor.
 *
 * Each lead is a sum of Gaussian P/Q/R/S/T components with lead-specific
 * amplitudes for a normal axis, plus case morphology (ST shift, T inversion,
 * Q waves, voltage, QRS width) and rhythm (sinus, AF, flutter, SVT, VT,
 * junctional). Time is in seconds, amplitude in millivolts.
 */
import type { EcgLead, EcgSpec } from "@/engine/types";

interface LeadShape {
  p: number;
  q: number;
  r: number;
  s: number;
  t: number;
}

/** Typical amplitudes (mV) for a normal frontal axis and R-wave progression. */
const BASE: Record<EcgLead, LeadShape> = {
  I: { p: 0.1, q: -0.04, r: 0.7, s: -0.1, t: 0.25 },
  II: { p: 0.15, q: -0.05, r: 1.1, s: -0.15, t: 0.33 },
  III: { p: 0.06, q: -0.06, r: 0.5, s: -0.22, t: 0.12 },
  aVR: { p: -0.1, q: -0.55, r: 0.12, s: -0.1, t: -0.25 },
  aVL: { p: 0.05, q: -0.03, r: 0.35, s: -0.25, t: 0.1 },
  aVF: { p: 0.1, q: -0.05, r: 0.8, s: -0.15, t: 0.24 },
  V1: { p: 0.06, q: 0, r: 0.25, s: -0.95, t: -0.06 },
  V2: { p: 0.07, q: 0, r: 0.45, s: -1.25, t: 0.45 },
  V3: { p: 0.08, q: 0, r: 0.85, s: -0.8, t: 0.45 },
  V4: { p: 0.08, q: -0.03, r: 1.35, s: -0.5, t: 0.4 },
  V5: { p: 0.08, q: -0.05, r: 1.4, s: -0.25, t: 0.35 },
  V6: { p: 0.07, q: -0.05, r: 1.1, s: -0.1, t: 0.3 },
};

export const LAYOUT: EcgLead[][] = [
  ["I", "aVR", "V1", "V4"],
  ["II", "aVL", "V2", "V5"],
  ["III", "aVF", "V3", "V6"],
];

const gauss = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function beatTimes(spec: EcgSpec, seconds: number, rand: () => number): number[] {
  const rate = Math.max(25, Math.min(240, spec.rate));
  const rr = 60 / rate;
  const times: number[] = [];
  let t = 0.18 + rand() * rr * 0.6;
  while (t < seconds + 0.6) {
    times.push(t);
    const jitter =
      spec.rhythm === "afib" ? rr * (0.55 + rand() * 0.95) : spec.rhythm === "sinus" ? rr * (1 + (rand() - 0.5) * 0.04) : rr;
    t += jitter;
  }
  return times;
}

export function makeSignal(spec: EcgSpec, lead: EcgLead, beats: number[], rand: () => number) {
  const m = spec.morphology ?? {};
  const base = BASE[lead];
  const scale = m.qrsScale?.[lead] ?? 1;
  const wide = spec.rhythm === "vt" ? 3.2 : (m.qrs ?? 90) / 90;
  const showP = m.pWaves !== false && !["afib", "aflutter", "vt", "junctional", "svt"].includes(spec.rhythm);
  const pr = (m.pr ?? 160) / 1000;
  const rr = 60 / Math.max(25, spec.rate);
  const tPos = (m.qt ? m.qt / 1000 : 0.4 * Math.sqrt(rr)) - 0.12;
  const tAmp = base.t * (m.t?.[lead] ?? 1) * (m.peakedT ? 2.3 : 1) * (spec.rhythm === "vt" ? -2.2 : 1);
  const tSigma = m.peakedT ? 0.028 : 0.045;
  const st = (m.st?.[lead] ?? 0) / 10;
  const qDepth = m.q?.[lead];
  const q = qDepth !== undefined ? -qDepth / 10 : base.q;
  const r = base.r * scale * (spec.rhythm === "vt" ? 1.4 : 1);
  const s = base.s * scale * (spec.rhythm === "vt" ? 1.4 : 1);
  const fPhase = rand() * Math.PI * 2;
  const wander = rand() * Math.PI * 2;

  return (time: number) => {
    let v = 0.025 * Math.sin(time * 0.9 + wander); // baseline wander
    for (const b of beats) {
      const x = time - b;
      if (x < -0.35 || x > 0.7) continue;
      if (showP) v += base.p * gauss(x, -pr + 0.05, 0.024);
      v += q * gauss(x, 0.012 * wide, (qDepth !== undefined ? 0.014 : 0.007) * wide);
      v += r * gauss(x, 0.036 * wide, 0.0095 * wide);
      v += s * gauss(x, 0.062 * wide, 0.0105 * wide);
      if (st) v += st * (sigmoid((x - 0.075 * wide) / 0.006) - sigmoid((x - (tPos + 0.06)) / 0.025));
      v += tAmp * gauss(x, tPos + 0.06 * (wide - 1), tSigma * Math.max(1, wide * 0.6));
    }
    if (spec.rhythm === "afib") v += 0.045 * Math.sin(2 * Math.PI * 6.3 * time + fPhase) * (0.6 + 0.4 * Math.sin(time * 1.7));
    if (spec.rhythm === "aflutter") v += 0.12 * (((time * 5 + fPhase) % 1) - 0.5) * (lead === "II" || lead === "III" || lead === "aVF" ? -1.6 : 0.5);
    return v;
  };
}
