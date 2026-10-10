/**
 * Daily reminders: the browsers that asked for them, and the evening nudge
 * for players who haven't played yet that day (India time, like streaks).
 */
import "server-only";

import { createECDH } from "node:crypto";

import { istDayKey } from "@/engine/progression";
import { dailyEndsAt, dailyKeyFor, dailyNumber } from "@/lib/daily";

import { db } from "./db";
import { progressForMany } from "./progress";
import { isPushEndpoint, sendPush, type PushMessage, type PushTarget } from "./push";

/** Browsers per player; the longest-unseen make way. */
const MAX_DEVICES = 10;
/** A browser whose push service keeps refusing is forgotten after this many evenings. */
const MAX_FAILURES = 5;
/** Reminders only go out in the evening, India time, whoever triggers the job. */
const WINDOW_HOURS_IST = { from: 17, to: 23 };
const IST_OFFSET_MS = 330 * 60_000;

/** Why a subscription can't be stored, or null when it's sound. */
export function subscriptionProblem(sub: PushTarget): string | null {
  if (!isPushEndpoint(sub.endpoint)) return "That browser's push service isn't supported.";
  const key = Buffer.from(sub.p256dh, "base64url");
  if (key.length !== 65 || key[0] !== 4 || Buffer.from(sub.auth, "base64url").length !== 16) return "Invalid subscription.";
  try {
    // A point that isn't on the curve can never be encrypted to.
    const probe = createECDH("prime256v1");
    probe.generateKeys();
    probe.computeSecret(key);
  } catch {
    return "Invalid subscription.";
  }
  return null;
}

/** Stores (or refreshes) this browser's subscription for the player. A browser belongs to whoever subscribed last. */
export async function saveSubscription(userId: string, sub: PushTarget, now = Date.now()) {
  await db.batch([
    {
      sql: `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, seen_at, failures) VALUES (?, ?, ?, ?, ?, 0)
            ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, seen_at = excluded.seen_at, failures = 0`,
      args: [sub.endpoint, userId, sub.p256dh, sub.auth, now],
    },
    {
      sql: `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint NOT IN (SELECT endpoint FROM push_subscriptions WHERE user_id = ? ORDER BY seen_at DESC LIMIT ${MAX_DEVICES})`,
      args: [userId, userId],
    },
  ]);
}

export async function removeSubscription(userId: string, endpoint: string) {
  await db.run("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?", endpoint, userId);
}

/** The words: a streak about to break comes first. Never anything about the case itself. */
export function reminderFor(streakDays: number, dayKey: string, now: number): PushMessage {
  const hours = Math.max(1, Math.round((dailyEndsAt(dayKey) - now) / 3_600_000));
  const daily = `Daily case #${dailyNumber(dayKey)}`;
  if (streakDays > 0) {
    return {
      title: `🔥 Your ${streakDays}-day streak ends in ${hours} ${hours === 1 ? "hour" : "hours"}`,
      body: `One case keeps it alive. ${daily} is waiting — the same patient for every doctor today.`,
      url: "/",
    };
  }
  return { title: `🩺 ${daily} is waiting`, body: "The same patient for every doctor today. Crack it and see where you rank.", url: "/" };
}

export interface ReminderRun {
  day: string;
  skipped?: string;
  due: number;
  played: number;
  sent: number;
  gone: number;
  failed: number;
}

/**
 * Sends today's reminders, at most one per browser per day. Each browser is
 * claimed before sending, so overlapping runs can't double up.
 */
export async function sendDailyReminders(opts: { now?: number; send?: typeof sendPush } = {}): Promise<ReminderRun> {
  const now = opts.now ?? Date.now();
  const send = opts.send ?? sendPush;
  const day = dailyKeyFor(now);
  const run: ReminderRun = { day, due: 0, played: 0, sent: 0, gone: 0, failed: 0 };
  const hour = new Date(now + IST_OFFSET_MS).getUTCHours();
  if (hour < WINDOW_HOURS_IST.from || hour >= WINDOW_HOURS_IST.to) return { ...run, skipped: "Reminders go out between 5 pm and 11 pm India time." };

  const claimed = await db.all<PushTarget & { user_id: string }>(
    `UPDATE push_subscriptions SET last_sent_day = ?
     WHERE (last_sent_day IS NULL OR last_sent_day != ?) AND user_id IN (SELECT id FROM users WHERE is_guest = 0)
     RETURNING endpoint, p256dh, auth, user_id`,
    day,
    day,
  );
  run.due = claimed.length;
  if (!claimed.length) return run;

  const progress = await progressForMany(claimed.map((c) => c.user_id));
  const playedToday = (userId: string) => progress.get(userId)?.history.some((h) => istDayKey(new Date(h.completedISO)) === day) ?? false;
  const targets = claimed.filter((c) => !playedToday(c.user_id));
  run.played = claimed.length - targets.length;
  // Until the day ends: after midnight IST the reminder is stale, so the push service may drop it.
  const ttl = Math.floor((dailyEndsAt(day) - now) / 1000);

  const outcomes: { endpoint: string; outcome: Awaited<ReturnType<typeof sendPush>> }[] = [];
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const t = targets[next++]!;
      outcomes.push({ endpoint: t.endpoint, outcome: await send(t, reminderFor(progress.get(t.user_id)?.streakDays ?? 0, day, now), ttl) });
    }
  };
  await Promise.all(Array.from({ length: Math.min(16, targets.length) }, worker));

  const statements: { sql: string; args: (string | number)[] }[] = [];
  for (const { endpoint, outcome } of outcomes) {
    run[outcome === "sent" ? "sent" : outcome === "gone" ? "gone" : "failed"] += 1;
    if (outcome === "gone") statements.push({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [endpoint] });
    else statements.push({ sql: `UPDATE push_subscriptions SET failures = ${outcome === "sent" ? "0" : "failures + 1"} WHERE endpoint = ?`, args: [endpoint] });
  }
  statements.push({ sql: "DELETE FROM push_subscriptions WHERE failures >= ?", args: [MAX_FAILURES] });
  await db.batch(statements);
  return run;
}
