/** What the Progress page shows — isomorphic: the server computes it, the page draws it. */
import type { CaseTrack, Specialty } from "@/engine/types";

export interface ProgressDetail {
  cases: number;
  /** The last 30 scores, oldest first. */
  trend: { score: number; at: number; specialty: string }[];
  /** The last ten cases' average against the ten before (null when there aren't enough). */
  average: { recent: number | null; earlier: number | null };
  /** Each skill's average over recent cases, weakest first. */
  skills: { id: string; label: string; percent: number; cases: number }[];
  specialties: { name: string; cases: number; average: number }[];
  /** Cases per day over the last twelve weeks, oldest first ("2026-10-13"). */
  activity: { day: string; cases: number }[];
  mcq: { answered: number; correct: number; weakTopics: { topic: string; answered: number; correct: number }[] };
  streak: number;
  bestStreak: number;
  xp: number;
  rank: string;
  rankTier: number;
}

/** The personal report, written by AI from the doctor's own cases. */
export interface PersonalReport {
  headline: string;
  strengths: string[];
  repeatedMistakes: { pattern: string; evidence: string; fix: string }[];
  weakAreas: { area: string; why: string }[];
  progress: string;
  recommendations: { action: string; why: string; specialty?: Specialty; track?: CaseTrack }[];
  writtenAt: number;
  /** How many cases it was written from — a new case makes it out of date. */
  cases: number;
  model: string;
}

/** Cases before a report can say anything useful. */
export const REPORT_MIN_CASES = 3;
