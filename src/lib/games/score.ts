/** Personal bests and XP from the quick games: kept on this device, and on the account when signed in. XP never moves the clinical rating. */

export type GameId = "rush" | "synapses" | "probe";
export interface GameStats {
  xp: number;
  best: Partial<Record<GameId, number>>;
}

/** The most one game can earn. */
export const GAME_XP_CAP: Record<GameId, number> = { rush: 50, synapses: 40, probe: 20 };
export const xpFor = (game: GameId, score: number) => Math.min(GAME_XP_CAP[game], Math.floor(score / (game === "rush" ? 200 : game === "synapses" ? 25 : 25)));

const KEY = "ramai.games.v1";
export function localStats(): GameStats {
  try {
    return { xp: 0, best: {}, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<GameStats>) };
  } catch {
    return { xp: 0, best: {} };
  }
}

/** A finished game. Returns the XP earned and whether it's a new best. */
export function finishGame(game: GameId, score: number): { xp: number; best: number; isBest: boolean } {
  const s = localStats();
  const xp = xpFor(game, score);
  const before = s.best[game] ?? 0;
  const isBest = score > before;
  const next: GameStats = { xp: s.xp + xp, best: { ...s.best, [game]: Math.max(before, score) } };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  void fetch("/api/games/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, score, xp }) }).catch(() => undefined);
  return { xp, best: next.best[game] ?? score, isBest };
}

/** Image Rush's combo: the streak that earns each multiplier. */
export function comboMultiplier(streak: number): number {
  return streak >= 10 ? 5 : streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
}
export const RUSH_START_MS = 60_000;
export const RUSH_RIGHT_MS = 2_000;
export const RUSH_WRONG_MS = 3_000;
