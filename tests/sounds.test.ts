import { describe, expect, it } from "vitest";

import { renderAuscultation } from "@/engine/stethoscope-audio";
import type { Auscultation } from "@/engine/types";

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
const diff = (a: Float32Array, b: Float32Array) => Math.sqrt(a.reduce((s, v, i) => s + (v - (b[i] ?? 0)) ** 2, 0) / a.length);

describe("heart and breath sounds for the drill", () => {
  const normal = renderAuscultation([{ kind: "heart", rate: 72 }], 1);
  const cases: Auscultation[] = [
    { kind: "heart", rate: 72, murmur: { phase: "systolic", shape: "diamond" } },
    { kind: "heart", rate: 72, murmur: { phase: "diastolic", shape: "rumble" } },
    { kind: "heart", rate: 72, s3: true },
    { kind: "heart", rate: 72, rub: true },
  ];
  it("every sound is audible, and each abnormal one differs from normal", () => {
    expect(rms(normal)).toBeGreaterThan(0.001);
    for (const c of cases) {
      const s = renderAuscultation([c], 1);
      expect(rms(s)).toBeGreaterThan(0.001);
      expect(diff(s, normal)).toBeGreaterThan(0.0005);
    }
    for (const lungs of [{ kind: "lungs", rate: 16, breath: "vesicular", wheeze: true }, { kind: "lungs", rate: 16, breath: "vesicular", crackles: "fine" }, { kind: "lungs", rate: 16, breath: "absent" }] as Auscultation[]) {
      expect(renderAuscultation([lungs], 1).length).toBeGreaterThan(1000);
    }
  });
});
