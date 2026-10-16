/**
 * Duels: two doctors, one patient. The same case (its source) is played by each on their own; the
 * scores are compared. The second player is a friend with the link, whoever is looking for a game,
 * or the computer — an expert's steady score.
 */
import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { CaseSource } from "@/engine/providers/types";

import { db } from "./db";

export type DuelMode = "invite" | "find" | "computer";

/** How long someone looking for a game waits to be matched. */
const OPEN_MS = 30 * 60_000;

interface Row {
  id: string;
  src: string;
  mode: DuelMode;
  host_id: string;
  host_name: string;
  host_score: number | null;
  guest_id: string | null;
  guest_name: string | null;
  guest_score: number | null;
  created_at: number;
}

export const newDuelId = () => randomUUID().replace(/-/g, "").slice(0, 12);

export async function createDuel(id: string, mode: DuelMode, host: { id: string; name: string }, src: CaseSource): Promise<void> {
  await db.run("INSERT INTO duels (id, src, mode, host_id, host_name, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, JSON.stringify(src), mode, host.id, host.name, Date.now());
}

/** Joins a duel as its second player; the case to play, or null when it can't be joined. */
export async function joinDuel(id: string, guest: { id: string; name: string }): Promise<CaseSource | null> {
  const row = await db.get<Row>("SELECT * FROM duels WHERE id = ?", id);
  if (!row || row.mode === "computer") return null;
  if (row.host_id !== guest.id) {
    if (row.guest_id && row.guest_id !== guest.id) return null;
    if (!row.guest_id) {
      const took = await db.run("UPDATE duels SET guest_id = ?, guest_name = ? WHERE id = ? AND guest_id IS NULL", guest.id, guest.name, id);
      if (took.changes !== 1) return null;
    }
  }
  return JSON.parse(row.src) as CaseSource;
}

/** Someone else's open "find an opponent" game from the last half hour, taken — or null. */
export async function findOpenDuel(guest: { id: string; name: string }): Promise<{ id: string; src: CaseSource } | null> {
  const rows = await db.all<Row>("SELECT * FROM duels WHERE mode = 'find' AND guest_id IS NULL AND host_id != ? AND created_at > ? ORDER BY created_at ASC LIMIT 3", guest.id, Date.now() - OPEN_MS);
  for (const row of rows) {
    const took = await db.run("UPDATE duels SET guest_id = ?, guest_name = ? WHERE id = ? AND guest_id IS NULL", guest.id, guest.name, row.id);
    if (took.changes === 1) return { id: row.id, src: JSON.parse(row.src) as CaseSource };
  }
  return null;
}

export async function recordDuelScore(id: string, userId: string, score: number): Promise<void> {
  await db.run("UPDATE duels SET host_score = ? WHERE id = ? AND host_id = ? AND host_score IS NULL", score, id, userId);
  await db.run("UPDATE duels SET guest_score = ? WHERE id = ? AND guest_id = ? AND guest_score IS NULL", score, id, userId);
}

/** The computer's score for a case: an expert's, steady but not perfect (68–92). */
const computerScore = (id: string) => 68 + (createHash("sha256").update(`duel:${id}`).digest()[0]! % 25);

export interface DuelView {
  id: string;
  mode: DuelMode;
  you: { name: string; score: number | null };
  them: { name: string; score: number | null; computer?: boolean } | null;
  /** Waiting for an opponent to join. */
  waiting: boolean;
}

export async function duelView(id: string, userId: string): Promise<DuelView | null> {
  const row = await db.get<Row>("SELECT * FROM duels WHERE id = ?", id);
  if (!row || (row.host_id !== userId && row.guest_id !== userId)) return null;
  const host = row.host_id === userId;
  const you = host ? { name: row.host_name, score: row.host_score } : { name: row.guest_name ?? "You", score: row.guest_score };
  if (row.mode === "computer") return { id, mode: row.mode, you, them: { name: "RamAI computer", score: you.score === null ? null : computerScore(id), computer: true }, waiting: false };
  const them = host ? (row.guest_id ? { name: row.guest_name ?? "Opponent", score: row.guest_score } : null) : { name: row.host_name, score: row.host_score };
  return { id, mode: row.mode, you, them, waiting: !them };
}

/** What an invite link shows before joining: who's asking. */
export async function duelInvite(id: string): Promise<{ host: string; open: boolean } | null> {
  const row = await db.get<Row>("SELECT * FROM duels WHERE id = ?", id);
  if (!row || row.mode === "computer") return null;
  return { host: row.host_name, open: !row.guest_id };
}
