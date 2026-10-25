/** A player's history and derived progress (XP, rank, streak, badges), from recorded results. */
import "server-only";

import { withDerived } from "@/engine/progression";
import type { CareLevel, CaseTrack, CompletedCaseSummary, DiagnosisVerdict, PlayerProgress, Specialty } from "@/engine/types";

import { db } from "./db";

interface ResultRow {
  case_ref: string;
  case_number: number;
  specialty: string;
  track: string;
  level: string;
  diagnosis: string;
  verdict: string | null;
  rescued: number;
  score: number;
  xp: number;
  created_at: number;
}

const toSummary = (r: ResultRow): CompletedCaseSummary => ({
  caseId: r.case_ref,
  caseNumber: r.case_number,
  specialty: r.specialty as Specialty,
  track: r.track as CaseTrack,
  level: r.level as CareLevel,
  diagnosis: r.diagnosis,
  verdict: (r.verdict ?? undefined) as DiagnosisVerdict | undefined,
  rescued: r.rescued === 1,
  score: r.score,
  xp: r.xp,
  completedISO: new Date(r.created_at).toISOString(),
});

export const summaryFromRow = (row: Record<string, unknown>): CompletedCaseSummary => toSummary(row as unknown as ResultRow);

export async function historyFor(userId: string): Promise<CompletedCaseSummary[]> {
  return (await db.all<ResultRow>("SELECT * FROM results WHERE user_id = ? ORDER BY created_at ASC", userId)).map(toSummary);
}

export async function progressFor(userId: string): Promise<PlayerProgress> {
  return withDerived(await historyFor(userId));
}

/** Progress for many players with one query — leaderboards and league tables. */
export async function progressForMany(userIds: readonly string[]): Promise<Map<string, PlayerProgress>> {
  const ids = [...new Set(userIds)];
  const byUser = new Map<string, CompletedCaseSummary[]>(ids.map((id) => [id, []]));
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const rows = await db.all<ResultRow & { user_id: string }>(`SELECT * FROM results WHERE user_id IN (${chunk.map(() => "?").join(", ")}) ORDER BY created_at ASC`, ...chunk);
    for (const r of rows) byUser.get(r.user_id)?.push(toSummary(r));
  }
  return new Map([...byUser].map(([id, history]) => [id, withDerived(history)]));
}

/** Today's three competence rings, 0–1 each: how well, and how much (two good cases close a ring). */
export interface Rings {
  triage: number;
  diagnosis: number;
  treatment: number;
  cases: number;
}
const RING_OF: Record<string, keyof Omit<Rings, "cases">> = {
  history: "triage", examination: "triage", reassessment: "triage", efficiency: "triage",
  differential: "diagnosis", investigationSelection: "diagnosis", investigationInterpretation: "diagnosis",
  treatment: "treatment", drugSafety: "treatment", outcome: "treatment",
};
export async function ringsFor(userId: string, now = new Date()): Promise<Rings> {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  const start = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3_600_000;
  const rows = await db.all<{ detail: string | null }>("SELECT detail FROM results WHERE user_id = ? AND created_at >= ?", userId, start).catch(() => []);
  const sum = { triage: [0, 0], diagnosis: [0, 0], treatment: [0, 0] } as Record<keyof Omit<Rings, "cases">, [number, number]>;
  for (const r of rows) {
    try {
      for (const [cat, earned, max] of (JSON.parse(r.detail ?? "{}") as { l?: [string, number, number][] }).l ?? []) {
        const ring = RING_OF[cat];
        if (ring && max > 0) {
          sum[ring][0] += earned;
          sum[ring][1] += max;
        }
      }
    } catch {}
  }
  const amount = Math.min(1, rows.length / 2);
  const of = (k: keyof typeof sum) => (sum[k][1] ? Math.round((sum[k][0] / sum[k][1]) * amount * 100) / 100 : 0);
  return { triage: of("triage"), diagnosis: of("diagnosis"), treatment: of("treatment"), cases: rows.length };
}
