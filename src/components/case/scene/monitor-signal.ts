/**
 * The bedside monitor's signals, generated beat by beat and breath by breath:
 * lead II ECG, the SpO₂ pleth and the impedance respiration trace. Rates can
 * change at any moment — the next beat or breath picks the change up — so a
 * trace never restarts or jumps. Time is in seconds on one shared clock, so
 * every view of the monitor shows the same beats.
 */
import { makeSignal } from "@/components/media/ecg-signal";
import type { EcgSpec } from "@/engine/types";
import { prngFrom } from "@/lib/prng";

type Rhythm = EcgSpec["rhythm"];

/** Beats and breaths are scheduled this far ahead of the time asked for. */
const LOOKAHEAD = 1.2;

export class MonitorSignal {
  /** Scheduled beat times (the QRS lands 36 ms after each). */
  readonly beats: number[] = [];
  readonly breaths: number[] = [];
  private hr = 0;
  private rr = 0;
  private rhythm: Rhythm = "sinus";
  private nextBeat = Number.NaN;
  private nextBreath = Number.NaN;
  private shapedFor = -1;
  private ecgAt: (t: number) => number = () => 0;
  private readonly rand: () => number;

  constructor(private readonly seed = 1) {
    this.rand = prngFrom(seed);
    this.set(0, 0, "sinus");
  }

  /** The rates and rhythm from the next beat and breath on. A rate of 0 means none. */
  set(hr: number, rr: number, rhythm: Rhythm) {
    this.hr = Math.max(0, hr);
    this.rr = Math.max(0, rr);
    const shape = Math.max(25, hr || 60);
    if (rhythm !== this.rhythm || this.shapedFor < 0 || Math.abs(shape - this.shapedFor) > 12) {
      this.rhythm = rhythm;
      this.shapedFor = shape;
      // The same seed every time keeps baseline wander and fibrillation waves continuous.
      this.ecgAt = makeSignal({ kind: "ecg", rate: shape, rhythm }, "II", this.beats, prngFrom(this.seed));
    }
  }

  private interval(): number {
    const mean = 60 / Math.min(240, Math.max(25, this.hr));
    if (this.rhythm === "afib") return mean * (0.55 + this.rand() * 0.95);
    // Sinus rhythm varies a little from beat to beat; machine-like rhythms barely at all.
    if (this.rhythm === "sinus") return mean * (1 + (this.rand() - 0.5) * 0.06);
    return mean * (1 + (this.rand() - 0.5) * 0.01);
  }

  /** Schedules beats and breaths up to `until` (plus look-ahead) and forgets those long past `t`. */
  advanceTo(t: number, until = t) {
    const ahead = until + LOOKAHEAD;
    if (Number.isNaN(this.nextBeat) || this.nextBeat < t - 2) this.nextBeat = t + 0.25;
    if (Number.isNaN(this.nextBreath) || this.nextBreath < t - 10) this.nextBreath = t + 0.6;
    if (this.hr > 0) {
      while (this.nextBeat < ahead) {
        this.beats.push(this.nextBeat);
        this.nextBeat += this.interval();
      }
    }
    if (this.rr > 0) {
      while (this.nextBreath < ahead) {
        this.breaths.push(this.nextBreath);
        this.nextBreath += (60 / Math.min(60, Math.max(4, this.rr))) * (1 + (this.rand() - 0.5) * 0.12);
      }
    }
    while (this.beats.length > 0 && this.beats[0]! < t - 1.6) this.beats.shift();
    while (this.breaths.length > 1 && this.breaths[1]! < t - 1) this.breaths.shift();
  }

  ecg(t: number): number {
    return this.ecgAt(t);
  }

  /** Pleth: a pulse wave per beat, smaller after a short beat-to-beat interval (as in AF). */
  pleth(t: number): number {
    const mean = 60 / Math.max(25, this.hr || 60);
    let p = 0;
    for (let i = 0; i < this.beats.length; i++) {
      const x = t - this.beats[i]!;
      if (x < 0.04 || x > 1.2) continue;
      const filled = i > 0 ? Math.min(1.15, Math.max(0.45, (this.beats[i]! - this.beats[i - 1]!) / mean)) : 1;
      p += filled * (Math.exp(-((x - 0.3) ** 2) / (2 * 0.08 ** 2)) + 0.3 * Math.exp(-((x - 0.58) ** 2) / (2 * 0.09 ** 2)));
    }
    return p;
  }

  /** Respiration, 0–1: a smooth rise through inspiration (40% of the breath), a longer fall. */
  resp(t: number): number {
    if (this.rr <= 0) return 0;
    for (let i = this.breaths.length - 1; i >= 0; i--) {
      const start = this.breaths[i]!;
      if (start > t) continue;
      const x = (t - start) / Math.max(0.5, (this.breaths[i + 1] ?? this.nextBreath) - start);
      if (x >= 1) return 0;
      return x < 0.4 ? 0.5 - 0.5 * Math.cos((Math.PI * x) / 0.4) : 0.5 + 0.5 * Math.cos((Math.PI * (x - 0.4)) / 0.6);
    }
    return 0;
  }

  /** A separate signal at the same rates, scheduled over [0, seconds] — a still screenful of trace. */
  preview(seconds: number): MonitorSignal {
    const copy = new MonitorSignal(this.seed + 1);
    copy.set(this.hr, this.rr, this.rhythm);
    copy.advanceTo(0, seconds);
    return copy;
  }

  /** QRS complexes in (a, b] — one beep each. */
  qrsBetween(a: number, b: number): number {
    let n = 0;
    for (const beat of this.beats) if (beat + 0.036 > a && beat + 0.036 <= b) n++;
    return n;
  }
}
