/**
 * Patients invented ahead of time. Inventing a patient takes the model half a
 * minute; while the doctor plays one case, the next is written in the
 * background and kept here, so "Next case" starts at once.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type { Country } from "@/engine/countries";
import { getProvider } from "@/engine/providers";
import type { CaseSource, StartOptions } from "@/engine/providers/types";
import type { CareLevel, CaseTrack, PatientLang, Specialty } from "@/engine/types";

import { db } from "./db";

/** A ready patient keeps for this long (cases improve; a stale one is replaced). */
const KEEP_MS = 6 * 3_600_000;
/** One being written is given this long before it's assumed lost. */
const WRITING_MS = 3 * 60_000;

export interface PoolChoice {
  specialty?: Specialty;
  track?: CaseTrack;
  level?: CareLevel;
  easy?: boolean;
  country: Country;
  lang: PatientLang;
}

/** Ready patients are matched on everything that shapes the case. */
export const poolKey = (c: PoolChoice) => [c.specialty ?? "any", c.track ?? "any", c.level ?? "any", c.easy ? "easy" : "std", c.country, c.lang].join("|");

/** A ready patient for this choice, taken out of the pool — or null. */
export async function takeReady(userId: string, choice: PoolChoice): Promise<CaseSource | null> {
  const row = await db.get<{ id: string; src: string }>(
    "SELECT id, src FROM case_pool WHERE user_id = ? AND pool_key = ? AND src != '' AND created_at > ? ORDER BY created_at ASC LIMIT 1",
    userId, poolKey(choice), Date.now() - KEEP_MS,
  );
  if (!row) return null;
  // Taken once: if two starts race, only the one that deletes it gets it.
  const taken = await db.run("DELETE FROM case_pool WHERE id = ?", row.id);
  if (taken.changes !== 1) return null;
  try {
    return JSON.parse(row.src) as CaseSource;
  } catch {
    return null;
  }
}

/**
 * Writes the next patient for this choice, unless one is waiting or already
 * being written. Only invented patients are kept — a written case starts at once anyway.
 */
export async function prepareNext(userId: string, choice: PoolChoice, opts: Omit<StartOptions, "specialty" | "track" | "level" | "easy" | "country">): Promise<"ready" | "writing" | "written" | "skipped"> {
  const provider = await getProvider();
  if (provider.id === "mock") return "skipped";
  // A banked patient they haven't met will do: nothing to invent (or pay for).
  if (await bankHas(userId, choice).catch(() => false)) return "skipped";
  const key = poolKey(choice);
  const now = Date.now();
  await db.run("DELETE FROM case_pool WHERE user_id = ? AND (created_at <= ? OR (src = '' AND created_at <= ?))", userId, now - KEEP_MS, now - WRITING_MS);
  const there = await db.get<{ src: string }>("SELECT src FROM case_pool WHERE user_id = ? AND pool_key = ? LIMIT 1", userId, key);
  if (there) return there.src ? "ready" : "writing";
  // Marked as being written, so a second request doesn't write another.
  const id = randomUUID();
  await db.run("INSERT INTO case_pool (id, user_id, pool_key, src, created_at) VALUES (?, ?, ?, '', ?)", id, userId, key, now);
  try {
    const src = await provider.createCase({ ...opts, specialty: choice.specialty, track: choice.track, level: choice.level, easy: choice.easy, country: choice.country });
    if (src.kind !== "generated") {
      await db.run("DELETE FROM case_pool WHERE id = ?", id);
      return "skipped";
    }
    await db.run("UPDATE case_pool SET src = ?, created_at = ? WHERE id = ?", JSON.stringify(src), Date.now(), id);
    return "written";
  } catch (err) {
    await db.run("DELETE FROM case_pool WHERE id = ?", id).catch(() => undefined);
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* The case bank: invented once, met by many                                   */
/* -------------------------------------------------------------------------- */

/** Where a bank case fits: what it was invented as (the model's own pick where the doctor said "any"). */
export interface BankFit {
  specialty?: Specialty;
  track: CaseTrack;
  level: CareLevel;
  easy: boolean;
  country: Country;
  lang: PatientLang;
}

/** A banked patient this doctor hasn't met that fits their choice — taken for them — or null. */
export async function takeFromBank(userId: string, choice: PoolChoice): Promise<CaseSource | null> {
  const where = ["country = ?", "lang = ?", "easy = ?", "id NOT IN (SELECT bank_id FROM case_bank_seen WHERE user_id = ?)"];
  const args: (string | number)[] = [choice.country, choice.lang, choice.easy ? 1 : 0, userId];
  if (choice.specialty) (where.push("specialty = ?"), args.push(choice.specialty));
  if (choice.track) (where.push("track = ?"), args.push(choice.track));
  if (choice.level) (where.push("level = ?"), args.push(choice.level));
  const row = await db.get<{ id: string; src: string }>(`SELECT id, src FROM case_bank WHERE ${where.join(" AND ")} ORDER BY random() LIMIT 1`, ...args);
  if (!row) return null;
  await db.run("INSERT OR IGNORE INTO case_bank_seen (user_id, bank_id) VALUES (?, ?)", userId, row.id);
  try {
    return JSON.parse(row.src) as CaseSource;
  } catch {
    return null;
  }
}

/** Keeps a newly invented patient for others — and marks it met by the doctor who had it first. */
export async function bankCase(userId: string, src: CaseSource, fit: BankFit): Promise<void> {
  if (src.kind !== "generated") return;
  const id = randomUUID();
  await db.run(
    "INSERT INTO case_bank (id, specialty, track, level, easy, country, lang, src, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, fit.specialty ?? null, fit.track, fit.level, fit.easy ? 1 : 0, fit.country, fit.lang, JSON.stringify(src), Date.now(),
  );
  await db.run("INSERT OR IGNORE INTO case_bank_seen (user_id, bank_id) VALUES (?, ?)", userId, id);
}

/** Whether the bank already has a patient this doctor hasn't met for this choice (so none need be invented). */
export async function bankHas(userId: string, choice: PoolChoice): Promise<boolean> {
  const where = ["country = ?", "lang = ?", "easy = ?", "id NOT IN (SELECT bank_id FROM case_bank_seen WHERE user_id = ?)"];
  const args: (string | number)[] = [choice.country, choice.lang, choice.easy ? 1 : 0, userId];
  if (choice.specialty) (where.push("specialty = ?"), args.push(choice.specialty));
  if (choice.track) (where.push("track = ?"), args.push(choice.track));
  if (choice.level) (where.push("level = ?"), args.push(choice.level));
  return !!(await db.get(`SELECT 1 AS ok FROM case_bank WHERE ${where.join(" AND ")} LIMIT 1`, ...args));
}
