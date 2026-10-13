/**
 * Data rights — the copy and the erasure that privacy law gives every player
 * (India's DPDP Act, UK/EU GDPR, US state privacy laws), self-serve.
 */
import "server-only";

import { db } from "./db";
import { supabaseAdmin, supabaseDetached } from "./supabase";

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
  const [account, results, starts, leagues, payments, devices, posts, replies, suggestions] = await Promise.all([
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
    db.all<{ id: string; topic: string; title: string; body: string; created_at: number }>("SELECT id, topic, title, body, created_at FROM posts WHERE user_id = ? ORDER BY created_at", userId),
    db.all<{ post_id: string; body: string; created_at: number }>("SELECT post_id, body, created_at FROM replies WHERE user_id = ? ORDER BY created_at", userId),
    db.all<{ category: string; message: string; created_at: number }>("SELECT category, message, created_at FROM open_suggestions WHERE user_id = ? ORDER BY created_at", userId),
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
    communityPosts: posts.map((p) => ({ ...p, created_at: iso(p.created_at) })),
    communityReplies: replies.map((r) => ({ ...r, created_at: iso(r.created_at) })),
    suggestionsAsGuest: suggestions.map((x) => ({ ...x, created_at: iso(x.created_at) })),
  };
}

/**
 * Confirms a password before an irreversible step, with Supabase — on a
 * throwaway session that's signed out again at once. Guests have none.
 */
export async function passwordMatches(email: string, password: string): Promise<boolean> {
  const supabase = supabaseDetached();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return true;
}

/**
 * Deletes the account and everything linked to it, at once. Payment records
 * that tax law requires us to keep move to an archive without any personal
 * details (amount, date, period and Razorpay IDs only).
 */
export async function deleteAccount(userId: string) {
  const now = Date.now();
  const authId = (await db.get<{ auth_id: string | null }>("SELECT auth_id FROM users WHERE id = ?", userId))?.auth_id ?? null;
  await db.batch([
    {
      sql: `INSERT OR IGNORE INTO payments_archive (order_id, payment_id, amount, currency, period, status, created_at, archived_at)
            SELECT order_id, payment_id, amount, currency, period, status, created_at, ? FROM payments WHERE user_id = ?`,
      args: [now, userId],
    },
    ...["payments", "sessions", "results", "case_starts", "auth_tokens", "league_members", "push_subscriptions", "case_ai", "mcq_answers", "progress_reports"].map((table) => ({ sql: `DELETE FROM ${table} WHERE user_id = ?`, args: [userId] })),
    { sql: "DELETE FROM open_suggestions WHERE user_id = ?", args: [userId] },
    // The community: their likes come off others' counts; their replies, and their posts with everything under them, go.
    { sql: "UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE 'p:' || id IN (SELECT target FROM likes WHERE user_id = ?)", args: [userId] },
    { sql: "UPDATE replies SET like_count = MAX(0, like_count - 1) WHERE 'r:' || id IN (SELECT target FROM likes WHERE user_id = ?)", args: [userId] },
    { sql: "DELETE FROM likes WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM reports WHERE user_id = ?", args: [userId] },
    { sql: "UPDATE posts SET reply_count = MAX(0, reply_count - (SELECT COUNT(*) FROM replies r WHERE r.post_id = posts.id AND r.user_id = ?)) WHERE id IN (SELECT post_id FROM replies WHERE user_id = ?)", args: [userId, userId] },
    { sql: "DELETE FROM replies WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)", args: [userId, userId] },
    { sql: "DELETE FROM likes WHERE target IN (SELECT 'p:' || id FROM posts WHERE user_id = ?)", args: [userId] },
    { sql: "DELETE FROM posts WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
  ]);
  return { signInRemoved: authId ? await removeSignIn(authId) : true };
}

/**
 * Deletes the Supabase sign-in record too, when a server-only secret key is
 * configured. Without one, the owner removes it in the Supabase dashboard
 * (Authentication → Users) — the privacy policy allows 30 days.
 */
async function removeSignIn(authId: string): Promise<boolean> {
  const admin = supabaseAdmin();
  if (!admin) {
    console.warn(`[ramai] Account deleted — remove Supabase user ${authId} in Authentication → Users (or set SUPABASE_SECRET_KEY to do it automatically).`);
    return false;
  }
  const { error } = await admin.auth.admin.deleteUser(authId);
  if (error) console.error("[ramai] couldn't delete the Supabase user:", error.message);
  return !error;
}
