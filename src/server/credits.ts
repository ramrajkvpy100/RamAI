/**
 * Free Pro cases, and the colleague-invite ladder. Every account starts with a trial of TRIAL Pro cases (any level, beyond the
 * day's free ones). A colleague counts once they've signed in with the doctor's link and finished a case: see INVITE_LADDER.
 */
import "server-only";

import { INVITE_LADDER } from "@/lib/plans";

import { db } from "./db";

export const TRIAL = 5;
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

/** A new account that came from a colleague's link: remembered, once, and never for inviting yourself. It counts when they finish a case. */
export async function creditReferral(newUserId: string, referrerUsername: string): Promise<void> {
  const ref = await db.get<{ id: string }>("SELECT id FROM users WHERE username = ? AND is_guest = 0 AND is_demo = 0", referrerUsername.trim().toLowerCase());
  if (!ref || ref.id === newUserId) return;
  await creditsLeft(newUserId);
  await db.run("UPDATE case_credits SET referred_by = ? WHERE user_id = ? AND referred_by IS NULL", ref.id, newUserId);
}

/** Pro added for this many days, from today or from when it already runs out. */
async function addProDays(userId: string, days: number, now = Date.now()) {
  await db.run(
    "UPDATE users SET plan = 'pro', plan_expires_at = (CASE WHEN plan = 'pro' AND (plan_expires_at IS NULL OR plan_expires_at > ?) THEN plan_expires_at ELSE ? END) + ? WHERE id = ? AND NOT (plan = 'pro' AND plan_expires_at IS NULL)",
    now, now, days * 86_400_000, userId,
  );
}

/** Gives a doctor every ladder step their qualified colleagues have reached and they don't have yet. Each step pays once, however often this runs. */
export async function settleInviteLadder(referrerId: string): Promise<number> {
  const friends = await referralCount(referrerId);
  for (const step of INVITE_LADDER) {
    if (friends < step.friends) break;
    const took = await db.run("UPDATE users SET invite_tier = ? WHERE id = ? AND invite_tier < ?", step.friends, referrerId, step.friends);
    if (took.changes === 1) await addProDays(referrerId, step.proDays);
  }
  return friends;
}

/** A doctor finished a case: if a colleague invited them, that colleague may have reached a new step. */
export async function settleInviterOf(userId: string): Promise<void> {
  const row = await db.get<{ referred_by: string | null }>("SELECT referred_by FROM case_credits WHERE user_id = ?", userId);
  if (row?.referred_by) await settleInviteLadder(row.referred_by);
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

/** Colleagues this doctor has brought in who've signed in and finished a real case. */
export async function referralCount(userId: string): Promise<number> {
  const row = await db.get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM case_credits c JOIN users u ON u.id = c.user_id WHERE c.referred_by = ? AND u.is_guest = 0 AND EXISTS (SELECT 1 FROM results r WHERE r.user_id = c.user_id AND COALESCE(r.tutorial, 0) = 0)",
    userId,
  );
  return Number(row?.n ?? 0);
}
