import { describe, expect, it } from "vitest";

import { ABDOMEN, ABDOMEN_CASES, HEART, HEART_CASES, LUNG_CASES, LUNGS } from "@/lib/banks/sounds";

import baseline from "./fixtures/skills-baseline.json";
import { level, played, useSeed } from "./sound-measure";
import { audit } from "./sound-targets";

/**
 * Holds the synthesis to its measured targets (see sounds-audit.md). This measures audio numerically: it does not show
 * that a sound is convincing to a listener, and these sounds are synthetic, not recordings.
 */
const ALL = [...HEART, ...LUNGS, ...ABDOMEN];

describe("every Hear it sound measures on target", () => {
  for (const seed of [7, 101]) {
    it.each(ALL.map((s) => [s.id, s] as const))(`%s (recording ${seed})`, (_id, item) => {
      useSeed(seed);
      const missed = audit(item).checks.filter((c) => !c.ok).map((c) => `${c.got}, wanted ${c.name}`);
      useSeed(7);
      expect(missed).toEqual([]);
    }, 30_000);
  }
});

describe("the bank", () => {
  it("has a target for every sound and keeps every old id", () => {
    for (const s of ALL) expect(audit(s).intended, s.id).not.toBe("");
    const ids = new Set(ALL.map((s) => s.id));
    for (const id of baseline.sounds) expect(ids.has(id), id).toBe(true);
    for (const id of ["split-physiologic", "split-wide", "split-paradoxical"]) expect(ids.has(id), id).toBe(true);
  }, 60_000);

  it("nothing clips after loud(), at any rate the drill plays", () => {
    for (const c of [...HEART_CASES, ...LUNG_CASES, ...ABDOMEN_CASES]) {
      const lv = level(played(c.sound, 3));
      expect(lv.peak, c.id).toBeLessThanOrEqual(0.98);
      expect(lv.satOfLoud, c.id).toBeLessThan(0.02);
    }
  }, 120_000);
});
