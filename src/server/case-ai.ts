import "server-only";

import { db } from "./db";

/**
 * What the AI made for one case while it was being played — its pictures and
 * its teaching notes — kept with the session (for 30 days), so a reopened
 * case shows the same pictures and nothing is paid for twice.
 */
export async function getCaseAI(sessionId: string, key: string): Promise<{ mime: string; data: string } | undefined> {
  return db.get<{ mime: string; data: string }>("SELECT mime, data FROM case_ai WHERE session_id = ? AND key = ?", sessionId, key);
}

export async function putCaseAI(sessionId: string, key: string, userId: string, mime: string, data: string) {
  await db.run("INSERT OR REPLACE INTO case_ai (session_id, key, user_id, mime, data, created_at) VALUES (?, ?, ?, ?, ?, ?)", sessionId, key, userId, mime, data, Date.now());
}

/** How many pictures this case has had drawn. */
export async function picturesDrawn(sessionId: string): Promise<number> {
  return (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM case_ai WHERE session_id = ? AND key LIKE 'img:%'", sessionId))?.n ?? 0;
}
