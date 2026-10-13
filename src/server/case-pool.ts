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
