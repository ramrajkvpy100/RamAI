/**
 * Free Pro cases. Every account starts with a trial of TRIAL Pro cases (any level, beyond the day's
 * free ones); inviting a friend who signs up gives each of them REFERRAL more. Guests sign up first.
 */
import "server-only";

import { db } from "./db";

export const TRIAL = 5;
export const REFERRAL = 5;

/** Free Pro cases left (an account's trial is made the first time it's asked about). */
export async function creditsLeft(userId: string): Promise<number> {
  await db.run("INSERT OR IGNORE INTO case_credits (user_id, credits, created_at) VALUES (?, ?, ?)", userId, TRIAL, Date.now());
  const row = await db.get<{ credits: number }>("SELECT credits FROM case_credits WHERE user_id = ?", userId);
  return Number(row?.credits ?? 0);
}

/** Uses one free Pro case; false when none are left. */
export async function useCredit(userId: string): Promise<boolean> {
  if ((await creditsLeft(userId)) <= 0) return false;
  const r = await db.run("UPDATE case_credits SET credits = credits - 1 WHERE user_id = ? AND credits > 0", userId);
  return r.changes === 1;
}

/** A new account that came from a friend's link: both get REFERRAL free Pro cases — once, never for inviting yourself. */
export async function creditReferral(newUserId: string, referrerUsername: string): Promise<void> {
  const ref = await db.get<{ id: string }>("SELECT id FROM users WHERE username = ? AND is_guest = 0 AND is_demo = 0", referrerUsername.trim().toLowerCase());
  if (!ref || ref.id === newUserId) return;
  await creditsLeft(newUserId);
  const marked = await db.run("UPDATE case_credits SET referred_by = ? WHERE user_id = ? AND referred_by IS NULL", ref.id, newUserId);
  if (marked.changes !== 1) return;
  await creditsLeft(ref.id);
  await db.run("UPDATE case_credits SET credits = credits + ? WHERE user_id IN (?, ?)", REFERRAL, newUserId, ref.id);
}

/** How many friends this doctor has brought in. */
export async function referralCount(userId: string): Promise<number> {
  const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM case_credits WHERE referred_by = ?", userId);
  return Number(row?.n ?? 0);
}
