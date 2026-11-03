import { describe, expect, it } from "vitest";

import { careerIndices, cvBullet } from "@/engine/career";

const row = (verdict: string, opts: { failed?: number; track?: string; safety?: [number, number]; tests?: [number, number]; lost?: [string, string][] } = {}) => ({
  verdict, failed: opts.failed ?? 0, track: opts.track ?? "emergency",
  detail: JSON.stringify({ l: [["drugSafety", ...(opts.safety ?? [10, 10])], ["investigationSelection", ...(opts.tests ?? [8, 10])]], lost: opts.lost ?? [] }),
});

describe("career indices", () => {
  it("stays blank below three cases", () => {
    expect(careerIndices([row("correct"), row("correct")]).diagnosticPrecision).toBeNull();
  });

  it("counts a partly right diagnosis as half", () => {
    expect(careerIndices([row("correct"), row("partial"), row("incorrect"), row("correct")]).diagnosticPrecision).toBe(63);
  });

  it("a harmful order or a death breaks zero harm", () => {
    expect(careerIndices([row("correct"), row("correct", { safety: [4, 10] }), row("correct", { failed: 1 }), row("correct")]).zeroHarm).toBe(50);
  });

  it("speed counts only emergencies, and a late or missed treatment fails it", () => {
    const i = careerIndices([row("correct"), row("correct", { lost: [["treatment", "IV diuretic came after the first 30 minutes."]] }), row("correct"), row("correct", { track: "opd" })]);
    expect(i.stabilisationSpeed).toBe(67);
  });

  it("stewardship is the mean of test choice", () => {
    expect(careerIndices([row("correct"), row("correct", { tests: [10, 10] }), row("correct", { tests: [6, 10] })]).stewardship).toBe(80);
  });

  it("the CV line says it's a simulation", () => {
    const line = cvBullet({ rating: 1480, rank: "Senior Resident", top: 5, cases: 40, indices: careerIndices([row("correct"), row("correct"), row("correct")]) });
    expect(line).toMatch(/1480/);
    expect(line).toMatch(/simulated/);
    expect(line).toMatch(/self-assessment/);
  });
});
