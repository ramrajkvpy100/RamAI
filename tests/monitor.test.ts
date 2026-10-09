import { describe, expect, it } from "vitest";

import { MonitorSignal } from "@/components/case/scene/monitor-signal";

/** Runs the signal as a sweep would, frame by frame, collecting every beat and breath it schedules. */
function run(signal: MonitorSignal, seconds: number, onFrame?: (t: number) => void) {
  const beats = new Set<number>();
  const breaths = new Set<number>();
  for (let frame = 0; frame <= seconds * 60; frame++) {
    const t = frame / 60;
    onFrame?.(t);
    signal.advanceTo(t);
    for (const b of signal.beats) if (b <= t) beats.add(b);
    for (const b of signal.breaths) if (b <= t) breaths.add(b);
  }
  return { beats: [...beats].sort((a, b) => a - b), breaths: [...breaths].sort((a, b) => a - b) };
}

const intervals = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i]!);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

describe("bedside monitor signal", () => {
  it("beats at the measured rate in sinus rhythm, with a little beat-to-beat variation", () => {
    const s = new MonitorSignal(3);
    s.set(120, 18, "sinus");
    const rr = intervals(run(s, 30).beats);
    expect(mean(rr)).toBeCloseTo(0.5, 1);
    expect(Math.max(...rr) - Math.min(...rr)).toBeGreaterThan(0.005);
    expect(Math.max(...rr) - Math.min(...rr)).toBeLessThan(0.05);
  });

  it("is irregularly irregular in AF", () => {
    const s = new MonitorSignal(5);
    s.set(130, 24, "afib");
    const rr = intervals(run(s, 30).beats);
    expect(Math.max(...rr) - Math.min(...rr)).toBeGreaterThan(0.15);
  });

  it("follows a new rate from the next beat, without restarting", () => {
    const s = new MonitorSignal(7);
    s.set(60, 14, "sinus");
    let switched = false;
    const { beats } = run(s, 40, (t) => {
      if (!switched && t >= 20) {
        switched = true;
        s.set(120, 14, "sinus");
      }
    });
    expect(mean(intervals(beats.filter((b) => b < 19)))).toBeCloseTo(1, 1);
    expect(mean(intervals(beats.filter((b) => b > 23)))).toBeCloseTo(0.5, 1);
    expect(Math.max(...intervals(beats))).toBeLessThan(1.1);
  });

  it("breathes at the measured respiratory rate", () => {
    const s = new MonitorSignal(9);
    s.set(80, 20, "sinus");
    expect(mean(intervals(run(s, 60).breaths))).toBeCloseTo(3, 0);
    for (let t = 55; t < 60; t += 0.1) {
      expect(s.resp(t)).toBeGreaterThanOrEqual(0);
      expect(s.resp(t)).toBeLessThanOrEqual(1);
    }
  });

  it("draws a QRS for every beat", () => {
    const s = new MonitorSignal(13);
    s.set(75, 16, "sinus");
    s.advanceTo(0, 10);
    const beat = s.beats[2]!;
    expect(s.ecg(beat + 0.036)).toBeGreaterThan(0.8);
    expect(s.qrsBetween(beat, beat + 0.05)).toBe(1);
  });

  it("shows no complexes and no breathing without them", () => {
    const s = new MonitorSignal(11);
    s.set(0, 0, "sinus");
    expect(run(s, 10).beats).toHaveLength(0);
    let peak = 0;
    for (let t = 0; t < 10; t += 0.01) peak = Math.max(peak, Math.abs(s.ecg(t)));
    expect(peak).toBeLessThan(0.05);
    expect(s.resp(5)).toBe(0);
  });
});
