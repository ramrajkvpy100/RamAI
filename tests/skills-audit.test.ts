import { describe, expect, it } from "vitest";

import baseline from "./fixtures/skills-baseline.json";

import { ABDOMEN, HEART, LUNGS } from "@/lib/banks/sounds";
import { CLINICAL_ITEMS } from "@/lib/banks/clinical";
import { MODALITIES, MODALITY_IDS } from "@/lib/practice";
import { EXTRA_ITEMS, RADIOLOGY_BRIEFS } from "@/lib/radiology";
import { allQuizQuestions, ALGORITHM_IDS, ANTIDOTE_IDS, calculationQuestions, CALC_IDS } from "@/lib/skills";

const spot = MODALITY_IDS.flatMap((m) => MODALITIES[m].items.map((i) => i.id));
const sounds = [...HEART, ...LUNGS, ...ABDOMEN].map((s) => s.id);
const radiology = [...Object.keys(RADIOLOGY_BRIEFS), ...EXTRA_ITEMS.map((e) => e.id)];
const quiz = [...ANTIDOTE_IDS(), ...ALGORITHM_IDS(), ...CALC_IDS()].map((x) => x.id);

describe("the whole Skills Lab", () => {
  it("has at least 780 distinct skills", () => {
    expect(new Set(spot).size + new Set(radiology).size + new Set(sounds).size + new Set(quiz).size).toBeGreaterThanOrEqual(780);
    expect(CLINICAL_ITEMS.length).toBeGreaterThan(0);
  });

  it("has lost none of the skills it had", () => {
    const have = new Set([...spot, ...radiology, ...sounds, ...quiz]);
    const was = [...Object.values(baseline.spot).flat(), ...baseline.radioBriefs, ...baseline.radioExtra, ...baseline.sounds, ...baseline.antidotes, ...baseline.algorithms, ...baseline.calculations];
    expect(was.filter((id) => !have.has(id))).toEqual([]);
  });

  it("gives every written question four different options, with no length give-away", () => {
    const all = allQuizQuestions().map((x) => x.question);
    let longest = 0;
    for (const q of all) {
      expect(new Set(q.options).size, q.id).toBe(q.options.length);
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(4);
      if (q.options.every((o) => q.options[q.answer]!.length >= o.length) && q.options.filter((o) => o.length === q.options[q.answer]!.length).length === 1) longest += 1;
    }
    expect(longest / all.length).toBeLessThanOrEqual(0.35);
  });

  it("gives every calculator four different options", () => {
    for (let n = 0; n < 40; n++) for (const q of calculationQuestions("full")) {
      expect(new Set(q.options).size, q.id).toBe(4);
    }
  });
});
