/**
 * The daily case: the same patient for everyone, every day — and the
 * spoiler-free result card players share. Isomorphic.
 */
import type { CaseScore, ScoreCategory } from "@/engine/types";

/** Daily #1. */
export const DAILY_EPOCH = "2026-10-10";
const DAY = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

/** Today in India — when the daily case changes for everyone. */
export const dailyKeyFor = (now = Date.now()) => new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);

export const dailyNumber = (dayKey: string) => Math.round((Date.parse(`${dayKey}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`)) / DAY) + 1;

/** When the next daily case unlocks (midnight IST), epoch ms. */
export const dailyEndsAt = (dayKey: string) => Date.parse(`${dayKey}T00:00:00+05:30`) + DAY;

/** The card's two rows: how the case was worked up, then how it was handled. */
const GRID: ScoreCategory[][] = [
  ["history", "examination", "differential", "investigationSelection", "investigationInterpretation"],
  ["treatment", "drugSafety", "reassessment", "efficiency", "outcome"],
];

export function squares(score: Pick<CaseScore, "lines">): string {
  const by = new Map(score.lines.map((l) => [l.category, l]));
  return GRID.map((row) =>
    row
      .map((c) => {
        const l = by.get(c);
        if (!l || l.max <= 0) return "⬜";
        const p = l.earned / l.max;
        return p >= 0.8 ? "🟩" : p >= 0.5 ? "🟨" : "🟥";
      })
      .join(""),
  ).join("\n");
}

/** Shareable without spoilers: the score, the squares and the time — never the diagnosis. */
export function shareText(o: { number: number; score: Pick<CaseScore, "lines" | "percent">; minutes: number; url: string }): string {
  return [`RamAI Daily #${o.number} — ${Math.round(o.score.percent)}/100`, squares(o.score), `⏱ ${Math.round(o.minutes)} min · Can you beat me?`, o.url].join("\n");
}

/** The same card from saved squares (the Home card, later in the day). */
export function shareFromGrid(o: { number: number; score: number; grid: string; minutes: number; url: string }): string {
  return [`RamAI Daily #${o.number} — ${Math.round(o.score)}/100`, o.grid, `⏱ ${Math.round(o.minutes)} min · Can you beat me?`, o.url].join("\n");
}

/** The phone's share sheet where there is one; otherwise the clipboard. */
export async function shareResult(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
