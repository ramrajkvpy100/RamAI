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

export type Level = "easy" | "medium" | "hard";
export const LEVELS: { id: Level; label: string }[] = [{ id: "easy", label: "Easy" }, { id: "medium", label: "Medium" }, { id: "hard", label: "Hard" }];

/** Image Rush at each level: the clock, what an answer does to it, the points, and how many choices. */
export const RUSH_LEVELS: Record<Level, { startMs: number; rightMs: number; wrongMs: number; points: number; options: number; line: string }> = {
  easy: { startMs: 75_000, rightMs: 3_000, wrongMs: 2_000, points: 50, options: 2, line: "2 choices. 75 seconds, +3 s right, −2 s wrong." },
  medium: { startMs: 60_000, rightMs: 2_000, wrongMs: 3_000, points: 100, options: 4, line: "4 choices. 60 seconds, +2 s right, −3 s wrong." },
  hard: { startMs: 45_000, rightMs: 1_000, wrongMs: 5_000, points: 150, options: 4, line: "4 choices. 45 seconds, +1 s right, −5 s wrong." },
};

/** Clusters at each level. */
export const CLUSTER_LEVELS: Record<Level, { mistakes: number; hints: number; names: boolean; oneAway: boolean; scale: number; line: string }> = {
  easy: { mistakes: 6, hints: 0, names: true, oneAway: true, scale: 0.5, line: "The 4 group names are shown. 6 mistakes allowed." },
  medium: { mistakes: 4, hints: 1, names: false, oneAway: true, scale: 1, line: "Names hidden, with 1 hint. 4 mistakes allowed." },
  hard: { mistakes: 3, hints: 0, names: false, oneAway: false, scale: 1.5, line: "No names, no hints, no \"one away\". 3 mistakes." },
};

/** Case Detective at each level. */
export const DETECTIVE_LEVELS: Record<Level, { options: number; guesses: number; scale: number; line: string }> = {
  easy: { options: 4, guesses: 3, scale: 0.5, line: "4 diagnoses to choose from. A wrong guess costs a clue, not the case." },
  medium: { options: 6, guesses: 2, scale: 1, line: "6 diagnoses. One second chance." },
  hard: { options: 6, guesses: 1, scale: 1.5, line: "6 diagnoses. One guess only, for 1.5× the points." },
};

const LEVEL_KEY = "ramai.games.level";
export function savedLevel(game: GameId): Level {
  try {
    const l = (JSON.parse(localStorage.getItem(LEVEL_KEY) ?? "{}") as Partial<Record<GameId, Level>>)[game];
    return l ?? "medium";
  } catch {
    return "medium";
  }
}
export function saveLevel(game: GameId, level: Level) {
  try {
    localStorage.setItem(LEVEL_KEY, JSON.stringify({ ...(JSON.parse(localStorage.getItem(LEVEL_KEY) ?? "{}") as object), [game]: level }));
  } catch {}
}
