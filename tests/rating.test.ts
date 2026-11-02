import { describe, expect, it } from "vitest";

import { nextRank, rankFor, withDerived } from "@/engine/progression";
import { caseRatingFor, duelDeltas, performance, ratingDelta, replayRating } from "@/engine/rating";
import type { CompletedCaseSummary } from "@/engine/types";

const played = (over: Partial<CompletedCaseSummary>, day = 1): CompletedCaseSummary => ({
  caseId: `gen-${day}`, caseNumber: day, specialty: "Medicine", track: "emergency", level: "district", diagnosis: "x", score: 80, xp: 100,
  completedISO: new Date(Date.UTC(2026, 9, day)).toISOString(), ...over,
});

describe("the rating", () => {
  it("a 1200 doctor scoring 95 on a 1650 case gains a lot during placement", () => {
    const delta = ratingDelta(1200, 1650, 95, 0);
    expect(delta).toBeGreaterThanOrEqual(35);
    expect(delta).toBeLessThanOrEqual(44);
  });

  it("an 1850 doctor scoring 90 on an 1100 case can't farm it", () => {
    expect(ratingDelta(1850, 1100, 90, 50)).toBeLessThanOrEqual(2);
    expect(ratingDelta(1850, 1100, 100, 50, { clean: true })).toBeLessThanOrEqual(2);
  });

  it("a 1500 doctor who scores 30, or whose patient dies, loses rating", () => {
    expect(ratingDelta(1500, 1500, 30, 50)).toBe(-12);
    expect(ratingDelta(1500, 1500, 90, 50, { failed: true })).toBe(-12);
  });

  it("75 is par on an even case; the curve joins up", () => {
    expect(performance(75)).toBeCloseTo(0.5);
    expect(performance(35)).toBe(0);
    expect(performance(34)).toBe(0);
    expect(performance(100)).toBe(1);
    expect(ratingDelta(1500, 1500, 75, 50)).toBe(0);
    expect(performance(90, { clean: true }) - performance(90)).toBeCloseTo(0.05);
  });

  it("K falls with experience, and the rating has a floor", () => {
    expect(ratingDelta(1500, 1500, 100, 9)).toBe(24);
    expect(ratingDelta(1500, 1500, 100, 10)).toBe(16);
    expect(ratingDelta(1500, 1500, 100, 30)).toBe(12);
    const fallen = replayRating(Array.from({ length: 40 }, (_, i) => played({ score: 0, level: "phc", caseRating: 1000 }, i + 1)));
    expect(fallen.rating).toBeGreaterThanOrEqual(800);
  });

  it("case ratings run from the level, within 1000–2200", () => {
    expect(caseRatingFor("phc", 1)).toBe(1040);
    expect(caseRatingFor("district")).toBe(1500);
    expect(caseRatingFor("apex", 3)).toBe(2010);
    expect(caseRatingFor("grandrounds", 5)).toBe(2200);
  });
});

describe("what doesn't count", () => {
  it("a tutorial changes nothing", () => {
    const r = replayRating([played({ tutorial: true, score: 100 })]);
    expect(r.rating).toBe(1200);
    expect(r.ratedCases).toBe(0);
    expect(r.steps[0]).toMatchObject({ delta: 0, unrated: "tutorial" });
  });

  it("the same written case again within 7 days changes nothing; a week later it counts", () => {
    const r = replayRating([played({ caseId: "derm-1", score: 90 }, 1), played({ caseId: "derm-1", score: 100 }, 3), played({ caseId: "derm-1", score: 100 }, 12)]);
    expect(r.steps[1]).toMatchObject({ delta: 0, unrated: "repeat" });
    expect(r.steps[2]!.unrated).toBeUndefined();
    expect(r.steps[2]!.delta).toBeGreaterThan(0);
  });

  it("a duel waits for the opponent, then moves by the exchange", () => {
    const pending = replayRating([played({ duelId: "d1", score: 100 })]);
    expect(pending.rating).toBe(1200);
    expect(pending.steps[0]!.unrated).toBe("duel-pending");
    expect(replayRating([played({ duelId: "d1", score: 100, ratingBonus: 20 })]).rating).toBe(1220);
    const [a, b] = duelDeltas(1500, 1500, 1, 50, 50);
    expect(a).toBe(12);
    expect(b).toBe(-12);
  });

  it("the daily case adds its bonus", () => {
    const plain = replayRating([played({})]).rating;
    expect(replayRating([played({ daily: true })]).rating).toBe(plain + 5);
  });
});

describe("ranks follow the rating", () => {
  it.each([[1149, "Medical Student"], [1150, "Intern"], [1200, "Intern"], [1300, "Junior Resident"], [1450, "Senior Resident"], [1600, "Assistant Professor"], [1750, "Associate Professor"], [1900, "Professor"], [2000, "Head of Department"], [2100, "Dean"], [2250, "Master Clinician"]])("%i is %s", (rating, label) => {
    expect(rankFor(rating as number).label).toBe(label);
  });

  it("the next rank, and progress carries the record", () => {
    expect(nextRank(1508)?.minRating).toBe(1600);
    const p = withDerived([played({ score: 95, caseRating: 1650 })]);
    expect(p.rating).toBeGreaterThan(1200);
    expect(p.provisional).toBe(true);
    expect(p.peakRating).toBe(p.rating);
    expect(p.ratingPoints).toEqual([1200, p.rating]);
  });
});
