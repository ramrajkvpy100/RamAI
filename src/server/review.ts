/**
 * Spaced repetition and weak spots, from the doctor's own results: diagnoses they scored under 70
 * come back for review after a spacing that grows with each attempt (1, 3, 7, 14 days), until they
 * score 70 or more; and their average by specialty, weakest first.
 */
import "server-only";

import { db } from "./db";

const PASS = 70;
const SPACING_DAYS = [1, 3, 7, 14, 30];

export interface DueReview {
  diagnosis: string;
  specialty: string;
  best: number;
  attempts: number;
}

export async function dueReviews(userId: string, now = Date.now()): Promise<DueReview[]> {
  const rows = await db.all<{ diagnosis: string; specialty: string; best: number; attempts: number; last: number }>(
    `SELECT diagnosis, MAX(specialty) AS specialty, MAX(score) AS best, COUNT(*) AS attempts, MAX(created_at) AS last
     FROM results WHERE user_id = ? AND diagnosis != '' GROUP BY lower(diagnosis)`,
    userId,
  );
  return rows
    .map((r) => ({ ...r, best: Number(r.best), attempts: Number(r.attempts), last: Number(r.last) }))
    .filter((r) => r.best < PASS && now - r.last >= SPACING_DAYS[Math.min(r.attempts - 1, SPACING_DAYS.length - 1)]! * 86_400_000)
    .sort((a, b) => a.best - b.best)
    .slice(0, 5)
    .map(({ diagnosis, specialty, best, attempts }) => ({ diagnosis, specialty, best, attempts }));
}

export interface SpecialtyStat {
  specialty: string;
  cases: number;
  average: number;
}

export async function specialtyStats(userId: string): Promise<SpecialtyStat[]> {
  const rows = await db.all<{ specialty: string; cases: number; average: number }>(
    "SELECT specialty, COUNT(*) AS cases, AVG(score) AS average FROM results WHERE user_id = ? GROUP BY specialty",
    userId,
  );
  return rows.map((r) => ({ specialty: r.specialty, cases: Number(r.cases), average: Math.round(Number(r.average)) })).sort((a, b) => a.average - b.average);
}
