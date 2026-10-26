import "server-only";

import { db } from "./db";

export interface AnswerStats {
  /** Share of doctors who chose each option, 0–100, keyed by the option's text. */
  pct: Record<string, number>;
  total: number;
  /** Share who got it right, 0–100. */
  correct: number;
}

/** Records this doctor's first answer to a question (later ones don't count), then returns how everyone answered. */
export async function voteAndCount(userId: string, qkey: string, choice: string, correct: boolean, options: string[]): Promise<AnswerStats> {
  await db.run("INSERT OR IGNORE INTO answer_votes (qkey, user_id, choice, correct, created_at) VALUES (?, ?, ?, ?, ?)", qkey, userId, choice, correct ? 1 : 0, Date.now());
  const rows = await db.all<{ choice: string; n: number; c: number }>("SELECT choice, COUNT(*) AS n, SUM(correct) AS c FROM answer_votes WHERE qkey = ? GROUP BY choice", qkey);
  const total = rows.reduce((a, r) => a + Number(r.n), 0);
  const right = rows.reduce((a, r) => a + Number(r.c ?? 0), 0);
  const pct: Record<string, number> = {};
  for (const o of options) pct[o] = 0;
  for (const r of rows) if (r.choice in pct) pct[r.choice] = total ? Math.round((Number(r.n) / total) * 100) : 0;
  return { pct, total, correct: total ? Math.round((right / total) * 100) : 0 };
}
