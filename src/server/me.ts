import "server-only";

import { istDayKey } from "@/engine/progression";
import type { PlayerProgress } from "@/engine/types";
import type { Me } from "@/lib/me-store";
import { dailyLimitFor } from "@/lib/plans";

import { getCurrentUser, identityQuery, userFromRow, type User } from "./auth";
import { db } from "./db";
import { ringsFor } from "./progress";
import { casesStartedToday, istDayStart, progressFor } from "./results";
import { isAdmin, newSuggestionCount } from "./suggestions";

/** Recent history sent to the browser — progress itself is computed from all of it. */
const HISTORY_SENT = 30;

import { parseAvatar } from "@/lib/avatar-style";

export async function meFor(user: User): Promise<Me> {
  const [progress, casesToday, admin, avatar, rings] = await Promise.all([
    progressFor(user.id),
    casesStartedToday(user.id),
    user.isGuest ? false : isAdmin(user).catch(() => false),
    db.get<{ style: string }>("SELECT style FROM user_avatars WHERE user_id = ?", user.id).then((r) => (r ? parseAvatar(JSON.parse(r.style)) : null)).catch(() => null),
    ringsFor(user.id).catch(() => undefined),
  ]);
  return {
    user,
    ...(rings ? { rings } : {}),
    ...(avatar ? { avatar } : {}),
    progress: { ...progress, history: progress.history.slice(-HISTORY_SENT) },
    usage: { casesToday, dailyLimit: dailyLimitFor(user) },
    ...(admin ? { admin: true, newSuggestions: await newSuggestionCount() } : {}),
  };
}

/** A doctor's read is kept this long; finishing or starting a case, or changing a setting, ends it at once (bumpMe). */
const ME_TTL_MS = 30_000;
const ME_MAX = 500;
const ME_VERSION_COOKIE = "ramai_me_v";
const kept = new Map<string, { at: number; me: Me; allowed: boolean }>();
/** Bump when what withDerived works out changes, so stored summaries are worked out again. */
const SUMMARY_VERSION = 1;

/**
 * The player's details changed: what's kept is out of date, on every server. (A cookie, because each serverless instance
 * has its own memory.) Route handlers only.
 */
export async function bumpMe() {
  try {
    const { cookies } = await import("next/headers");
    (await cookies()).set(ME_VERSION_COOKIE, Date.now().toString(36), { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 30 * 86_400 });
  } catch {
    // Not in a route handler: the 30 seconds run out soon enough.
  }
}

/**
 * The signed-in player, their progress and today's usage — in one round trip
 * to the database (every page load needs it, so every trip saved counts).
 */
export async function getMe(): Promise<Me | null> {
  const read = await readMe();
  if (read && !read.allowed) {
    const { redirect } = await import("next/navigation");
    redirect("/invite?need=1");
  }
  return read?.me ?? null;
}

/** The same for /api/me, which says "invite" where a page would redirect. */
export async function getMeForApi(): Promise<Me | "invite" | null> {
  const read = await readMe();
  if (!read) return null;
  if (!read.allowed) return "invite";
  // Today's rings are the one thing a page's header doesn't wait for.
  const rings = read.me.rings ?? (read.me.user.isGuest ? undefined : await ringsFor(read.me.user.id).catch(() => undefined));
  if (rings) read.me.rings = rings;
  return read.me;
}

async function readMe(): Promise<{ me: Me; allowed: boolean } | null> {
  const authAt = performance.now();
  const who = await identityQuery();
  const authMs = performance.now() - authAt;
  if (!who) return null;
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const key = `${String(who.args[0])}|${jar.get(ME_VERSION_COOKIE)?.value ?? ""}`;
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < ME_TTL_MS) {
    console.info(`[DB_TIMING] getMe cache=hit supabase_claims=${Math.round(authMs)}ms turso=0ms`);
    return hit;
  }
  const dbAt = performance.now();
  const read = await getMeUnchecked(who);
  const tursoMs = performance.now() - dbAt;
  if (!read) return null;
  const { me, listed } = read;
  const allowAt = performance.now();
  const { accessCookieValue, userAllowed } = await import("./access");
  // Invite-only: a signed-in account nobody invited is sent to enter a code. (What the access lists say came with the same read.)
  const allowed = await userAllowed(me.user as unknown as User, await accessCookieValue(), listed);
  console.info(`[DB_TIMING] getMe cache=miss supabase_claims=${Math.round(authMs)}ms turso=${Math.round(tursoMs)}ms access=${Math.round(performance.now() - allowAt)}ms`);
  const entry = { at: Date.now(), me, allowed };
  if (kept.size >= ME_MAX) kept.delete(kept.keys().next().value!);
  kept.set(key, entry);
  return entry;
}

/** What a doctor's whole history works out to, kept: the history itself is read only when something new has happened. */
async function summaryOf(userId: string, count: number, row: { day?: unknown; n?: unknown; json?: unknown } | undefined): Promise<PlayerProgress> {
  const today = `${SUMMARY_VERSION}:${istDayKey(new Date())}`;
  if (row && row.day === today && Number(row.n) === count && typeof row.json === "string") {
    try {
      return JSON.parse(row.json) as PlayerProgress;
    } catch {}
  }
  const full = await progressFor(userId);
  const progress = { ...full, history: full.history.slice(-HISTORY_SENT) };
  await db.run(
    "INSERT INTO progress_summaries (user_id, day, n, json) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET day = excluded.day, n = excluded.n, json = excluded.json",
    userId, today, count, JSON.stringify(progress),
  ).catch(() => undefined);
  return progress;
}

async function getMeUnchecked(who: NonNullable<Awaited<ReturnType<typeof identityQuery>>>): Promise<{ me: Me; listed?: boolean } | null> {
  const [users, summaries, counts, today, avatars, onList, emailListed] = await db.readMany([
    { sql: who.user, args: who.args },
    { sql: `SELECT day, n, json FROM progress_summaries WHERE user_id = ${who.id}`, args: who.args },
    { sql: `SELECT COUNT(*) AS n FROM results WHERE user_id = ${who.id} AND assisted = 0`, args: who.args },
    { sql: `SELECT COUNT(*) AS n FROM case_starts WHERE user_id = ${who.id} AND created_at >= ? AND tutorial = 0 AND daily_key IS NULL`, args: [...who.args, istDayStart()] },
    { sql: `SELECT style FROM user_avatars WHERE user_id = ${who.id}`, args: who.args },
    { sql: `SELECT 1 AS ok FROM access_users WHERE user_id = ${who.id}`, args: who.args },
    { sql: `SELECT 1 AS ok FROM access_emails WHERE email = (SELECT lower(email) FROM users WHERE id = ${who.id})`, args: who.args },
  ]);
  if (!users?.[0]) {
    // A new account verified somewhere else, without its profile yet: the slower path makes it.
    const user = await getCurrentUser();
    return user ? { me: await meFor(user) } : null;
  }
  const user = userFromRow(users[0]);
  const progress = await summaryOf(user.id, Number(counts?.[0]?.n ?? 0), summaries?.[0]);
  const admin = !user.isGuest && (await isAdmin(user).catch(() => false));
  const avatar = (() => {
    try {
      const raw = avatars?.[0]?.style;
      return typeof raw === "string" ? parseAvatar(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  })();
  return {
    listed: !!onList?.[0] || (!user.isGuest && !!emailListed?.[0]),
    me: {
      user,
      ...(avatar ? { avatar } : {}),
      progress,
      usage: { casesToday: Number(today?.[0]?.n ?? 0), dailyLimit: dailyLimitFor(user) },
      ...(admin ? { admin: true, newSuggestions: await newSuggestionCount() } : {}),
    },
  };
}
