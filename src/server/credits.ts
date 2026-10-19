/**
 * Free Pro cases. Every account starts with a trial of TRIAL Pro cases (any level, beyond the day's
 * free ones); inviting a friend who signs up gives each of them REFERRAL more. Guests sign up first.
 */
import "server-only";

import { db } from "./db";

export const TRIAL = 5;
export const REFERRAL = 10;
/** The friend that unlocks a month of Pro. */
export const PRO_AT_FRIENDS = 3;
const PRO_DAYS = 30;
/** Friends one doctor's own invite link can let in — RamAI stays invite-only. */
export const INVITES_EACH = 5;

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
  // The third friend: a month of Pro, once.
  if ((await referralCount(ref.id)) === PRO_AT_FRIENDS) {
    const now = Date.now();
    await db.run(
      "UPDATE users SET plan = 'pro', plan_expires_at = (CASE WHEN plan = 'pro' AND (plan_expires_at IS NULL OR plan_expires_at > ?) THEN plan_expires_at ELSE ? END) + ? WHERE id = ? AND (plan_expires_at IS NOT NULL OR plan <> 'pro')",
      now, now, PRO_DAYS * 86_400_000, ref.id,
    );
  }
}

/** This doctor's own invite code (made the first time), and how many friends it can still let in. */
export async function personalInvite(username: string): Promise<{ code: string; left: number }> {
  const label = `friend:${username}`;
  let row = await db.get<{ code: string; uses: number; max_uses: number }>("SELECT code, uses, max_uses FROM access_codes WHERE label = ? AND revoked = 0 ORDER BY created_at LIMIT 1", label);
  if (!row) {
    const { createCodes } = await import("./access");
    const [code] = await createCodes(1, label, INVITES_EACH);
    row = { code: code!, uses: 0, max_uses: INVITES_EACH };
  }
  return { code: row.code, left: Math.max(0, Number(row.max_uses) - Number(row.uses)) };
}

/** How many friends this doctor has brought in. */
export async function referralCount(userId: string): Promise<number> {
  const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM case_credits WHERE referred_by = ?", userId);
  return Number(row?.n ?? 0);
}
