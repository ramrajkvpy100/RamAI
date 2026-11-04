/** Scores from the quick games: XP and personal bests only. The clinical rating comes from full cases alone. */
import "server-only";

import { GAME_XP_CAP, type GameId, type GameStats } from "@/lib/games/score";

import { db } from "./db";

export async function recordGame(userId: string, game: GameId, score: number, xp: number) {
  await db.run("INSERT INTO game_scores (user_id, game, score, xp, created_at) VALUES (?, ?, ?, ?, ?)", userId, game, Math.max(0, Math.round(score)), Math.min(GAME_XP_CAP[game], Math.max(0, Math.round(xp))), Date.now());
}

export async function gameStats(userId: string): Promise<GameStats> {
  const rows = await db.all<{ game: GameId; best: number; xp: number; plays: number }>("SELECT game, MAX(score) AS best, SUM(xp) AS xp, COUNT(*) AS plays FROM game_scores WHERE user_id = ? GROUP BY game", userId);
  return { xp: rows.reduce((n, r) => n + Number(r.xp), 0), best: Object.fromEntries(rows.map((r) => [r.game, Number(r.best)])) };
}
