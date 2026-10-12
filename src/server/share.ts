/**
 * Sharing: a result or a doctor's progress, as a picture for WhatsApp Status,
 * Instagram and the rest, behind a link that can't be guessed or forged — its
 * id is signed with the server's own key. What a card shows comes from the
 * database, never from the link.
 */
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { levelMeta, trackLabel } from "@/engine/levels";
import { rankFor } from "@/engine/progression";
import { deriveSecret } from "@/engine/session";
import type { CareLevel, CaseTrack } from "@/engine/types";
import { isCountry, type Country } from "@/engine/countries";
import { dailyNumber } from "@/lib/daily";

import { db } from "./db";
import { progressFor } from "./progress";

type Kind = "r" | "u";

/** 16 characters of an HMAC with a key derived from the server's own secret. */
const sign = (kind: Kind, value: string) => createHmac("sha256", deriveSecret("ramai/share/v1")).update(`${kind}:${value}`).digest("base64url").slice(0, 16);

/** "r123.sig" for result 123; "u<uuid>.sig" for a doctor's progress. */
export const shareIdFor = (kind: Kind, value: string | number) => `${kind}${value}.${sign(kind, String(value))}`;

export function readShareId(id: string): { kind: Kind; value: string } | null {
  const m = id.match(/^([ru])([A-Za-z0-9-]{1,64})\.([A-Za-z0-9_-]{16})$/);
  if (!m) return null;
  const [, kind, value, sig] = m as unknown as [string, Kind, string, string];
  const expected = Buffer.from(sign(kind, value));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { kind, value } : null;
}

/** What a shared name looks like: "Dr. Asha" — first name only; guests stay anonymous. */
const shownName = (name: string, guest: boolean) => (guest ? "A RamAI doctor" : `Dr. ${(name.replace(/^dr\.?\s+/i, "").split(/\s+/)[0] ?? "").slice(0, 24) || "RamAI"}`);

export interface ResultCard {
  kind: "result";
  /** The doctor's case number — the card's serial. */
  caseNumber: number;
  name: string;
  score: number;
  xp: number;
  verdict: string | null;
  /** Hidden for the daily case — everyone plays the same patient that day. */
  diagnosis: string | null;
  daily: { number: number; grid: string | null } | null;
  specialty: string;
  level: string;
  mode: string;
  minutes: number | null;
  rank: string;
  streak: number;
}

export interface ProgressCard {
  kind: "progress";
  name: string;
  rank: string;
  tier: number;
  xp: number;
  cases: number;
  average: number;
  bestStreak: number;
  streak: number;
  badges: string[];
  specialties: { name: string; percent: number }[];
}

export async function resultCard(resultId: number): Promise<ResultCard | null> {
  const r = await db.get<{ user_id: string; case_number: number; specialty: string; track: string; level: string; diagnosis: string; verdict: string | null; score: number; xp: number; daily_key: string | null; elapsed_min: number | null; grid: string | null; name: string; is_guest: number; country: string }>(
    `SELECT r.user_id, r.case_number, r.specialty, r.track, r.level, r.diagnosis, r.verdict, r.score, r.xp, r.daily_key, r.elapsed_min, r.grid, u.name, u.is_guest, u.country
     FROM results r JOIN users u ON u.id = r.user_id WHERE r.id = ?`,
    resultId,
  );
  if (!r) return null;
  const country: Country = isCountry(r.country) ? r.country : "IN";
  const progress = await progressFor(r.user_id);
  return {
    kind: "result",
    caseNumber: r.case_number,
    name: shownName(r.name, r.is_guest === 1),
    score: r.score,
    xp: r.xp,
    verdict: r.verdict,
    diagnosis: r.daily_key ? null : r.diagnosis,
    daily: r.daily_key ? { number: dailyNumber(r.daily_key), grid: r.grid } : null,
    specialty: r.specialty,
    level: levelMeta(r.level as CareLevel, country).label,
    mode: trackLabel(r.track as CaseTrack, country),
    minutes: r.elapsed_min,
    rank: rankFor(progress.percent).label,
    streak: progress.streakDays,
  };
}

export async function progressCard(userId: string): Promise<ProgressCard | null> {
  const u = await db.get<{ name: string; is_guest: number }>("SELECT name, is_guest FROM users WHERE id = ?", userId);
  if (!u) return null;
  const p = await progressFor(userId);
  const rank = rankFor(p.percent);
  const recent = p.history.slice(-20);
  return {
    kind: "progress",
    name: shownName(u.name, u.is_guest === 1),
    rank: rank.label,
    tier: rank.tier,
    xp: p.xp,
    cases: p.casesCompleted,
    average: recent.length ? Math.round(recent.reduce((s, h) => s + h.score, 0) / recent.length) : 0,
    bestStreak: p.bestStreak,
    streak: p.streakDays,
    badges: p.badges.map((b) => b.label).slice(0, 6),
    specialties: p.mastery
      .filter((m) => m.cases > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3)
      .map((m) => ({ name: m.specialty, percent: m.percent })),
  };
}

/** The doctor's own result for a case they played — the only one they can share. */
export async function ownResultId(userId: string, sessionId: string): Promise<number | null> {
  return (await db.get<{ id: number }>("SELECT id FROM results WHERE user_id = ? AND session_id = ?", userId, sessionId))?.id ?? null;
}
