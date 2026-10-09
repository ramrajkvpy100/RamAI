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
