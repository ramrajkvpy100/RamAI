import { RADIOLOGY_SERIES } from "@/lib/skill-counts";
import { describe, expect, it } from "vitest";

import STACKS from "@/lib/radiology-stacks.json";

import BASELINE from "./fixtures/stacks-baseline.json";

/** Series that were added before these checks: their history and options stay as they were written. */
const FIRST_BATCH = new Set(BASELINE);
const added = STACKS.filter((s) => !FIRST_BATCH.has(s.id));

describe("radiology scroll series", () => {
  it("keeps every id progress depends on", () => {
    const ids = new Set(STACKS.map((s) => s.id));
    expect(BASELINE.filter((id) => !ids.has(id))).toEqual([]);
    expect(BASELINE.length).toBe(51);
  });

  it("never shows a series, or a patient, twice", () => {
    for (const key of ["id", "seriesUid", "patient"] as const) {
      const seen = new Set<string>();
      const twice = STACKS.map((s) => s[key]).filter((v) => seen.has(v) || !seen.add(v));
      expect(twice).toEqual([]);
    }
  });

  it("uses only clearly free licences, each credited in full", () => {
    for (const s of STACKS) {
      expect(s.license, s.id).toMatch(/^CC (BY [34]\.0|0)/);
      expect(s.license, s.id).not.toMatch(/NC|ND/);
      expect(s.doi, s.id).toMatch(/^10\.\d+\//);
      expect(s.credit, s.id).toContain(s.collection);
      expect(s.credit, s.id).toContain(s.license);
      expect(s.credit, s.id).toContain(s.doi);
    }
  });

  it("offers four different options with the answer among them", () => {
    for (const s of STACKS) {
      expect(s.options, s.id).toHaveLength(4);
      expect(new Set(s.options).size, s.id).toBe(4);
      expect(s.options, s.id).toContain(s.diagnosis);
      expect(s.history.trim().length, s.id).toBeGreaterThan(10);
      expect(s.question.trim().length, s.id).toBeGreaterThan(5);
      expect(s.key.trim().length, s.id).toBeGreaterThan(20);
      expect(["CT", "MR"], s.id).toContain(s.modality);
      expect(s.slices, s.id).toBeGreaterThanOrEqual(20);
      expect(s.slices, s.id).toBeLessThanOrEqual(72);
    }
  });

  it("gives CT its three windows and MRI none", () => {
    for (const s of STACKS) {
      const windows = "windows" in s ? (s.windows as string[]) : undefined;
      if (s.modality === "MR") expect(windows, s.id).toBeUndefined();
      else if (windows) expect([...windows].sort(), s.id).toEqual(["bone", "lung", "soft"]);
    }
  });

  it("writes the added cases with nothing left unfilled, and every diagnosis has at least three patients", () => {
    for (const s of added) {
      expect(`${s.history} ${s.question} ${s.key}`, s.id).not.toMatch(/\{|\}|undefined|null/);
      expect(s.history, s.id).toMatch(/^(\d+-year-old (man|woman|patient)|Man|Woman|Patient)\b/);
    }
    const perDiagnosis = new Map<string, number>();
    for (const s of STACKS) perDiagnosis.set(s.diagnosis, (perDiagnosis.get(s.diagnosis) ?? 0) + 1);
    expect([...perDiagnosis].filter(([, n]) => n < 3)).toEqual([]);
    expect(STACKS).toHaveLength(RADIOLOGY_SERIES);
  });
});
