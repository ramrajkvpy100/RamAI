/**
 * Patients invented ahead of time. Inventing a patient takes the model half a
 * minute; while the doctor plays one case, the next is written in the
 * background and kept here, so "Next case" starts at once.
 */
import { checkCase } from "./case-check";
import "server-only";

import { randomUUID } from "node:crypto";

import { filterCases } from "@/engine/cases";
import type { Country } from "@/engine/countries";
import { getProvider } from "@/engine/providers";
import type { CaseSource, StartOptions } from "@/engine/providers/types";
import type { CareLevel, CaseTrack, PatientLang, Specialty } from "@/engine/types";

import { db } from "./db";

/** A ready patient keeps for this long (cases improve; a stale one is replaced). */
const KEEP_MS = 6 * 3_600_000;
/** One being written is given this long before it's assumed lost. */
const WRITING_MS = 3 * 60_000;
/** Fewer unmet cases than this, and it's time to invent another. */
const ENOUGH_UNMET = 2;
/** The lock on background writing lasts this long if whoever holds it dies without letting go. */
const LOCK_MS = 90_000;
/** This server's own writer, so its requests don't even ask the database. */
let writingHere = false;

/** Takes the one background-writing lock, atomically, across every server: true if this caller holds it now. */
export async function takeWritingLock(holder: string, now = Date.now()): Promise<boolean> {
  return takeSlot(1, holder, LOCK_MS, now);
}

async function takeSlot(slot: number, holder: string, ms: number, now: number): Promise<boolean> {
  const taken = await db.run(
    "INSERT INTO generation_lock (slot, expires_at, holder) VALUES (?, ?, ?) ON CONFLICT(slot) DO UPDATE SET expires_at = excluded.expires_at, holder = excluded.holder WHERE generation_lock.expires_at <= ?",
    slot, now + ms, holder, now,
  );
  return taken.changes === 1;
}

/** How many patients may be invented while a doctor waits, across every server. Beyond this, the next doctor is given a case at once. */
export const LIVE_SLOTS = 3;
/** A doctor's case takes up to about 3 minutes to write; a dead server's slot frees itself after that. */
const LIVE_MS = 180_000;
const FIRST_LIVE_SLOT = 11;

/** One of the places to invent a patient live, atomically: a release function, or null when they're all taken. */
export async function takeLiveSlot(holder: string, now = Date.now()): Promise<(() => Promise<void>) | null> {
  for (let i = 0; i < LIVE_SLOTS; i++) {
    const slot = FIRST_LIVE_SLOT + i;
    if (await takeSlot(slot, holder, LIVE_MS, now)) return async () => void (await db.run("DELETE FROM generation_lock WHERE slot = ? AND holder = ?", slot, holder));
  }
  return null;
}

/** Lets it go, if it's still ours. */
export async function dropWritingLock(holder: string): Promise<void> {
  await db.run("DELETE FROM generation_lock WHERE slot = 1 AND holder = ?", holder);
}

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

/** A ready patient fitting this choice, taken out of the pool, or null. What the doctor left unset matches anything. */
export async function takeReady(userId: string, choice: PoolChoice): Promise<CaseSource | null> {
  const rows = await db.all<{ id: string; src: string; pool_key: string }>(
    "SELECT id, src, pool_key FROM case_pool WHERE user_id = ? AND src != '' AND created_at > ? ORDER BY created_at ASC",
    userId, Date.now() - KEEP_MS,
  );
  for (const row of rows) {
    const src = fits(row, choice);
    if (!src) continue;
    // Taken once: if two starts race, only the one that deletes it gets it.
    const taken = await db.run("DELETE FROM case_pool WHERE id = ?", row.id);
    if (taken.changes === 1) return src;
  }
  return null;
}

/** The case in this pool row, if it fits the choice: same difficulty, country and language; the rest only where asked for. */
function fits(row: { src: string; pool_key: string }, c: PoolChoice): CaseSource | null {
  const [, , , easy, country, lang] = row.pool_key.split("|");
  if (easy !== (c.easy ? "easy" : "std") || country !== c.country || lang !== c.lang) return null;
  try {
    const src = JSON.parse(row.src) as CaseSource;
    if (src.kind !== "generated") return row.pool_key === poolKey(c) ? src : null;
    const d = src.def;
    return (!c.specialty || d.specialty === c.specialty) && (!c.track || d.track === c.track) && (!c.level || d.level === c.level) ? src : null;
  } catch {
    return null;
  }
}

/** If this doctor's next patient is being written right now, waits for it (up to `ms`) rather than writing a second one. */
export async function waitForWriting(userId: string, choice: PoolChoice, ms: number): Promise<CaseSource | null> {
  const key = `|${choice.easy ? "easy" : "std"}|${choice.country}|${choice.lang}`;
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const writing = await db.get<{ id: string }>("SELECT id FROM case_pool WHERE user_id = ? AND src = '' AND created_at > ? AND pool_key LIKE ? LIMIT 1", userId, Date.now() - WRITING_MS, `%${key}`);
    if (!writing) return takeReady(userId, choice);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

/**
 * Writes the next patient for this choice, unless one is waiting or already
 * being written. Only invented patients are kept — a written case starts at once anyway.
 */
export async function prepareNext(userId: string, choice: PoolChoice, opts: Omit<StartOptions, "specialty" | "track" | "level" | "easy" | "country">): Promise<"ready" | "writing" | "written" | "skipped"> {
  const provider = await getProvider();
  if (provider.id === "mock") return "skipped";
  // Plenty they haven't met (written, banked or ready): nothing to invent, or pay for.
  if ((await unmetCases(userId, choice, opts.allowedLevels).catch(() => ENOUGH_UNMET)) >= ENOUGH_UNMET) return "skipped";
  const key = poolKey(choice);
  const now = Date.now();
  await db.run("DELETE FROM case_pool WHERE user_id = ? AND (created_at <= ? OR (src = '' AND created_at <= ?))", userId, now - KEEP_MS, now - WRITING_MS);
  const there = await db.get<{ src: string }>("SELECT src FROM case_pool WHERE user_id = ? AND pool_key = ? LIMIT 1", userId, key);
  if (there) return there.src ? "ready" : "writing";
  // One at a time, across all doctors and servers: a burst of starts can't burn the credit. A doctor who finds none ready still gets a case at once.
  if (writingHere) return "writing";
  writingHere = true;
  const id = randomUUID();
  try {
    if (!(await takeWritingLock(id, now))) return "writing";
    try {
      return await writeInto(id, userId, choice, opts, key, now, provider);
    } finally {
      await dropWritingLock(id).catch(() => undefined);
    }
  } finally {
    writingHere = false;
  }
}

async function writeInto(id: string, userId: string, choice: PoolChoice, opts: Omit<StartOptions, "specialty" | "track" | "level" | "easy" | "country">, key: string, now: number, provider: Awaited<ReturnType<typeof getProvider>>): Promise<"written" | "skipped"> {
  // Marked as being written, so a second request doesn't write another.
  await db.run("INSERT INTO case_pool (id, user_id, pool_key, src, created_at) VALUES (?, ?, ?, '', ?)", id, userId, key, now);
  try {
    const src = await provider.createCase({ ...opts, specialty: choice.specialty, track: choice.track, level: choice.level, easy: choice.easy, country: choice.country });
    if (src.kind !== "generated") {
      await db.run("DELETE FROM case_pool WHERE id = ?", id);
      return "skipped";
    }
    // Kept first, so a slow second opinion can't lose it; whatever it calls seriously wrong is then taken out.
    await db.run("UPDATE case_pool SET src = ?, created_at = ? WHERE id = ?", JSON.stringify(src), Date.now(), id);
    const check = await checkCase(src);
    if (check.status === "rejected") {
      console.warn("[ramai] a written case was rejected by the second opinion:", check.errors.join(" | ").slice(0, 400));
      await db.run("DELETE FROM case_pool WHERE id = ?", id);
      return "skipped";
    }
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
export async function bankCase(userId: string, src: CaseSource, fit: BankFit): Promise<string | undefined> {
  if (src.kind !== "generated") return undefined;
  const id = randomUUID();
  await db.run(
    "INSERT INTO case_bank (id, specialty, track, level, easy, country, lang, src, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, fit.specialty ?? null, fit.track, fit.level, fit.easy ? 1 : 0, fit.country, fit.lang, JSON.stringify(src), Date.now(),
  );
  await db.run("INSERT OR IGNORE INTO case_bank_seen (user_id, bank_id) VALUES (?, ?)", userId, id);
  return id;
}

/** Takes back a banked case the second opinion found seriously wrong. */
export async function unbankCase(id: string): Promise<void> {
  await db.run("DELETE FROM case_bank WHERE id = ?", id);
}

/** How many cases this doctor hasn't met could start now, counted only as far as is enough to decide. */
export async function unmetCases(userId: string, choice: PoolChoice, allowedLevels?: readonly CareLevel[]): Promise<number> {
  const met = new Set((await db.all<{ case_ref: string }>("SELECT DISTINCT case_ref FROM results WHERE user_id = ?", userId)).map((r) => r.case_ref));
  const written = filterCases({ specialty: choice.specialty, track: choice.track, level: choice.level, easy: choice.easy, country: choice.country, allowedLevels }).filter((c) => !met.has(c.id)).length;
  if (written >= ENOUGH_UNMET) return written;
  const where = ["country = ?", "lang = ?", "easy = ?", "id NOT IN (SELECT bank_id FROM case_bank_seen WHERE user_id = ?)"];
  const args: (string | number)[] = [choice.country, choice.lang, choice.easy ? 1 : 0, userId];
  if (choice.specialty) (where.push("specialty = ?"), args.push(choice.specialty));
  if (choice.track) (where.push("track = ?"), args.push(choice.track));
  if (choice.level) (where.push("level = ?"), args.push(choice.level));
  const banked = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM case_bank WHERE ${where.join(" AND ")} LIMIT ${ENOUGH_UNMET})`, ...args);
  const ready = await db.all<{ src: string; pool_key: string }>("SELECT src, pool_key FROM case_pool WHERE user_id = ? AND src != '' AND created_at > ?", userId, Date.now() - KEEP_MS);
  return written + (banked?.n ?? 0) + ready.filter((row) => fits(row, choice)).length;
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
