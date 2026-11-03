import { describe, expect, it } from "vitest";

import { renderAuscultation, SAMPLE_RATE } from "@/engine/stethoscope-audio";
import type { Auscultation } from "@/engine/types";
import { HEART } from "@/lib/banks/sounds";

const sound = (id: string) => HEART.find((h) => h.id === id)!.sound as Extract<Auscultation, { kind: "heart" }>;

/** Loudness through one beat, in 20 slices, averaged over the beats in the recording. */
function beatShape(s: Auscultation): number[] {
  const x = renderAuscultation([s], 7);
  const beat = Math.round((60 / (s as { rate: number }).rate) * SAMPLE_RATE);
  const out = new Array<number>(20).fill(0);
  for (let i = 0; i < x.length; i++) out[Math.floor(((i % beat) / beat) * 20)]! += Math.abs(x[i]!);
  const top = Math.max(...out);
  return out.map((v) => v / top);
}
const difference = (a: number[], b: number[]) => a.reduce((n, v, i) => n + Math.abs(v - b[i]!), 0) / a.length;

describe("the heart sounds easily confused", () => {
  it("fixed split S2 and mitral valve prolapse differ in their parameters and their timing", () => {
    const split = sound("split-s2"), mvp = sound("mvp");
    expect(split.splitS2).toBe("fixed");
    expect(mvp.splitS2).toBeUndefined();
    expect(mvp.click).toBe(true);
    expect(split.click).toBeFalsy();
    expect(split.murmur?.shape).toBe("flow");
    expect(mvp.murmur?.shape).toBe("late");
    expect(difference(beatShape(split), beatShape(mvp))).toBeGreaterThan(0.02);
  });

  it("pulmonary stenosis and tricuspid regurgitation differ in their parameters and their timing", () => {
    const ps = sound("ps"), tr = sound("tr");
    expect(ps.ejectionClick).toBe(true);
    expect(tr.ejectionClick).toBeFalsy();
    expect(ps.splitS2).toBe("wide");
    expect(ps.murmur?.shape).toBe("diamond");
    expect(tr.murmur?.shape).toBe("respiratory");
    expect(difference(beatShape(ps), beatShape(tr))).toBeGreaterThan(0.02);
  });

  it("only tricuspid regurgitation swells with breathing, and fixed split doesn't vary", () => {
    // Loudness beat by beat, away from the fade at either end.
    const envelope = (s: Auscultation) => {
      const x = renderAuscultation([s], 7);
      const beat = Math.round((60 / (s as Extract<Auscultation, { kind: "heart" }>).rate) * SAMPLE_RATE);
      const out: number[] = [];
      for (let i = 2 * SAMPLE_RATE; i + beat <= x.length - 2 * SAMPLE_RATE; i += beat) { let n = 0; for (let k = i; k < i + beat; k++) n += Math.abs(x[k] ?? 0); out.push(n); }
      return out;
    };
    const spread = (v: number[]) => (Math.max(...v) - Math.min(...v)) / Math.max(...v);
    expect(spread(envelope(sound("tr")))).toBeGreaterThan(spread(envelope(sound("ps"))));
  });
});
