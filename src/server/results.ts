/**
 * Results, progress, usage and leaderboards — all computed server-side from
 * recorded results, so XP and ranks cannot be forged from the browser.
 */
import "server-only";

import { istDayKey, istWeekStart, rankFor } from "@/engine/progression";
import type { CaseDebrief, CaseRewards } from "@/engine/types";

import type { User } from "./auth";
import { db } from "./db";
import { demoPlayersEnabled, ensureMembership, leaguePosition } from "./leagues";
import { progressFor, progressForMany } from "./progress";
import { squares } from "@/lib/daily";

export { historyFor, progressFor } from "./progress";

/* -------------------------------------------------------------------------- */
/* Usage                                                                       */
/* -------------------------------------------------------------------------- */

function istDayStart(now = new Date()): number {
  return Date.parse(`${istDayKey(now)}T00:00:00+05:30`);
}

/** Cases started today against the plan's daily limit. The guided demo and the daily case are free. */
export async function casesStartedToday(userId: string): Promise<number> {
  return (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM case_starts WHERE user_id = ? AND created_at >= ? AND tutorial = 0 AND daily_key IS NULL", userId, istDayStart()))?.n ?? 0;
}

export async function totalCasesStarted(userId: string): Promise<number> {
  return (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM case_starts WHERE user_id = ?", userId))?.n ?? 0;
}

export async function recordCaseStart(userId: string, sessionId: string, tutorial = false, dailyKey?: string) {
  await db.run("INSERT INTO case_starts (user_id, session_id, created_at, tutorial, daily_key) VALUES (?, ?, ?, ?, ?)", userId, sessionId, Date.now(), tutorial ? 1 : 0, dailyKey ?? null);
}

/* -------------------------------------------------------------------------- */
/* The daily case                                                              */
/* -------------------------------------------------------------------------- */

/** Only a player's first daily session of the day is ranked — no peeking, then replaying. */
async function firstDailySession(userId: string, dayKey: string): Promise<string | undefined> {
  return (await db.get<{ session_id: string }>("SELECT session_id FROM case_starts WHERE user_id = ? AND daily_key = ? ORDER BY created_at, id LIMIT 1", userId, dayKey))?.session_id;
}

export interface DailyRow {
  position: number;
  userId: string;
  name: string;
  username: string;
  score: number;
  minutes: number;
  /** The spoiler-free score squares. */
  grid: string | null;
}

/** Today's ranking: score, then the quicker encounter, then who finished first. */
export async function dailyBoard(dayKey: string, viewerId?: string, limit = 10) {
  const rows = await db.all<Omit<DailyRow, "position">>(
    `SELECT u.id AS userId, u.name, u.username, r.score, COALESCE(r.elapsed_min, 0) AS minutes, r.grid
     FROM results r JOIN users u ON u.id = r.user_id
     WHERE r.daily_key = ? AND u.is_guest = 0
     ORDER BY r.score DESC, r.elapsed_min ASC, r.created_at ASC`,
    dayKey,
  );
  const ranked = rows.map((r, i) => ({ ...r, position: i + 1 }));
  return { top: ranked.slice(0, limit), me: viewerId ? ranked.find((r) => r.userId === viewerId) : undefined, total: ranked.length };
}

async function dailyPlace(userId: string, dayKey: string, ranked: boolean) {
  const board = await dailyBoard(dayKey, userId, 0);
  return { position: board.me?.position ?? 0, total: board.total, ranked };
}

/** Whether the player has started or finished today's case. */
export async function dailyStarted(userId: string, dayKey: string): Promise<boolean> {
  return (await firstDailySession(userId, dayKey)) !== undefined;
}

export async function recentCaseRefs(userId: string, limit = 6): Promise<string[]> {
  return (await db.all<{ case_ref: string }>("SELECT case_ref FROM results WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", userId, limit)).map((r) => r.case_ref);
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
async function standings(board: BoardId, period: Period): Promise<Omit<LeaderRow, "rankTier" | "rankLabel">[]> {
  const since = period === "week" ? istWeekStart() : 0;
  const rows = await db.all<{ userId: string; name: string; username: string; isDemo: number; xp: number; cases: number }>(
    `SELECT u.id AS userId, u.name, u.username, u.is_demo AS isDemo, SUM(r.xp) AS xp, COUNT(*) AS cases
     FROM results r JOIN users u ON u.id = r.user_id
     WHERE r.created_at >= ? AND ${BOARDS[board].where}
       AND u.is_guest = 0 AND (u.is_demo = 1 OR u.email_verified_at IS NOT NULL) AND (u.is_demo = 0 OR ? = 1)
     GROUP BY u.id ORDER BY xp DESC, cases ASC, MIN(r.created_at) ASC`,
    since, demoPlayersEnabled() ? 1 : 0,
  );
  return rows.map(({ isDemo, ...r }, i) => ({ ...r, demo: isDemo === 1, position: i + 1 }));
}

export async function leaderboard(board: BoardId, period: Period, viewerId?: string, limit = 50) {
  const all = await standings(board, period);
  const top = all.slice(0, limit);
  const meRow = viewerId ? all.find((r) => r.userId === viewerId) : undefined;
  const progress = await progressForMany([...top, ...(meRow ? [meRow] : [])].map((r) => r.userId));
  const withRank = (r: Omit<LeaderRow, "rankTier" | "rankLabel">): LeaderRow => {
    const rank = rankFor(progress.get(r.userId)?.percent ?? 0);
    return { ...r, rankTier: rank.tier, rankLabel: rank.label };
  };
  return { rows: top.map(withRank), me: meRow ? withRank(meRow) : undefined, total: all.length };
}

/* -------------------------------------------------------------------------- */
/* Recording a closed case                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Records a debrief exactly once per session and returns what it earned.
 * Idempotent: re-closing or replaying the same session never double-counts.
 */
export async function recordCase(user: User, sessionId: string, debrief: CaseDebrief, opts: { daily?: string } = {}): Promise<CaseRewards> {
  const [before, positionBefore] = await Promise.all([progressFor(user.id), leaguePosition(user).then((l) => l?.position)]);
  const rescued = debrief.rescue.episodes.some((e) => e.rescued === "full" || e.rescued === "partial");
  const ranked = opts.daily && !user.isGuest && (await firstDailySession(user.id, opts.daily)) === sessionId ? opts.daily : null;
  await db.run(
    `INSERT OR IGNORE INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, rescued, score, xp, created_at, daily_key, elapsed_min, grid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id, sessionId, debrief.caseRef, debrief.caseNumber, debrief.specialty, debrief.track, debrief.level, debrief.diagnosis, debrief.verdict, rescued ? 1 : 0, debrief.score.total, debrief.score.xp, Date.now(),
    ranked, Math.round(debrief.elapsedMin), ranked ? squares(debrief.score) : null,
  );
  const after = await progressFor(user.id);
  await ensureMembership(user);
  const league = await leaguePosition(user);
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
    ...(opts.daily && { daily: await dailyPlace(user.id, opts.daily, !!ranked) }),
  };
}
