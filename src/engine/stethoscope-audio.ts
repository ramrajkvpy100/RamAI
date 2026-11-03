/**
 * The stethoscope, played from the server: heart, breath and bowel sounds
 * synthesised from a patient's acoustic parameters into a WAV file. The
 * browser receives the sound — never what it represents — so the only way to
 * know what's there is to listen.
 */
import { prngFrom } from "@/lib/prng";

import type { Auscultation, BowelSounds, BreathSounds, HeartSounds, VesselSounds } from "./types";

/**
 * What the engine can voice. Cases say only what auscultation.ts reads from an examination (Auscultation); the Skills Lab
 * can also ask for the two splits that need a breath to mean anything: physiological and paradoxical.
 */
export type HeartVoice = Omit<HeartSounds, "splitS2"> & { splitS2?: HeartSounds["splitS2"] | "physiologic" | "paradoxical" };
export type SoundParams = Exclude<Auscultation, HeartSounds> | HeartVoice;

/** How long one listen lasts. */
export const LISTEN_SECONDS = 12;
/** Plenty for body sounds (all below ~2.5 kHz) and small on the wire. */
export const SAMPLE_RATE = 11025;

type Shape = "plateau" | "diamond" | "late-diamond" | "decrescendo" | "crescendo" | "breath-in" | "breath-out";

/** Envelope 0…1 at fraction x of a sound lasting dur seconds. */
function envelope(shape: Shape, x: number, dur: number): number {
  const edge = Math.min(0.03 / dur, 0.2);
  switch (shape) {
    case "plateau":
      return x < edge ? x / edge : x > 1 - edge ? (1 - x) / edge : 1;
    case "diamond":
      return x < 0.5 ? x / 0.5 : (1 - x) / 0.5;
    case "late-diamond":
      return x < 0.68 ? x / 0.68 : (1 - x) / 0.32;
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
    /** The rhythm's own random stream: the same seed and rate keep the same beats, whatever sounds are added over them. */
    readonly rhythm: () => number,
  ) {
    this.data = new Float32Array(Math.ceil(rate * seconds));
  }

  between = (a: number, b: number) => a + this.rand() * (b - a);
  jitter = (a: number, b: number) => a + this.rhythm() * (b - a);

  /**
   * Filtered noise under an envelope: murmurs, breath, gurgles. `steep` passes it through the filter twice, for a band
   * with cleaner edges. `grain` roughens it, a new loudness every so many seconds: harsh murmurs, rubs, machinery.
   */
  hiss(at: number, dur: number, o: { type: "bandpass" | "lowpass"; freq: number; q: number; peak: number; shape: Shape; steep?: boolean; grain?: number }) {
    if (dur <= 0.002 || o.peak <= 0) return;
    const start = Math.floor(at * this.rate);
    const n = Math.floor(dur * this.rate);
    const f = filter(o.type, o.freq, o.q, this.rate);
    const f2 = o.steep ? filter(o.type, o.freq, o.q, this.rate) : null;
    const hold = o.grain ? Math.max(1, Math.round(o.grain * this.rate)) : 0;
    let rough = 1;
    for (let i = 0; i < n; i++) {
      const k = start + i;
      if (hold && i % hold === 0) rough = this.between(0.3, 1);
      const v = f(this.rand() * 2 - 1);
      const w = f2 ? f2(v) : v;
      if (k < 0 || k >= this.data.length) continue;
      this.data[k]! += w * o.peak * rough * envelope(o.shape, i / n, dur);
    }
  }

  /** One crackle: a sharp start ringing away at its own pitch in a few milliseconds. */
  pop(at: number, freq: number, dur: number, gain: number) {
    const start = Math.floor(at * this.rate);
    const n = Math.floor(dur * this.rate);
    const tau = dur / 3;
    for (let i = 0; i < n; i++) {
      const k = start + i;
      if (k < 0 || k >= this.data.length) continue;
      const t = i / this.rate;
      this.data[k]! += gain * Math.exp(-t / tau) * Math.sin(2 * Math.PI * freq * t);
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
    this.hiss(at, Math.min(dur * 0.7, 0.05), { type: "bandpass", freq: freq * 3, q: 1.4, peak: gain * 0.25, shape: "decrescendo" });
  }

  /** A tone with a little vibrato — wheeze and stridor are musical. */
  tone(at: number, dur: number, freq: number, gain: number, wave: "sine" | "saw" | "rich" = "sine", glide: [number, number] = [0.9, 1.05]) {
    const start = Math.floor(at * this.rate);
    const n = Math.floor(dur * this.rate);
    const vibrato = this.between(5, 8);
    const end = this.between(glide[0], glide[1]);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const k = start + i;
      if (k < 0 || k >= this.data.length) continue;
      const x = i / n;
      const t = i / this.rate;
      const f = freq * (1 + (end - 1) * x) * (1 + 0.012 * Math.sin(2 * Math.PI * vibrato * t));
      phase += (2 * Math.PI * f) / this.rate;
      const env = x < 0.2 ? x / 0.2 : x > 0.75 ? (1 - x) / 0.25 : 1;
      const v = wave === "sine" ? Math.sin(phase) : wave === "rich" ? Math.sin(phase) + 0.18 * Math.sin(2 * phase) : ((phase / (2 * Math.PI)) % 1) * 2 - 1;
      this.data[k]! += gain * env * v;
    }
  }
}

/** Breathing during a heart recording: a 4-second breath, in for the first half. 1 = in, 0 = out, with a short turn between. */
const breathIn = (t: number) => {
  const x = Math.max(0, Math.min(1, (Math.sin((2 * Math.PI * t) / 4) + 0.6) / 1.2));
  return x * x * (3 - 2 * x);
};

/** Milliseconds apart at this moment of the breath. Physiological: <15 out, 40–60 in. Paradoxical: the reverse. Wide: always apart, wider in. Fixed: the same. */
function splitGap(kind: NonNullable<HeartVoice["splitS2"]>, t: number) {
  const inn = breathIn(t);
  if (kind === "fixed") return 0.05;
  if (kind === "physiologic") return 0.01 + 0.04 * inn;
  if (kind === "paradoxical") return 0.05 - 0.043 * inn;
  return 0.035 + 0.04 * inn;
}

function heart(m: Mix, s: HeartVoice, from: number, until: number) {
  const base = 60 / s.rate;
  const loud = s.soft ? 0.22 : 1;
  const rumble = s.murmur?.phase === "diastolic" && s.murmur.shape === "rumble";
  // Where the breath decides what's heard, the breath is heard too: S2's split and Carvallo's sign mean nothing without it.
  if (s.splitS2 || s.murmur?.shape === "respiratory") {
    for (let at = from - (from % 4); at < until; at += 4) {
      m.hiss(at, 2, { type: "bandpass", freq: 1500, q: 0.8, peak: 0.07, shape: "breath-in" });
      m.hiss(at + 2, 1.4, { type: "bandpass", freq: 1300, q: 0.8, peak: 0.035, shape: "breath-out" });
    }
  }
  let t = from + 0.25;
  while (t < until - 0.4) {
    const cycle = s.irregular ? base * m.jitter(0.65, 1.35) : base * m.jitter(0.985, 1.015);
    // 300 ms at 75 a minute; systole shortens less than diastole as the rate climbs.
    const systole = Math.min(0.36, Math.max(0.2, 0.39 - 0.0012 * s.rate)) * Math.min(1, cycle / base + 0.1);
    const s2 = t + systole;
    // In atrial fibrillation the filling time, so S1's loudness, changes beat to beat. A tight mitral valve slams: a loud S1.
    const s1Gain = loud * (s.irregular ? m.between(0.5, 1.05) : 1) * (rumble ? 1.2 : 1);
    if (s.s4) m.thud(t - 0.09, 48, 0.08, 0.34 * loud);
    m.thud(t, 62, 0.22, 0.72 * s1Gain);
    m.thud(t + 0.022, 56, 0.17, 0.32 * s1Gain);
    if (s.mechanical) {
      // Metal on metal: a crisp high click as the valve shuts at S2, a softer one as it opens in early systole.
      m.tone(t + 0.055, 0.012, 1200, 0.28);
      m.tone(s2, 0.016, 1500, 0.55);
      m.tone(s2 + 0.002, 0.012, 2300, 0.3);
      m.thud(s2, 84, 0.05, 0.25);
    } else if (s.splitS2) {
      const gap = splitGap(s.splitS2, t);
      // Paradoxical: A2 is the late one, so the softer P2 now comes first.
      const [first, second] = s.splitS2 === "paradoxical" ? [[76, 0.54], [84, 0.62]] as const : [[84, 0.62], [76, 0.46]] as const;
      m.thud(s2, first[0], 0.16, first[1] * loud);
      m.thud(s2 + gap, second[0], 0.14, second[1] * loud);
    } else {
      m.thud(s2, 84, 0.19, 0.66 * loud);
    }
    if (s.ejectionClick) m.thud(t + 0.07, 280, 0.035, 0.5 * loud);
    if (s.s3) m.thud(s2 + 0.14, 50, 0.1, 0.42 * loud);
    if (s.click) m.thud(t + systole * 0.55, 260, 0.035, 0.5 * loud);
    if (s.snap) m.thud(s2 + 0.08, 270, 0.035, 0.46 * loud);
    if (s.murmur?.phase === "systolic") {
      const sh = s.murmur.shape;
      const whole = systole - 0.018; // S1 to S2, with nothing silent: the mark of a pansystolic murmur.
      if (sh === "late") m.hiss(t + systole * 0.58, systole * 0.4, { type: "bandpass", freq: 400, q: 1.1, steep: true, peak: 1.25, shape: "crescendo" });
      else if (sh === "harsh") m.hiss(t + 0.015, whole, { type: "bandpass", freq: 400, q: 0.9, steep: true, grain: 0.009, peak: 2.1, shape: "plateau" });
      else if (sh === "late-peak") m.hiss(t + 0.08, systole - 0.1, { type: "bandpass", freq: 270, q: 1, steep: true, grain: 0.012, peak: 1.5, shape: "late-diamond" });
      else if (sh === "respiratory") {
        // Pansystolic, but swelling with each breath in (Carvallo's sign): a slow rise and fall over a 4-second breath.
        m.hiss(t + 0.015, whole, { type: "bandpass", freq: 290, q: 1.3, steep: true, peak: 0.45 + 1.1 * breathIn(t), shape: "plateau" });
      } else if (sh === "musical") {
        m.tone(t + 0.05, systole * 0.6, 118, 0.17);
        m.tone(t + 0.05, systole * 0.6, 236, 0.05);
      } else if (sh === "flow") m.hiss(t + 0.07, systole * 0.55, { type: "bandpass", freq: 260, q: 1.1, steep: true, peak: 0.6, shape: "diamond" });
      else if (sh === "diamond") m.hiss(t + 0.055, systole - 0.08, { type: "bandpass", freq: 320, q: 0.9, steep: true, grain: 0.012, peak: 1.5, shape: "diamond" });
      else m.hiss(t + 0.015, whole, { type: "bandpass", freq: 370, q: 1.4, steep: true, peak: 1.2, shape: "plateau" });
    }
    if (s.murmur?.phase === "continuous") {
      // Machinery: rising through systole to a peak at S2, fading through diastole, with no gap and a rough, churning grain.
      m.hiss(t + 0.03, systole, { type: "bandpass", freq: 300, q: 0.8, steep: true, grain: 0.022, peak: 1.3, shape: "crescendo" });
      m.hiss(s2, cycle - systole - 0.02, { type: "bandpass", freq: 300, q: 0.8, steep: true, grain: 0.022, peak: 1.3, shape: "decrescendo" });
    }
    if (s.murmur?.phase === "diastolic") {
      const diastole = cycle - systole;
      if (rumble) {
        // Starts after the valve has opened, low and rough; then, in sinus rhythm only, atrial contraction drives a crescendo into S1.
        m.hiss(s2 + 0.13, diastole * 0.42, { type: "bandpass", freq: 110, q: 0.9, steep: true, grain: 0.03, peak: 2.4, shape: "plateau" });
        if (!s.irregular) m.hiss(t + cycle - 0.13, 0.13, { type: "bandpass", freq: 120, q: 0.9, steep: true, grain: 0.02, peak: 6.5, shape: "crescendo" });
      } else {
        m.hiss(s2 + 0.012, Math.min(0.42, diastole * 0.7), { type: "bandpass", freq: 440, q: 1.2, steep: true, peak: 0.55, shape: "decrescendo" });
      }
    }
    if (s.rub) {
      // Three parts, each a scratch that doesn't line up with S1 or S2: ventricular systole, early diastolic filling and (in sinus rhythm) atrial systole.
      const scratch = (at: number, dur: number, peak: number) => m.hiss(at, dur, { type: "bandpass", freq: 800, q: 0.9, grain: 0.008, peak, shape: "diamond" });
      scratch(t + 0.09, Math.min(0.12, systole * 0.45), 0.9 * loud);
      scratch(s2 + 0.1, 0.1, 0.75 * loud);
      if (!s.irregular) scratch(t + cycle - 0.11, 0.09, 0.7 * loud);
    }
    t += cycle;
  }
}

function lungs(m: Mix, s: BreathSounds, from: number, until: number) {
  const cycle = 60 / s.rate;
  // Obstruction lengthens expiration.
  const insp = cycle * (s.wheezeKind === "polyphonic" ? 0.3 : 0.4);
  const exp = cycle - insp;
  const level = { vesicular: 0.26, bronchial: 0.36, reduced: 0.08, absent: 0.012 }[s.breath] * (s.wheezeKind === "faint" ? 0.45 : 1);
  let t = from + 0.15;
  while (t + insp + 0.3 < until) {
    const bronchial = s.breath === "bronchial";
    // Bronchial: full inspiration, stopped short, a clear pause, then an expiration as long and as loud.
    // Vesicular: inspiration melts straight into a soft, short expiration, with no gap.
    m.hiss(t, insp, { type: "bandpass", freq: bronchial ? 750 : 380, q: 0.55, peak: level, shape: bronchial ? "plateau" : "breath-in" });
    if (bronchial) m.hiss(t + insp + 0.18, exp * 0.72, { type: "bandpass", freq: 820, q: 0.6, peak: level * 1.1, shape: "plateau" });
    else m.hiss(t + insp - 0.16, exp * 0.35 + 0.16, { type: "bandpass", freq: 320, q: 0.55, peak: level * 0.45, shape: "breath-out" });
    if (s.crackles === "fine") {
      // Many short, high pops crowding the end of inspiration.
      for (let i = 0, n = Math.round(m.between(9, 14)); i < n; i++) m.pop(t + insp * (0.98 - 0.36 * m.between(0, 1) ** 1.6), m.between(590, 710), 0.008, 0.2);
    }
    if (s.crackles === "coarse") {
      for (let i = 0, n = Math.round(m.between(4, 7)); i < n; i++) {
        // Early in inspiration, a few again in expiration.
        const at = i % 4 === 3 ? t + insp + (s.breath === "bronchial" ? 0.18 : 0) + exp * m.between(0, 0.25) : t + insp * m.between(0.03, 0.4);
        m.pop(at, m.between(220, 285), 0.028, 0.3);
      }
    }
    if (s.wheeze && s.wheezeKind === "polyphonic") {
      // Many pitches at once, starting at different moments, all through a long expiration.
      for (const [lo, hi] of [[405, 435], [470, 510], [550, 600], [640, 690], [730, 780]] as const) {
        const lag = m.between(0.02, 0.2);
        m.tone(t + insp + exp * lag, exp * m.between(0.65, 0.92 - lag), m.between(lo, hi), 0.05, "rich", [0.98, 1.02]);
      }
    } else if (s.wheeze && s.wheezeKind === "monophonic") {
      // One fixed pitch, both ways, the same breath after breath: a single narrowed airway.
      const f = 440 + (s.rate % 7) * 6;
      m.tone(t + 0.06, insp * 0.85, f, 0.085, "sine", [1, 1]);
      m.tone(t + insp + 0.02, exp * 0.85, f, 0.11, "sine", [1, 1]);
    } else if (s.wheeze && s.wheezeKind === "faint") {
      m.tone(t + insp + exp * 0.15, exp * 0.22, m.between(820, 980), 0.01);
    } else if (s.wheeze) {
      const f = m.between(420, 560);
      m.tone(t + insp + 0.04, exp * 0.85, f, 0.07);
      m.tone(t + insp + 0.08, exp * 0.7, f * m.between(1.25, 1.45), 0.045);
    }
    if (s.stridor) m.tone(t + 0.04, insp * 0.9, m.between(850, 1000), 0.1, "saw");
    if (s.stridorBiphasic) m.tone(t + insp + 0.04, exp * 0.55, m.between(680, 800), 0.085, "saw");
    if (s.rhonchi) {
      m.tone(t + insp * 0.5, insp * 0.45, m.between(115, 150), 0.09, "saw");
      m.tone(t + insp + 0.03, exp * 0.75, m.between(120, 175), 0.13, "saw");
    }
    if (s.rub) {
      // The inflamed layers catch going in, then again coming back: a creak at the end of inspiration and its mirror at the start of expiration.
      const creak = (at: number) => m.hiss(at, 0.22, { type: "bandpass", freq: 380, q: 2, grain: 0.014, peak: 0.95, shape: "diamond" });
      creak(t + insp - 0.26);
      creak(t + insp + 0.05);
    }
    t += cycle * m.jitter(0.95, 1.05);
  }
}

function bowel(m: Mix, s: BowelSounds, from: number, until: number) {
  const perMinute = { normal: 14, sluggish: 3, absent: 0, hyperactive: 45, tinkling: 30, splash: 9 }[s.activity];
  m.hiss(from, until - from, { type: "lowpass", freq: 200, q: 0.5, peak: 0.015, shape: "plateau" });
  let t = from + m.between(0.4, s.activity === "sluggish" ? 4 : 1.8);
  while (perMinute && t < until - 0.5) {
    const tinkling = s.activity === "tinkling";
    // A succussion splash: fluid slopping to and fro, low and slow, each slop weaker than the last.
    if (s.activity === "splash") {
      for (let i = 0; i < 3; i++) m.hiss(t + i * 0.32, m.between(0.2, 0.3), { type: "bandpass", freq: m.between(120, 240), q: 1.6, peak: 0.95 - i * 0.25, shape: "breath-out" });
      t += (60 / perMinute) * m.between(0.7, 1.2);
      continue;
    }
    for (let i = 0, n = Math.round(m.between(3, tinkling ? 5 : 9)); i < n; i++) {
      const at = t + i * m.between(0.04, 0.09);
      if (tinkling) m.tone(at, m.between(0.03, 0.06), m.between(1400, 2400), 0.05);
      else m.hiss(at, m.between(0.03, 0.09), { type: "bandpass", freq: m.between(160, 520), q: m.between(4, 9), peak: s.activity === "hyperactive" ? 0.8 : s.activity === "sluggish" ? 0.2 : 0.5, shape: "diamond" });
    }
    t += (60 / perMinute) * m.between(0.4, 1.4);
  }
  if (s.rub) {
    // Two creaks to each 4-second breath, as the liver slides under the diaphragm.
    for (let at = from + 0.6; at < until - 1; at += 4 * m.between(0.92, 1.08)) {
      m.hiss(at, 0.42, { type: "bandpass", freq: 480, q: 4.5, peak: 0.34, shape: "diamond" });
      m.hiss(at + 1.5, 0.38, { type: "bandpass", freq: 440, q: 4.5, peak: 0.28, shape: "diamond" });
    }
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
  for (let at = from + 0.25; at < until - 0.3; at += beat * m.jitter(0.98, 1.02)) {
    m.thud(at, 45, 0.06, 0.12);
    if (s.sound === "systolic-bruit") m.hiss(at + 0.04, Math.min(0.3, beat * 0.38), { type: "bandpass", freq, q: 1, steep: true, peak: 0.9, shape: "diamond" });
    if (s.sound === "continuous-bruit") {
      // High and tight (a renal artery): systolic, with only a short tail into diastole. Low and wide open (a fistula): a roar right through the beat.
      const tail = s.pitch === "low" ? [0.56, 0.8] : [0.26, 0.42];
      m.hiss(at + 0.02, beat * 0.4, { type: "bandpass", freq, q: 0.8, steep: true, peak: 1, shape: "crescendo" });
      m.hiss(at + beat * 0.42, beat * tail[0]!, { type: "bandpass", freq, q: 0.8, steep: true, peak: tail[1]!, shape: "decrescendo" });
    }
    // Venous hum swells a little in diastole.
    if (s.sound === "venous-hum") m.hiss(at + beat * 0.38, beat * 0.55, { type: "lowpass", freq: 160, q: 0.6, peak: 0.3, shape: "diamond" });
  }
  if (s.sound === "venous-hum") m.hiss(from + 0.1, until - from - 0.2, { type: "lowpass", freq: 160, q: 0.6, peak: 0.2, shape: "plateau" });
  m.hiss(from, until - from, { type: "lowpass", freq: 200, q: 0.5, peak: 0.012, shape: "plateau" });
}

/** Breath and bowel sounds are quieter than the heart at the chest piece; bring them up so a phone speaker carries them. */
const LEVEL = { heart: 1, lungs: 3.2, bowel: 3, vessel: 2 } as const;

/** Several areas, one after another, as a stethoscope moves. Same parameters and seed, same sound. */
export function renderAuscultation(sounds: SoundParams[], seed: number, seconds = LISTEN_SECONDS, rate = SAMPLE_RATE): Float32Array {
  const out = new Float32Array(Math.ceil(rate * seconds));
  const rand = prngFrom(seed);
  const rhythm = prngFrom((seed ^ 0x5bd1e995) >>> 0);
  const each = seconds / Math.max(1, sounds.length);
  const fade = Math.floor(0.05 * rate);
  sounds.forEach((s, i) => {
    const from = i * each;
    const until = from + each;
    const m = new Mix(rate, seconds, rand, rhythm);
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
