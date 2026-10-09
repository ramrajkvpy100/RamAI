/**
 * Fictional demo doctors, so leaderboards and leagues aren't empty on a fresh
 * install. Only with RAMAI_SEED_DEMO=1 — never set it on a real deployment.
 * They're labelled "Demo" wherever they appear and cannot log in.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { CASE_LIBRARY } from "@/engine/cases";
import { prngFrom } from "@/lib/prng";

import { db, type Value } from "./db";

const NAMES = [
  ["Dr. Ananya Rao", "ananya.rao"], ["Dr. Kabir Mehta", "kabir.m"], ["Dr. Ishita Sharma", "ishita_s"], ["Dr. Rohan Verma", "rohanv"],
  ["Dr. Meera Iyer", "meera.iyer"], ["Dr. Arjun Singh", "arjun.singh"], ["Dr. Sana Qureshi", "sanaq"], ["Dr. Vikram Nair", "vik.nair"],
  ["Dr. Priyanka Das", "priyanka.d"], ["Dr. Aditya Kulkarni", "adik"], ["Dr. Neha Gupta", "nehag"], ["Dr. Farhan Ali", "farhan.ali"],
  ["Dr. Tanvi Joshi", "tanvij"], ["Dr. Siddharth Bose", "sid.bose"],
];

let checked: Promise<void> | undefined;

export function ensureDemoPlayers(): Promise<void> {
  if (process.env.RAMAI_SEED_DEMO !== "1") return Promise.resolve();
  return (checked ??= seed().catch((err) => {
    checked = undefined;
    throw err;
  }));
}

async function seed() {
  if (((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1"))?.n ?? 0) > 0) return;
  const rand = prngFrom(2026);
  const insertUser = "INSERT INTO users (id, email, username, name, password_hash, is_demo, created_at) VALUES (?, ?, ?, ?, '!demo', 1, ?)";
  const insertResult =
    "INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, rescued, score, xp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)";
  const writes: { sql: string; args: Value[] }[] = [];
  const now = Date.now();
  NAMES.forEach(([name, username], i) => {
    if (!name || !username) return;
    const id = randomUUID();
    writes.push({ sql: insertUser, args: [id, `${username}@demo.ramai.invalid`, username, name, now - 40 * 86_400_000] });
    const skill = 45 + rand() * 40;
    const cases = 6 + Math.floor(rand() * 18) - Math.floor(i / 3);
    for (let n = 0; n < cases; n++) {
      const c = CASE_LIBRARY[Math.floor(rand() * CASE_LIBRARY.length)]!;
      const score = Math.max(18, Math.min(98, Math.round(skill + (rand() - 0.5) * 30)));
      const when = now - Math.floor(rand() * 20) * 86_400_000 - Math.floor(rand() * 36_000_000);
      writes.push({ sql: insertResult, args: [id, randomUUID(), c.id, n + 1, c.specialty, c.track, c.level, c.truth.diagnosis, score >= 60 ? "correct" : "partial", score, Math.round(score * 1.2 + c.difficulty * 8), when] });
    }
  });
  await db.batch(writes);
}
