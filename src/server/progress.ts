/** A player's history and derived progress (XP, rank, streak, badges), from recorded results. */
import "server-only";

import { withDerived } from "@/engine/progression";
import type { CareLevel, CaseTrack, CompletedCaseSummary, DiagnosisVerdict, PlayerProgress, Specialty } from "@/engine/types";

import { getDb } from "./db";

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

export function historyFor(userId: string): CompletedCaseSummary[] {
  const rows = getDb().prepare("SELECT * FROM results WHERE user_id = ? ORDER BY created_at ASC").all(userId) as unknown as ResultRow[];
  return rows.map(toSummary);
}

export function progressFor(userId: string): PlayerProgress {
  return withDerived(historyFor(userId));
}
