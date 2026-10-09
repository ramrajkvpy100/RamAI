/**
 * Results, progress, usage and leaderboards — all computed server-side from
 * recorded results, so XP and ranks cannot be forged from the browser.
 */
import "server-only";

import { istDayKey, istWeekStart, rankFor } from "@/engine/progression";
import type { CaseDebrief, CaseRewards } from "@/engine/types";

import type { User } from "./auth";
import { getDb } from "./db";
import { demoPlayersEnabled, ensureMembership, leaguePosition } from "./leagues";
import { progressFor } from "./progress";

export { historyFor, progressFor } from "./progress";

/* -------------------------------------------------------------------------- */
/* Usage                                                                       */
/* -------------------------------------------------------------------------- */

function istDayStart(now = new Date()): number {
  return Date.parse(`${istDayKey(now)}T00:00:00+05:30`);
}

/** Cases started today against the plan's daily limit. The guided demo case is free. */
export function casesStartedToday(userId: string): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM case_starts WHERE user_id = ? AND created_at >= ? AND tutorial = 0").get(userId, istDayStart()) as { n: number };
  return row.n;
}

export function totalCasesStarted(userId: string): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM case_starts WHERE user_id = ?").get(userId) as { n: number }).n;
}

export function recordCaseStart(userId: string, sessionId: string, tutorial = false) {
  getDb().prepare("INSERT INTO case_starts (user_id, session_id, created_at, tutorial) VALUES (?, ?, ?, ?)").run(userId, sessionId, Date.now(), tutorial ? 1 : 0);
}

export function recentCaseRefs(userId: string, limit = 6): string[] {
  const rows = getDb().prepare("SELECT case_ref FROM results WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit) as { case_ref: string }[];
  return rows.map((r) => r.case_ref);
}

/* -------------------------------------------------------------------------- */
/* Leaderboards                                                                */
/* -------------------------------------------------------------------------- */

export const BOARDS = {
  overall: { label: "Overall", where: "1 = 1" },
  opd: { label: "OPD", where: "r.track = 'opd'" },
  emergency: { label: "Emergency", where: "r.track = 'emergency'" },
  phone: { label: "Phone", where: "r.track = 'phone'" },
  hard: { label: "Hard cases", where: "r.level IN ('college', 'apex', 'grandrounds')" },
} as const;
export type BoardId = keyof typeof BOARDS;
export type Period = "week" | "all";

export interface LeaderRow {
  position: number;
  userId: string;
  name: string;
  username: string;
  xp: number;
  cases: number;
  rankTier: number;
  rankLabel: string;
  demo: boolean;
}

/** Verified players only (no guests); demo doctors only when demo mode is on. */
function standings(board: BoardId, period: Period): Omit<LeaderRow, "rankTier" | "rankLabel">[] {
  const since = period === "week" ? istWeekStart() : 0;
  const rows = getDb()
    .prepare(
      `SELECT u.id AS userId, u.name, u.username, u.is_demo AS isDemo, SUM(r.xp) AS xp, COUNT(*) AS cases
       FROM results r JOIN users u ON u.id = r.user_id
       WHERE r.created_at >= ? AND ${BOARDS[board].where}
         AND u.is_guest = 0 AND (u.is_demo = 1 OR u.email_verified_at IS NOT NULL) AND (u.is_demo = 0 OR ? = 1)
       GROUP BY u.id ORDER BY xp DESC, cases ASC, MIN(r.created_at) ASC`,
    )
    .all(since, demoPlayersEnabled() ? 1 : 0) as { userId: string; name: string; username: string; isDemo: number; xp: number; cases: number }[];
  return rows.map(({ isDemo, ...r }, i) => ({ ...r, demo: isDemo === 1, position: i + 1 }));
}

export function leaderboard(board: BoardId, period: Period, viewerId?: string, limit = 50) {
  const all = standings(board, period);
  const withRank = (r: Omit<LeaderRow, "rankTier" | "rankLabel">): LeaderRow => {
    const rank = rankFor(progressFor(r.userId).percent);
    return { ...r, rankTier: rank.tier, rankLabel: rank.label };
  };
  const top = all.slice(0, limit).map(withRank);
  const meRow = viewerId ? all.find((r) => r.userId === viewerId) : undefined;
  return { rows: top, me: meRow ? withRank(meRow) : undefined, total: all.length };
}

/* -------------------------------------------------------------------------- */
/* Recording a closed case                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Records a debrief exactly once per session and returns what it earned.
 * Idempotent: re-closing or replaying the same session never double-counts.
 */
export function recordCase(user: User, sessionId: string, debrief: CaseDebrief): CaseRewards {
  const db = getDb();
  const before = progressFor(user.id);
  const positionBefore = leaguePosition(user)?.position;
  const rescued = debrief.rescue.episodes.some((e) => e.rescued === "full" || e.rescued === "partial");
  db.prepare(
    `INSERT OR IGNORE INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, rescued, score, xp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(user.id, sessionId, debrief.caseRef, debrief.caseNumber, debrief.specialty, debrief.track, debrief.level, debrief.diagnosis, debrief.verdict, rescued ? 1 : 0, debrief.score.total, debrief.score.xp, Date.now());
  const after = progressFor(user.id);
  ensureMembership(user);
  const league = leaguePosition(user);
  return {
    xp: debrief.score.xp,
    streakDays: after.streakDays,
    streakExtended: after.streakDays > before.streakDays,
    dailyXp: after.dailyXp,
    dailyGoal: after.dailyGoal,
    rankBefore: rankFor(before.percent).label,
    rankAfter: rankFor(after.percent).label,
    weeklyPosition: league?.position,
    weeklyPositionBefore: positionBefore,
    leagueTier: league?.tier,
    newBadges: after.badges.filter((b) => !before.badges.some((x) => x.id === b.id)),
  };
}
