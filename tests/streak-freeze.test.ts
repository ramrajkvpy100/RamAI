import { describe, expect, it } from "vitest";

import { computeRating, streakWithFreezes } from "@/engine/progression";
import type { CompletedCaseSummary } from "@/engine/types";

const at = (daysAgo: number, score = 70, level = "district"): CompletedCaseSummary => ({ caseId: `c${daysAgo}`, caseNumber: 1, specialty: "Medicine", track: "opd", level: level as CompletedCaseSummary["level"], diagnosis: "x", score, xp: 10, completedISO: new Date(Date.UTC(2026, 9, 20, 6) - daysAgo * 86_400_000).toISOString() });
const now = new Date(Date.UTC(2026, 9, 20, 8));

describe("streak freezes", () => {
  it("one missed day is forgiven", () => expect(streakWithFreezes([at(3), at(1), at(0)], now)).toMatchObject({ days: 3, frozen: ["2026-10-18"] }));
  it("two missed days in a row are forgiven", () => expect(streakWithFreezes([at(4), at(1), at(0)], now).days).toBe(3));
  it("three missed days break it", () => expect(streakWithFreezes([at(5), at(1), at(0)], now).days).toBe(2));
  it("no play at all: no streak", () => expect(streakWithFreezes([], now).days).toBe(0));
  it("a plain run needs no freeze", () => expect(streakWithFreezes([at(2), at(1), at(0)], now)).toMatchObject({ days: 3, frozen: [] }));
});

describe("clinical rating", () => {
  it("starts at 1200, rises with good scores on hard cases, falls with poor ones on easy cases", () => {
    expect(computeRating([])).toBe(1200);
    expect(computeRating([at(1, 95, "apex")])).toBeGreaterThan(1215);
    expect(computeRating([at(1, 30, "phc")])).toBeLessThan(1185);
  });
});
