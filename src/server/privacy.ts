/**
 * Data rights — the copy and the erasure that privacy law gives every player
 * (India's DPDP Act, UK/EU GDPR, US state privacy laws), self-serve.
 */
import "server-only";

import { verifyPassword } from "./auth";
import { db } from "./db";

interface AccountRow {
  id: string;
  email: string;
  username: string;
  name: string;
  plan: string;
  plan_expires_at: number | null;
  patient_lang: string;
  country: string;
  created_at: number;
  email_verified_at: number | null;
  terms_accepted_at: number | null;
  terms_version: string | null;
  is_guest: number;
}

const iso = (ms: number | null | undefined) => (typeof ms === "number" ? new Date(ms).toISOString() : null);

/** Everything RamAI holds about a player, in a portable form (no password or token hashes). */
export async function exportData(userId: string) {
  const [account, results, starts, leagues, payments, devices] = await Promise.all([
    db.get<AccountRow>(
      "SELECT id, email, username, name, plan, plan_expires_at, patient_lang, country, created_at, email_verified_at, terms_accepted_at, terms_version, is_guest FROM users WHERE id = ?",
      userId,
    ),
    db.all<Record<string, unknown> & { created_at: number }>(
      "SELECT case_ref, case_number, specialty, track, level, diagnosis, verdict, rescued, score, xp, created_at FROM results WHERE user_id = ? ORDER BY created_at",
      userId,
    ),
    db.all<{ created_at: number; tutorial: number }>("SELECT created_at, tutorial FROM case_starts WHERE user_id = ? ORDER BY created_at", userId),
    db.all<Record<string, unknown>>("SELECT week, tier, cohort, joined_at, final_rank, outcome FROM league_members WHERE user_id = ? ORDER BY week", userId),
    db.all<Record<string, unknown> & { created_at: number }>("SELECT order_id, payment_id, amount, period, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at", userId),
    db.all<{ endpoint: string; seen_at: number; last_sent_day: string | null }>("SELECT endpoint, seen_at, last_sent_day FROM push_subscriptions WHERE user_id = ? ORDER BY seen_at", userId),
  ]);
  if (!account) return null;
  return {
    exportedAt: new Date().toISOString(),
    service: "RamAI",
    account: {
      id: account.id,
      name: account.name,
      username: account.username,
      email: account.email,
      country: account.country,
      patientLanguage: account.patient_lang,
      plan: account.plan,
      planExpires: iso(account.plan_expires_at),
      createdAt: iso(account.created_at),
      emailVerifiedAt: iso(account.email_verified_at),
      termsAcceptedAt: iso(account.terms_accepted_at),
      termsVersion: account.terms_version,
      guest: account.is_guest === 1,
    },
    results: results.map((r) => ({ ...r, created_at: iso(r.created_at) })),
    caseStarts: starts.map((s) => ({ startedAt: iso(s.created_at), guidedDemo: s.tutorial === 1 })),
    weeklyLeagues: leagues.map((l) => ({ ...l, week: iso(l.week as number), joined_at: iso(l.joined_at as number) })),
    payments: payments.map((p) => ({ ...p, created_at: iso(p.created_at) })),
    dailyReminders: devices.map((d) => ({ pushService: new URL(d.endpoint).hostname, lastConfirmed: iso(d.seen_at), lastSentDay: d.last_sent_day })),
  };
}

/** Confirms a password before an irreversible step. Guests have none. */
export async function passwordMatches(userId: string, password: string): Promise<boolean> {
  const row = await db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", userId);
  return !!row && (await verifyPassword(password, row.password_hash));
}

/**
 * Deletes the account and everything linked to it, at once. Payment records
 * that tax law requires us to keep move to an archive without any personal
 * details (amount, date, period and Razorpay IDs only).
 */
export async function deleteAccount(userId: string) {
  const now = Date.now();
  await db.batch([
    {
      sql: `INSERT OR IGNORE INTO payments_archive (order_id, payment_id, amount, period, status, created_at, archived_at)
            SELECT order_id, payment_id, amount, period, status, created_at, ? FROM payments WHERE user_id = ?`,
      args: [now, userId],
    },
    ...["payments", "sessions", "results", "case_starts", "auth_tokens", "league_members", "push_subscriptions"].map((table) => ({ sql: `DELETE FROM ${table} WHERE user_id = ?`, args: [userId] })),
    { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
  ]);
}
