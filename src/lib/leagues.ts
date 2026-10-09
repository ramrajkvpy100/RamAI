/**
 * Weekly leagues — the competitive loop. Every Monday (00:00 IST) players are
 * grouped with up to 30 others in their league. The week's XP decides the
 * table: the top of each group moves up a league, the bottom moves down.
 */

export interface LeagueInfo {
  id: string;
  label: string;
  /** Badge gradient, light → dark. */
  from: string;
  to: string;
  /** Accent for text and rings. */
  accent: string;
}

export const LEAGUES: readonly LeagueInfo[] = [
  { id: "bronze", label: "Bronze", from: "#f3c38f", to: "#9a5b26", accent: "#c27a3a" },
  { id: "silver", label: "Silver", from: "#f1f5f9", to: "#7c8799", accent: "#94a3b8" },
  { id: "gold", label: "Gold", from: "#fde68a", to: "#b7791f", accent: "#e0a316" },
  { id: "sapphire", label: "Sapphire", from: "#bfdbfe", to: "#1d4ed8", accent: "#3b82f6" },
  { id: "ruby", label: "Ruby", from: "#fecdd3", to: "#be123c", accent: "#e11d48" },
  { id: "diamond", label: "Diamond", from: "#e0f2fe", to: "#7c3aed", accent: "#8b5cf6" },
];

export const TOP_TIER = LEAGUES.length - 1;
export const COHORT_SIZE = 30;

export const league = (tier: number): LeagueInfo => LEAGUES[Math.max(0, Math.min(TOP_TIER, tier))]!;

/** How many move up and down in a group of `size`. Small groups still let the winner climb. */
export function zones(size: number, tier: number): { promote: number; demote: number } {
  const promote = tier >= TOP_TIER || size === 0 ? 0 : size >= 10 ? 5 : Math.max(1, Math.floor(size / 3));
  const demote = tier <= 0 ? 0 : size >= 10 ? 5 : size >= 6 ? 1 : 0;
  return { promote, demote };
}

export type LeagueOutcome = "promoted" | "stayed" | "demoted";

export function outcomeFor(position: number, size: number, tier: number): LeagueOutcome {
  const { promote, demote } = zones(size, tier);
  if (position <= promote) return "promoted";
  if (demote > 0 && position > size - demote) return "demoted";
  return "stayed";
}

export const nextTier = (tier: number, outcome: LeagueOutcome) => Math.max(0, Math.min(TOP_TIER, tier + (outcome === "promoted" ? 1 : outcome === "demoted" ? -1 : 0)));
