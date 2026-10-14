/**
 * Who is signed in.
 *
 * Accounts sign in with Supabase Auth (src/server/supabase.ts): Supabase holds
 * the passwords, sends the codes and links, and issues the session cookies.
 * RamAI keeps only the profile and progress, linked by the Supabase user id —
 * never a password or a code.
 *
 * Guests trying the demo have no password at all: a random 256-bit token in
 * an HttpOnly cookie, of which only the SHA-256 hash is stored.
 */
import "server-only";

import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";

import { isAuthRetryableFetchError, type User as SupabaseUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { isCountry, type Country } from "@/engine/countries";
import type { PatientLang } from "@/engine/types";
import type { PlanId } from "@/lib/plans";
import { isPreferredSpecialty, type PreferredSpecialty } from "@/lib/specialty";

import { db, isUniqueViolation } from "./db";
import { currentAccount, supabaseServer } from "./supabase";

export const SESSION_COOKIE = "ramai_session";
const SESSION_DAYS = 30;
/** Marks profiles whose password lives with Supabase (the column predates Supabase). */
const NO_PASSWORD = "!supabase";

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  plan: PlanId;
  planExpiresAt: number | null;
  /** Language patients and families speak in this player's cases. */
  patientLang: PatientLang;
  createdAt: number;
  emailVerified: boolean;
  /** Trying the demo without an account; becomes a full account on sign-up. */
  isGuest: boolean;
  /** League the player competes in when they next join a week (0 = Bronze). */
  leagueTier: number;
  /** Where their patients come from: names, units, money, emergency number, hospital names. */
  country: Country;
  /** The doctor's specialty — their cases come from it. "mixed": every specialty. null: not asked yet. */
  specialty: PreferredSpecialty | null;
}

interface UserRow {
  id: string;
  auth_id: string | null;
  email: string;
  username: string;
  name: string;
  plan: string;
  plan_expires_at: number | null;
  patient_lang: string | null;
  created_at: number;
  email_verified_at: number | null;
  is_guest: number;
  is_demo: number;
  league_tier: number;
  country: string | null;
  specialty?: string | null;
}

function toUser(r: UserRow): User {
  const active = r.plan === "pro" && (r.plan_expires_at === null || r.plan_expires_at > Date.now());
  return {
    id: r.id,
    email: r.email,
    username: r.username,
    name: r.name,
    plan: active ? "pro" : "free",
    planExpiresAt: r.plan_expires_at,
    patientLang: r.patient_lang === "hinglish" ? "hinglish" : "en",
    createdAt: r.created_at,
    emailVerified: r.email_verified_at !== null || r.is_demo === 1,
    isGuest: r.is_guest === 1,
    leagueTier: r.league_tier ?? 0,
    country: isCountry(r.country) ? r.country : "IN",
    specialty: isPreferredSpecialty(r.specialty) ? r.specialty : null,
  };
}

export class AuthError extends Error {
  constructor(public readonly code: "EXISTS" | "INVALID" | "UNAUTHENTICATED", message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/* -------------------------------------------------------------------------- */
/* Profiles                                                                    */
/* -------------------------------------------------------------------------- */

export async function findUserById(id: string): Promise<User | null> {
  const row = await db.get<UserRow>("SELECT * FROM users WHERE id = ?", id);
  return row ? toUser(row) : null;
}

/** A real (non-demo, non-guest) account by email address. */
export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await db.get<UserRow>("SELECT * FROM users WHERE email = ? AND is_demo = 0 AND is_guest = 0", email.trim());
  return row ? toUser(row) : null;
}

/** The email behind a username, so players can still sign in with either. */
export async function emailForLogin(login: string): Promise<string | null> {
  const value = login.trim();
  if (value.includes("@")) return value.toLowerCase();
  const row = await db.get<{ email: string }>("SELECT email FROM users WHERE username = ? AND is_demo = 0 AND is_guest = 0", value);
  return row?.email.toLowerCase() ?? null;
}

/** An account from before Supabase sign-in that hasn't been claimed again yet. */
export async function isLegacyAccount(email: string): Promise<boolean> {
  return !!(await db.get("SELECT 1 AS x FROM users WHERE email = ? AND auth_id IS NULL AND is_demo = 0 AND is_guest = 0", email.trim()));
}

/** Can this email sign up? Its username must be free — or already theirs, from an account made before. */
export async function signupProblem(email: string, username: string): Promise<string | null> {
  const holder = await db.get<{ auth_id: string | null }>("SELECT auth_id FROM users WHERE email = ? AND is_demo = 0 AND is_guest = 0", email);
  if (holder?.auth_id) return "An account with this email already exists. Log in instead.";
  const owner = await db.get<{ email: string }>("SELECT email FROM users WHERE username = ?", username);
  if (owner && owner.email.toLowerCase() !== email.toLowerCase()) return "That username is taken.";
  return null;
}

const USERNAME = /^[a-zA-Z0-9._]{3,24}$/;

/** A free username: the one asked for if possible, else a close variant. */
async function freeUsername(wanted: string, email: string): Promise<string> {
  const base = USERNAME.test(wanted) ? wanted : (email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9._]/g, "").slice(0, 20).padEnd(3, "0");
  for (let i = 0; i < 12; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 19)}${randomInt(10, 99_999)}`;
    if (!(await db.get("SELECT 1 AS x FROM users WHERE username = ?", candidate))) return candidate;
  }
  return `doc${randomInt(100_000, 9_999_999)}`;
}

/** What a Supabase account tells us about its owner. */
export interface AuthIdentity {
  id: string;
  email: string;
  /** Supabase has confirmed the email (the six-digit code, or a link). */
  confirmed: boolean;
  /** user_metadata from sign-up: name, username, country, terms version. Set by RamAI's server at sign-up. */
  meta: Record<string, unknown>;
}

export const identityOf = (u: SupabaseUser): AuthIdentity => ({
  id: u.id,
  email: (u.email ?? "").toLowerCase(),
  confirmed: !!u.email_confirmed_at,
  meta: (u.user_metadata ?? {}) as Record<string, unknown>,
});

function detailsFrom(meta: Record<string, unknown>, email: string) {
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const name = str(meta.name, 60);
  return {
    name: name && name.length >= 2 ? name : (email.split("@")[0] ?? "Doctor").slice(0, 60),
    username: str(meta.username, 24) ?? "",
    country: isCountry(meta.country) ? meta.country : null,
    termsVersion: str(meta.terms_version, 20),
    termsAcceptedAt: typeof meta.terms_accepted_at === "number" ? meta.terms_accepted_at : null,
  };
}

/**
 * The RamAI profile for a verified Supabase account, made on its first visit:
 *   · an account with this email from before Supabase sign-in is linked (the code proved the email is theirs);
 *   · a guest who just signed up keeps the demo case they played;
 *   · otherwise a new profile.
 * Never for an unconfirmed email.
 */
export async function linkProfile(identity: AuthIdentity, opts: { guestId?: string } = {}): Promise<User | null> {
  if (!identity.confirmed || !identity.email) return null;
  const linked = await db.get<UserRow>("SELECT * FROM users WHERE auth_id = ?", identity.id);
  if (linked) return toUser(linked);

  const now = Date.now();
  const d = detailsFrom(identity.meta, identity.email);
  const sameEmail = await db.get<UserRow>("SELECT * FROM users WHERE email = ? AND is_demo = 0 AND is_guest = 0", identity.email);
  if (sameEmail) {
    await db.run(
      "UPDATE users SET auth_id = ?, password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?), terms_accepted_at = COALESCE(?, terms_accepted_at), terms_version = COALESCE(?, terms_version) WHERE id = ?",
      identity.id, NO_PASSWORD, now, d.termsAcceptedAt, d.termsVersion, sameEmail.id,
    );
    return findUserById(sameEmail.id);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const username = await freeUsername(d.username, identity.email);
    try {
      if (opts.guestId) {
        const claimed = await db.run(
          `UPDATE users SET auth_id = ?, email = ?, username = ?, name = ?, country = COALESCE(?, country), password_hash = ?, is_guest = 0,
                            created_at = ?, email_verified_at = ?, terms_accepted_at = ?, terms_version = ?
           WHERE id = ? AND is_guest = 1`,
          identity.id, identity.email, username, d.name, d.country, NO_PASSWORD, now, now, d.termsAcceptedAt ?? now, d.termsVersion, opts.guestId,
        );
        if (claimed.changes === 1) return findUserById(opts.guestId);
      }
      const id = randomUUID();
      await db.run(
        `INSERT INTO users (id, auth_id, email, username, name, password_hash, created_at, country, email_verified_at, terms_accepted_at, terms_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, identity.id, identity.email, username, d.name, NO_PASSWORD, now, d.country ?? "IN", now, d.termsAcceptedAt ?? now, d.termsVersion,
      );
      return findUserById(id);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // A parallel request made it first, or the username was just taken: look again.
      const made = await db.get<UserRow>("SELECT * FROM users WHERE auth_id = ?", identity.id);
      if (made) return toUser(made);
    }
  }
  throw new Error("Couldn't create the profile.");
}

/** A profile without Supabase — tests, and fixtures. */
export async function createProfile(input: { email: string; username: string; name: string; country?: Country; authId?: string }): Promise<User> {
  const id = randomUUID();
  const now = Date.now();
  await db
    .run(
      "INSERT INTO users (id, auth_id, email, username, name, password_hash, created_at, country, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id, input.authId ?? null, input.email.toLowerCase(), input.username, input.name, NO_PASSWORD, now, input.country ?? "IN", now,
    )
    .catch((err) => Promise.reject(isUniqueViolation(err) ? new AuthError("EXISTS", "That email or username is taken.") : err));
  return (await findUserById(id))!;
}

/** Proof of consent: when this account accepted the terms and privacy policy, and which version. */
export async function recordConsent(userId: string, version: string) {
  await db.run("UPDATE users SET terms_accepted_at = ?, terms_version = ? WHERE id = ?", Date.now(), version, userId);
}

export async function setPatientLang(userId: string, lang: PatientLang) {
  await db.run("UPDATE users SET patient_lang = ? WHERE id = ?", lang, userId);
}

export async function setCountry(userId: string, country: Country) {
  await db.run("UPDATE users SET country = ? WHERE id = ?", country, userId);
}

export async function setSpecialty(userId: string, specialty: PreferredSpecialty) {
  await db.run("UPDATE users SET specialty = ? WHERE id = ?", specialty, userId);
}

export async function setPlan(userId: string, plan: PlanId, expiresAt: number | null) {
  await db.run("UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?", plan, expiresAt, userId);
}

/* -------------------------------------------------------------------------- */
/* Guests — the try-it-first demo                                              */
/* -------------------------------------------------------------------------- */

const GUEST_DAYS = 7;

/**
 * Guests nobody can come back as: a week old, with no live session left (a
 * guest has no password — the session cookie is their only way in). A guest
 * still playing is never touched, however old the account — nor one who wrote
 * in the community, whose posts and replies stay.
 */
const STALE_GUEST =
  "SELECT id FROM users u WHERE u.is_guest = 1 AND u.created_at < ? AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.user_id = u.id) AND NOT EXISTS (SELECT 1 FROM replies r WHERE r.user_id = u.id)";
let purgedAt = 0;

/** Removes unclaimed guests (and everything they played) at most once an hour per server. */
async function purgeStaleGuests(now: number) {
  if (now - purgedAt < 3_600_000) return;
  purgedAt = now;
  const before = now - GUEST_DAYS * 86_400_000;
  // Children first, explicitly: cascades depend on a per-connection setting the cloud database may not keep.
  const children = ["sessions", "results", "case_starts", "auth_tokens", "league_members", "payments", "push_subscriptions", "case_ai", "mcq_answers", "progress_reports", "case_pool", "exam_answers", "practice_rounds"];
  // The users go last, by the same test, once their sessions (all expired) and records are gone.
  const users = `DELETE FROM users WHERE id IN (${STALE_GUEST})`;
  await db.batch([
    ...children.map((t) => ({ sql: `DELETE FROM ${t} WHERE user_id IN (${STALE_GUEST})`, args: [before, now] })),
    { sql: `UPDATE open_suggestions SET user_id = NULL WHERE user_id IN (${STALE_GUEST})`, args: [before, now] },
    { sql: users, args: [before, now] },
    // AI pictures and notes are kept for a month, for reopening recent cases.
    { sql: "DELETE FROM case_ai WHERE created_at < ?", args: [now - 30 * 86_400_000] },
  ]);
}

/** A throwaway account for the demo case. Unclaimed guests are removed after a week. */
export async function createGuest(country: Country = "IN"): Promise<User> {
  const now = Date.now();
  await purgeStaleGuests(now).catch((err) => console.error("[ramai] guest cleanup failed:", err instanceof Error ? err.message : err));
  const id = randomUUID();
  const handle = `guest-${id.slice(0, 8)}`;
  await db.run("INSERT INTO users (id, email, username, name, password_hash, is_guest, created_at, country) VALUES (?, ?, ?, 'Guest doctor', '!guest', 1, ?, ?)", id, `${handle}@guest.ramai.invalid`, handle, now, country);
  return (await findUserById(id))!;
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

/** A guest's session. (Accounts' sessions belong to Supabase.) */
export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expires = now + SESSION_DAYS * 86_400_000;
  await db.batch([
    { sql: "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", args: [tokenHash(token), userId, now, expires] },
    { sql: "DELETE FROM sessions WHERE expires_at < ?", args: [now] },
  ]);
  return { token, expires: new Date(expires) };
}

/** The guest behind a session token — only guests sign in this way. */
export async function guestForToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const row = await db.get<UserRow>("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_guest = 1", tokenHash(token), Date.now());
  return row ? toUser(row) : null;
}

export async function deleteSession(token: string | undefined) {
  if (token) await db.run("DELETE FROM sessions WHERE token_hash = ?", tokenHash(token));
}

export const sessionCookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

/** The guest signed in on this request, if any. */
export async function currentGuest(): Promise<User | null> {
  const jar = await cookies();
  return guestForToken(jar.get(SESSION_COOKIE)?.value);
}

/** Ends this browser's guest session (after it became a real account, or on log out). */
export async function endGuestSession() {
  const jar = await cookies();
  await deleteSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

/* -------------------------------------------------------------------------- */
/* The current request                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The signed-in player (server components, route handlers): a verified
 * Supabase account — its token checked on every request — or a guest.
 */
export async function getCurrentUser(): Promise<User | null> {
  let account: Awaited<ReturnType<typeof currentAccount>> = null;
  try {
    account = await currentAccount();
  } catch (err) {
    // Supabase unreachable: say so, rather than quietly signing everyone out.
    if (isAuthRetryableFetchError(err)) throw err;
    console.error("[ramai] couldn't read the sign-in:", err instanceof Error ? err.message : err);
  }
  if (account) {
    const row = await db.get<UserRow>("SELECT * FROM users WHERE auth_id = ?", account.id);
    if (row) return toUser(row);
    // Verified somewhere else (a link opened on another device): make the profile now.
    const { data } = await (await supabaseServer()).auth.getUser();
    return data.user ? linkProfile(identityOf(data.user)) : null;
  }
  return currentGuest();
}

/**
 * Who's asking, as SQL a caller can fold into a single round trip: the
 * profile's row, and a subquery for its id — from the Supabase sign-in, or a
 * guest's session. Null when nobody is signed in.
 */
export async function identityQuery(): Promise<{ user: string; id: string; args: (string | number)[] } | null> {
  let account: Awaited<ReturnType<typeof currentAccount>> = null;
  try {
    account = await currentAccount();
  } catch (err) {
    if (isAuthRetryableFetchError(err)) throw err;
    console.error("[ramai] couldn't read the sign-in:", err instanceof Error ? err.message : err);
  }
  if (account) return { user: "SELECT * FROM users WHERE auth_id = ?", id: "(SELECT id FROM users WHERE auth_id = ?)", args: [account.id] };
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const guest = "FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_guest = 1";
  return { user: `SELECT u.* ${guest}`, id: `(SELECT u.id ${guest})`, args: [tokenHash(token), Date.now()] };
}

export const userFromRow = (row: Record<string, unknown>): User => toUser(row as unknown as UserRow);

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", "Please log in.");
  return user;
}

/**
 * The player — or, for a visitor without an account, a guest made there and
 * then (its session cookie set on this response), so joining in needs no
 * sign-up. Route handlers only.
 */
export async function userOrGuest(country?: Country): Promise<User> {
  const user = await getCurrentUser();
  if (user) return user;
  const guest = await createGuest(country);
  const { token, expires } = await createSession(guest.id);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expires));
  return guest;
}
