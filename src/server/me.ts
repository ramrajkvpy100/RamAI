import "server-only";

import { withDerived } from "@/engine/progression";
import type { Me } from "@/lib/me-store";
import { dailyLimitFor } from "@/lib/plans";

import { getCurrentUser, identityQuery, userFromRow, type User } from "./auth";
import { db } from "./db";
import { summaryFromRow } from "./progress";
import { casesStartedToday, istDayStart, progressFor } from "./results";
import { isAdmin, newSuggestionCount } from "./suggestions";

/** Recent history sent to the browser — progress itself is computed from all of it. */
const HISTORY_SENT = 30;

import { parseAvatar } from "@/lib/avatar-style";

export async function meFor(user: User): Promise<Me> {
  const [progress, casesToday, admin, avatar] = await Promise.all([
    progressFor(user.id),
    casesStartedToday(user.id),
    user.isGuest ? false : isAdmin(user).catch(() => false),
    db.get<{ style: string }>("SELECT style FROM user_avatars WHERE user_id = ?", user.id).then((r) => (r ? parseAvatar(JSON.parse(r.style)) : null)).catch(() => null),
  ]);
  return {
    user,
    ...(avatar ? { avatar } : {}),
    progress: { ...progress, history: progress.history.slice(-HISTORY_SENT) },
    usage: { casesToday, dailyLimit: dailyLimitFor(user) },
    ...(admin ? { admin: true, newSuggestions: await newSuggestionCount() } : {}),
  };
}

/**
 * The signed-in player, their progress and today's usage — in one round trip
 * to the database (every page load needs it, so every trip saved counts).
 */
export async function getMe(): Promise<Me | null> {
  const me = await getMeUnchecked();
  // Invite-only: a signed-in account nobody invited is sent to enter a code.
  if (me) {
    const { accessCookieValue, userAllowed } = await import("./access");
    if (!(await userAllowed(me.user as unknown as User, await accessCookieValue()))) {
      const { redirect } = await import("next/navigation");
      redirect("/invite?need=1");
    }
  }
  return me;
}

async function getMeUnchecked(): Promise<Me | null> {
  const who = await identityQuery();
  if (!who) return null;
  const [users, results, today, avatars] = await db.readMany([
    { sql: who.user, args: who.args },
    { sql: `SELECT * FROM results WHERE user_id = ${who.id} ORDER BY created_at ASC`, args: who.args },
    { sql: `SELECT COUNT(*) AS n FROM case_starts WHERE user_id = ${who.id} AND created_at >= ? AND tutorial = 0 AND daily_key IS NULL`, args: [...who.args, istDayStart()] },
    { sql: `SELECT style FROM user_avatars WHERE user_id = ${who.id}`, args: who.args },
  ]);
  if (!users?.[0]) {
    // A new account verified somewhere else, without its profile yet: the slower path makes it.
    const user = await getCurrentUser();
    return user ? meFor(user) : null;
  }
  const user = userFromRow(users[0]);
  const progress = withDerived((results ?? []).map(summaryFromRow));
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
    user,
    ...(avatar ? { avatar } : {}),
    progress: { ...progress, history: progress.history.slice(-HISTORY_SENT) },
    usage: { casesToday: Number(today?.[0]?.n ?? 0), dailyLimit: dailyLimitFor(user) },
    ...(admin ? { admin: true, newSuggestions: await newSuggestionCount() } : {}),
  };
}
