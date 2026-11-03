import { expect, it } from "vitest";

import { ABDOMEN_CASES, HEART_CASES, LUNG_CASES } from "@/lib/banks/sounds";
import { MODALITIES, MODALITY_IDS } from "@/lib/practice";
import { SKILL_COUNTS } from "@/lib/skill-counts";
import { ALGORITHM_COUNT, ANTIDOTE_COUNT, CALCULATION_COUNT } from "@/lib/skills";

it("the counted numbers match the banks", () => {
  expect(SKILL_COUNTS.spot).toBe(MODALITY_IDS.reduce((n, m) => n + MODALITIES[m].items.length, 0));
  expect(SKILL_COUNTS.sounds).toBe(HEART_CASES.length + LUNG_CASES.length + ABDOMEN_CASES.length);
  expect(SKILL_COUNTS.antidotes).toBe(ANTIDOTE_COUNT);
  expect(SKILL_COUNTS.algorithms).toBe(ALGORITHM_COUNT);
  expect(SKILL_COUNTS.calculations).toBe(CALCULATION_COUNT);
});
