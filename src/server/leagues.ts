/**
 * Weekly leagues, computed from recorded results so nothing can be forged
 * from the browser.
 *
 * A verified player joins this week's group (up to 30 players in their
 * league) with their first finished case of the week. Once a week has ended,
 * their place in it is settled the next time they're seen: the top of the
 * group moves up a league, the bottom moves down.
 *
 * With RAMAI_SEED_DEMO=1 the fictional demo doctors play along in every group
 * with deterministic weekly activity, so a fresh install isn't an empty table.
 * Leave it off for real players.
 */
import "server-only";

import { istWeekStart, rankFor } from "@/engine/progression";
import { COHORT_SIZE, nextTier, outcomeFor, zones, type LeagueOutcome } from "@/lib/leagues";
import { prngFrom } from "@/lib/prng";

import type { User } from "./auth";
import { getDb, tx } from "./db";
import { progressFor } from "./progress";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export const demoPlayersEnabled = () => process.env.RAMAI_SEED_DEMO === "1";

function seedOf(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** A demo doctor's XP in a week, up to `at`. Deterministic — the same answer every time it's asked. */
export function demoXp(id: string, week: number, tier: number, at: number): number {
  const rand = prngFrom(seedOf(`${id}:${week}`));
  if (rand() < 0.12) return 0; // takes the week off
  const cases = Math.round((2 + rand() * 9) * (1 + tier * 0.35));
  let xp = 0;
  for (let i = 0; i < cases; i++) {
    const when = week + rand() * WEEK;
    const gain = 60 + Math.round(rand() * 80);
    if (when <= at) xp += gain;
  }
  return xp;
}

interface Membership {
  week: number;
  user_id: string;
  tier: number;
  cohort: number;
  joined_at: number;
  final_rank: number | null;
  outcome: LeagueOutcome | null;
}

interface Standing {
  userId: string;
  name: string;
  username: string;
  xp: number;
  cases: number;
  demo: boolean;
  joinedAt: number;
}

const memberOf = (userId: string, week: number) => getDb().prepare("SELECT * FROM league_members WHERE user_id = ? AND week = ?").get(userId, week) as Membership | undefined;

/** A group's table at time `at`: members by XP recorded that week, plus the demo doctors when enabled. */
function standings(week: number, tier: number, cohort: number, at: number): Standing[] {
  const db = getDb();
  const until = Math.min(at, week + WEEK);
  const rows = (
    db
      .prepare(
        `SELECT m.user_id AS userId, u.name, u.username, m.joined_at AS joinedAt, COALESCE(SUM(r.xp), 0) AS xp, COUNT(r.id) AS cases
         FROM league_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN results r ON r.user_id = m.user_id AND r.created_at >= ? AND r.created_at < ?
         WHERE m.week = ? AND m.tier = ? AND m.cohort = ?
         GROUP BY m.user_id`,
      )
      .all(week, until, week, tier, cohort) as Omit<Standing, "demo">[]
  ).map((r) => ({ ...r, demo: false }));
  if (demoPlayersEnabled()) {
    for (const d of db.prepare("SELECT id, name, username FROM users WHERE is_demo = 1").all() as { id: string; name: string; username: string }[]) {
      const xp = demoXp(d.id, week, tier, until);
      if (xp > 0) rows.push({ userId: d.id, name: d.name, username: d.username, xp, cases: Math.max(1, Math.round(xp / 100)), demo: true, joinedAt: week });
    }
  }
  return rows.sort((a, b) => b.xp - a.xp || a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId));
}

/** Settles finished weeks the player hasn't been settled for, and sets the league they play next. */
function settle(userId: string, week: number) {
  const db = getDb();
  const open = db.prepare("SELECT * FROM league_members WHERE user_id = ? AND week < ? AND outcome IS NULL ORDER BY week").all(userId, week) as unknown as Membership[];
  let next: number | undefined;
  for (const m of open) {
    const table = standings(m.week, m.tier, m.cohort, m.week + WEEK);
    const position = table.findIndex((r) => r.userId === userId) + 1 || table.length;
    const outcome = outcomeFor(position, table.length, m.tier);
    db.prepare("UPDATE league_members SET final_rank = ?, outcome = ? WHERE week = ? AND user_id = ?").run(position, outcome, m.week, userId);
    next = nextTier(m.tier, outcome);
  }
  if (next !== undefined) db.prepare("UPDATE users SET league_tier = ? WHERE id = ?").run(next, userId);
}

const weeklyXp = (userId: string, week: number) =>
  (getDb().prepare("SELECT COALESCE(SUM(xp), 0) AS xp FROM results WHERE user_id = ? AND created_at >= ? AND created_at < ?").get(userId, week, week + WEEK) as { xp: number }).xp;

const tierOf = (userId: string) => (getDb().prepare("SELECT league_tier AS t FROM users WHERE id = ?").get(userId) as { t: number } | undefined)?.t ?? 0;

/**
 * Puts a verified player into this week's group once they've earned XP this
 * week (settling last week first). Undefined while they haven't joined.
 */
export function ensureMembership(user: User, now = Date.now()): Membership | undefined {
  if (!user.emailVerified || user.isGuest) return undefined;
  const week = istWeekStart(new Date(now));
  const existing = memberOf(user.id, week);
  if (existing) return existing;
  settle(user.id, week);
  if (weeklyXp(user.id, week) <= 0) return undefined;
  return tx((db) => {
    const raced = memberOf(user.id, week);
    if (raced) return raced;
    const tier = tierOf(user.id);
    const open = db.prepare("SELECT cohort FROM league_members WHERE week = ? AND tier = ? GROUP BY cohort HAVING COUNT(*) < ? ORDER BY cohort LIMIT 1").get(week, tier, COHORT_SIZE) as { cohort: number } | undefined;
    const last = (db.prepare("SELECT MAX(cohort) AS c FROM league_members WHERE week = ? AND tier = ?").get(week, tier) as { c: number | null }).c;
    const cohort = open?.cohort ?? (last ?? -1) + 1;
    db.prepare("INSERT INTO league_members (week, user_id, tier, cohort, joined_at) VALUES (?, ?, ?, ?, ?)").run(week, user.id, tier, cohort, now);
    return memberOf(user.id, week)!;
  });
}

/** The player's place in this week's group, if they've joined it. */
export function leaguePosition(user: User, now = Date.now()): { position: number; tier: number; size: number } | undefined {
  const week = istWeekStart(new Date(now));
  const m = memberOf(user.id, week);
  if (!m) return undefined;
  const table = standings(week, m.tier, m.cohort, now);
  return { position: table.findIndex((r) => r.userId === user.id) + 1, tier: m.tier, size: table.length };
}

/* -------------------------------------------------------------------------- */
/* The view                                                                    */
/* -------------------------------------------------------------------------- */

export interface LeagueRow {
  position: number;
  userId: string;
  name: string;
  username: string;
  xp: number;
  cases: number;
  /** Places gained (+) or lost (−) in the last 24 hours; null when new to the table today. */
  movement: number | null;
  rankTier: number;
  rankLabel: string;
  streak: number;
  /** A fictional demo doctor (demo mode only). */
  demo: boolean;
}

export interface LeagueView {
  /** joined: in this week's group · waiting: first case of the week joins · unverified · guest */
  status: "joined" | "waiting" | "unverified" | "guest";
  tier: number;
  weekStart: number;
  weekEnd: number;
  rows: LeagueRow[];
  promote: number;
  demote: number;
  /** How last week ended, once it's settled. */
  lastWeek?: { week: number; tier: number; rank: number; outcome: LeagueOutcome; nextTier: number };
}

export function leagueView(user: User, now = Date.now()): LeagueView {
  const week = istWeekStart(new Date(now));
  const base = { weekStart: week, weekEnd: week + WEEK, rows: [] as LeagueRow[], promote: 0, demote: 0 };
  if (user.isGuest) return { ...base, status: "guest", tier: 0 };
  if (!user.emailVerified) return { ...base, status: "unverified", tier: tierOf(user.id) };

  const member = ensureMembership(user, now);
  const last = getDb().prepare("SELECT week, tier, final_rank, outcome FROM league_members WHERE user_id = ? AND week = ? AND outcome IS NOT NULL").get(user.id, week - WEEK) as
    | { week: number; tier: number; final_rank: number; outcome: LeagueOutcome }
    | undefined;
  const lastWeek = last ? { week: last.week, tier: last.tier, rank: last.final_rank, outcome: last.outcome, nextTier: nextTier(last.tier, last.outcome) } : undefined;
  if (!member) return { ...base, status: "waiting", tier: tierOf(user.id), lastWeek };

  const table = standings(week, member.tier, member.cohort, now);
  const yesterday = standings(week, member.tier, member.cohort, now - DAY).filter((r) => r.xp > 0);
  const was = new Map(yesterday.map((r, i) => [r.userId, i + 1]));
  const rows = table.map((r, i): LeagueRow => {
    const progress = progressFor(r.userId);
    const rank = rankFor(progress.percent);
    const before = was.get(r.userId);
    const streak = r.demo ? prngFrom(seedOf(`${r.userId}:streak:${week}`))() * 15 : progress.streakDays;
    return { position: i + 1, userId: r.userId, name: r.name, username: r.username, xp: r.xp, cases: r.cases, movement: before === undefined ? null : before - (i + 1), rankTier: rank.tier, rankLabel: rank.label, streak: Math.floor(streak), demo: r.demo };
  });
  return { ...base, status: "joined", tier: member.tier, rows, ...zones(table.length, member.tier), lastWeek };
}
