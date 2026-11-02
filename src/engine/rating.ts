/**
 * The clinical rating: Elo, replayed from a doctor's recorded cases, so it is always the same from the same record.
 * Pure and isomorphic. A case has a rating (its care level and difficulty); a score beats or falls short of what's expected
 * between the doctor's rating and the case's.
 */
import type { CareLevel, CompletedCaseSummary } from "./types";

export const START_RATING = 1200;
export const RATING_FLOOR = 800;
export const PROVISIONAL_CASES = 5;
const REPEAT_DAYS = 7;
export const DAILY_BONUS = 5;

const LEVEL_RATING: Record<CareLevel, number> = { phc: 1100, chc: 1300, district: 1500, college: 1700, apex: 1950, grandrounds: 2100 };

/** A case's rating, 1000–2200: its care level, moved by its difficulty (1–5; 2 is the level's usual). */
export function caseRatingFor(level: CareLevel, difficulty = 2): number {
  return Math.max(1000, Math.min(2200, (LEVEL_RATING[level] ?? 1500) + (difficulty - 2) * 60));
}

export const expectedPerformance = (doctor: number, caseRating: number) => 1 / (1 + 10 ** ((caseRating - doctor) / 400));

/** The score as performance, 0–1: 75 is par (0.5); below 35, a death, or a wrong diagnosis that harmed is 0; clean work adds up to 0.05. */
export function performance(score: number, o: { failed?: boolean; clean?: boolean } = {}): number {
  if (o.failed || score < 35) return 0;
  const s = score <= 75 ? ((score - 35) / 40) * 0.5 : 0.5 + 0.5 * ((score - 75) / 25) ** 1.15;
  return Math.min(1, s + (o.clean && score >= 75 ? 0.05 : 0));
}

/** How far one case moves the rating: quickly while it's being placed, then less. */
export const kFactor = (ratedBefore: number) => (ratedBefore < 10 ? 48 : ratedBefore < 30 ? 32 : 24);

/** The rating change for one case. Far above the case, a good score earns at most +2: easy cases can't be farmed. */
export function ratingDelta(doctor: number, caseRating: number, score: number, ratedBefore: number, o: { failed?: boolean; clean?: boolean } = {}): number {
  const delta = Math.round(kFactor(ratedBefore) * (performance(score, o) - expectedPerformance(doctor, caseRating)));
  return doctor - caseRating > 350 && score >= 85 ? Math.min(delta, 2) : delta;
}

export type UnratedReason = "learning" | "tutorial" | "repeat" | "hints" | "duel-pending";

export const UNRATED_LABEL: Record<UnratedReason, string> = {
  learning: "Unrated · Learning mode",
  tutorial: "Unrated · Tutorial",
  repeat: "Unrated · Played in the last 7 days",
  hints: "Unrated · Senior's help used",
  "duel-pending": "Duel · Rated when your opponent finishes",
};

export interface RatingStep {
  caseId: string;
  caseRating: number;
  before: number;
  after: number;
  delta: number;
  /** Expected performance against this case, 0–1. */
  expected: number;
  unrated?: UnratedReason;
  /** Includes the daily case's bonus. */
  dailyBonus?: boolean;
}

export interface RatingRecord {
  rating: number;
  peak: number;
  ratedCases: number;
  provisional: boolean;
  /** The rating after each rated case, oldest first, starting from where it began. */
  points: number[];
  steps: RatingStep[];
}

const DAY = 86_400_000;

/** Replays a doctor's cases in order. */
export function replayRating(history: readonly CompletedCaseSummary[]): RatingRecord {
  let rating = START_RATING;
  let peak = START_RATING;
  let rated = 0;
  const points = [START_RATING];
  const steps: RatingStep[] = [];
  const lastPlayed = new Map<string, number>();
  for (const h of history) {
    const caseRating = h.caseRating ?? caseRatingFor(h.level);
    const at = Date.parse(h.completedISO);
    const previous = lastPlayed.get(h.caseId);
    lastPlayed.set(h.caseId, at);
    const expected = expectedPerformance(rating, caseRating);
    const before = rating;
    let unrated: UnratedReason | undefined;
    let delta = 0;
    if (h.tutorial) unrated = "tutorial";
    else if (previous !== undefined && at - previous < REPEAT_DAYS * DAY) unrated = "repeat";
    else if (h.duelId) {
      // A duel is settled head to head, once both have played.
      if (h.ratingBonus === undefined || h.ratingBonus === null) unrated = "duel-pending";
      else delta = h.ratingBonus;
    } else {
      delta = ratingDelta(rating, caseRating, h.score, rated, { failed: h.failed, clean: h.clean });
      if (h.daily) delta += DAILY_BONUS;
    }
    if (!unrated) {
      rated += 1;
      rating = Math.max(RATING_FLOOR, rating + delta);
      peak = Math.max(peak, rating);
      points.push(rating);
    }
    steps.push({ caseId: h.caseId, caseRating, before, after: rating, delta: rating - before, expected, ...(unrated ? { unrated } : {}), ...(h.daily && !unrated && !h.duelId ? { dailyBonus: true } : {}) });
  }
  return { rating, peak, ratedCases: rated, provisional: rated < PROVISIONAL_CASES, points, steps };
}

/** The Elo exchange between two doctors: 1 for the win, 0.5 for a dead heat. */
export function duelDeltas(a: number, b: number, aResult: 0 | 0.5 | 1, aRated: number, bRated: number): [number, number] {
  return [Math.round(kFactor(aRated) * (aResult - expectedPerformance(a, b))), Math.round(kFactor(bRated) * (1 - aResult - expectedPerformance(b, a)))];
}

export const GUIDED_CASES = new Set(["tut-hypoglycaemia-01"]);
