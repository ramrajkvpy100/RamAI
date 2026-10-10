/**
 * Rate limits that hold across every server instance — the counts live in the
 * database. Vercel runs many copies of the app, so in-memory counters alone can
 * be dodged by spreading requests across them.
 */
import "server-only";

import { db } from "./db";

let sweptAt = 0;

/** Counts one attempt for `key`; true when that makes more than `limit` in the current window. */
export async function overLimit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const expired = now - windowMs;
  const row = await db.get<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END
     RETURNING count`,
    key, now, expired, expired,
  );
  if (now - sweptAt > 3_600_000) {
    sweptAt = now;
    void db.run("DELETE FROM rate_limits WHERE window_start < ?", now - 86_400_000).catch(() => undefined);
  }
  return (row?.count ?? 0) > limit;
}

/** Whether `key` has already used up `limit` attempts in the current window (counts nothing). */
export async function exhausted(key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const row = await db.get<{ count: number; window_start: number }>("SELECT count, window_start FROM rate_limits WHERE key = ?", key);
  return !!row && row.window_start > now - windowMs && row.count >= limit;
}

export async function clearLimit(key: string) {
  await db.run("DELETE FROM rate_limits WHERE key = ?", key);
}
