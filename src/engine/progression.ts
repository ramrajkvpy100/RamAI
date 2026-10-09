/**
 * Progression — XP, rank, streak, daily goal, badges and mastery.
 *
 * Pure and isomorphic. The server computes progress from recorded results;
 * the client only renders it. Days roll over at midnight IST.
 */
import type { Badge, CareLevel, CompletedCaseSummary, PlayerProgress, Rank, Specialty, SpecialtyMastery } from "./types";
import { CARE_LEVELS } from "./types";

/** The academic ladder of an Indian teaching hospital. */
export const RANKS: Rank[] = [
  { id: "student", label: "Medical Student", tier: 1, minPercent: 0, maxPercent: 19.99 },
  { id: "intern", label: "Intern", tier: 2, minPercent: 20, maxPercent: 29.99 },
  { id: "junior-resident", label: "Junior Resident", tier: 3, minPercent: 30, maxPercent: 39.99 },
  { id: "senior-resident", label: "Senior Resident", tier: 4, minPercent: 40, maxPercent: 49.99 },
  { id: "assistant-professor", label: "Assistant Professor", tier: 5, minPercent: 50, maxPercent: 59.99 },
  { id: "associate-professor", label: "Associate Professor", tier: 6, minPercent: 60, maxPercent: 69.99 },
  { id: "professor", label: "Professor", tier: 7, minPercent: 70, maxPercent: 79.99 },
  { id: "hod", label: "Head of Department", tier: 8, minPercent: 80, maxPercent: 89.99 },
  { id: "dean", label: "Dean", tier: 9, minPercent: 90, maxPercent: 94.99 },
  { id: "master", label: "Master Clinician", tier: 10, minPercent: 95, maxPercent: 100 },
];

export const CORE_SPECIALTIES: Specialty[] = ["Dermatology", "Medicine", "Emergency", "Surgery"];

export const ALL_SPECIALTIES: Specialty[] = [
  "Medicine", "Dermatology", "Surgery", "Pediatrics", "OBGYN", "Emergency", "Cardiology", "Neurology",
  "Respiratory", "Gastroenterology", "Nephrology", "Endocrinology", "Psychiatry", "ENT", "Ophthalmology",
  "Orthopedics", "Urology", "Infectious Disease",
];

export const DAILY_GOAL_XP = 150;

/** Cases needed before rank reflects full ability (one lucky case can't make a Dean). */
const RANK_CONFIDENCE_CASES = 8;
const MASTERY_CONFIDENCE_CASES = 4;
const WINDOW = 20;
const IST_OFFSET_MS = 330 * 60_000;

export function rankFor(percent: number): Rank {
  const p = Math.max(0, Math.min(100, percent));
  return RANKS.find((r) => p >= r.minPercent && p <= r.maxPercent) ?? RANKS[0]!;
}

export function nextRank(percent: number): Rank | undefined {
  const idx = RANKS.findIndex((r) => r.id === rankFor(percent).id);
  return RANKS[idx + 1];
}

/** Progress (0–1) from the current rank's floor to the next rank's floor. */
export function rankProgress(percent: number): number {
  const current = rankFor(percent);
  const next = nextRank(percent);
  if (!next) return 1;
  return Math.max(0, Math.min(1, (percent - current.minPercent) / (next.minPercent - current.minPercent)));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Calendar day in India, "2026-10-08". */
export function istDayKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Monday 00:00 IST of the week containing `now`, as epoch milliseconds. */
export function istWeekStart(now = new Date()): number {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = (ist.getUTCDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day);
  return monday - IST_OFFSET_MS;
}

export function computePercent(history: CompletedCaseSummary[]): number {
  const recent = history.slice(-WINDOW).map((h) => h.score);
  return Math.round(mean(recent) * Math.min(1, history.length / RANK_CONFIDENCE_CASES) * 10) / 10;
}

export function computeMastery(history: CompletedCaseSummary[]): SpecialtyMastery[] {
  const by = new Map<Specialty, number[]>();
  for (const h of history) by.set(h.specialty, [...(by.get(h.specialty) ?? []), h.score]);
  return ALL_SPECIALTIES.map((specialty) => {
    const scores = by.get(specialty) ?? [];
    return { specialty, cases: scores.length, percent: Math.round(mean(scores.slice(-10)) * Math.min(1, scores.length / MASTERY_CONFIDENCE_CASES)) };
  });
}

function dayList(history: CompletedCaseSummary[]): string[] {
  return [...new Set(history.map((h) => istDayKey(new Date(h.completedISO))))].sort();
}

const prevDay = (key: string) => new Date(Date.parse(`${key}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Consecutive IST days with at least one completed case, ending today or yesterday. */
export function computeStreak(history: CompletedCaseSummary[], now = new Date()): number {
  const days = new Set(dayList(history));
  let cursor = istDayKey(now);
  if (!days.has(cursor)) cursor = prevDay(cursor);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = prevDay(cursor);
  }
  return streak;
}

export function computeBestStreak(history: CompletedCaseSummary[]): number {
  const days = dayList(history);
  let best = 0;
  let run = 0;
  let last: string | undefined;
  for (const d of days) {
    run = last && prevDay(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                      */
/* -------------------------------------------------------------------------- */

const BADGES: (Badge & { earned: (h: CompletedCaseSummary[], bestStreak: number) => boolean })[] = [
  { id: "first-case", label: "First patient", description: "Completed your first case", earned: (h) => h.length >= 1 },
  { id: "ten-cases", label: "Ten patients", description: "Completed 10 cases", earned: (h) => h.length >= 10 },
  { id: "fifty-cases", label: "Fifty patients", description: "Completed 50 cases", earned: (h) => h.length >= 50 },
  { id: "streak-7", label: "Week on call", description: "A 7-day streak", earned: (_h, s) => s >= 7 },
  { id: "streak-30", label: "Month on call", description: "A 30-day streak", earned: (_h, s) => s >= 30 },
  { id: "rescuer", label: "Saved in time", description: "Rescued a deteriorating patient", earned: (h) => h.some((x) => x.rescued) },
  { id: "sharp", label: "Sharp eye", description: "Scored 90 or more", earned: (h) => h.some((x) => x.score >= 90) },
  { id: "phone", label: "Steady voice", description: "Three phone consults scored 70+", earned: (h) => h.filter((x) => x.track === "phone" && x.score >= 70).length >= 3 },
  { id: "grand-rounds", label: "World class", description: "Solved a Global Centre of Excellence case", earned: (h) => h.some((x) => x.level === "grandrounds" && (x.verdict === "correct" || x.verdict === "implied")) },
  { id: "full-circuit", label: "Full circuit", description: "Played every care level", earned: (h) => CARE_LEVELS.every((l) => h.some((x) => x.level === l)) },
];

/** Every badge, earned or not — for the profile cabinet. */
export const BADGE_LIST: Badge[] = BADGES.map(({ id, label, description }) => ({ id, label, description }));

export function computeBadges(history: CompletedCaseSummary[], bestStreak = computeBestStreak(history)): Badge[] {
  return BADGES.filter((b) => b.earned(history, bestStreak)).map(({ id, label, description }) => ({ id, label, description }));
}

/* -------------------------------------------------------------------------- */

export function withDerived(history: CompletedCaseSummary[], now = new Date()): PlayerProgress {
  const today = istDayKey(now);
  const bestStreak = computeBestStreak(history);
  return {
    xp: history.reduce((s, h) => s + h.xp, 0),
    percent: computePercent(history),
    casesCompleted: history.length,
    streakDays: computeStreak(history, now),
    bestStreak,
    dailyXp: history.filter((h) => istDayKey(new Date(h.completedISO)) === today).reduce((s, h) => s + h.xp, 0),
    dailyGoal: DAILY_GOAL_XP,
    lastPlayedISO: history[history.length - 1]?.completedISO,
    mastery: computeMastery(history),
    levels: CARE_LEVELS.map((level: CareLevel) => {
      const at = history.filter((h) => h.level === level);
      return { level, cases: at.length, best: at.length ? Math.max(...at.map((h) => h.score)) : 0 };
    }),
    badges: computeBadges(history, bestStreak),
    history,
  };
}

export function emptyProgress(): PlayerProgress {
  return withDerived([]);
}
