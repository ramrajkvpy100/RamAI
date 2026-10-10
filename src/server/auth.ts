/**
 * Accounts and sessions.
 *
 * Passwords: scrypt (N=16384, r=8, p=1) with a per-user salt.
 * Sessions: a random 256-bit token in an HttpOnly cookie; only its SHA-256
 * hash is stored, so a database leak cannot be replayed. Sessions are revocable.
 */
import "server-only";

import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { cookies } from "next/headers";

import { isCountry, type Country } from "@/engine/countries";
import type { PatientLang } from "@/engine/types";
import type { PlanId } from "@/lib/plans";

import { db, isUniqueViolation } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

export const SESSION_COOKIE = "ramai_session";
const SESSION_DAYS = 30;

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
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  name: string;
  password_hash: string;
  plan: string;
  plan_expires_at: number | null;
  patient_lang: string | null;
  created_at: number;
  email_verified_at: number | null;
  is_guest: number;
  is_demo: number;
  league_tier: number;
  country: string | null;
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
  };
}

/* -------------------------------------------------------------------------- */
/* Passwords                                                                   */
/* -------------------------------------------------------------------------- */

// OWASP's minimum for scrypt. Tests use a cheap cost so the suite stays fast.
const N = process.env.NODE_ENV === "test" ? 1024 : 131072;
const R = 8;
const P = 1;
const MAXMEM = 256 * 1024 * 1024;
const DUMMY_HASH = `scrypt${N}$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA`;

/** Older accounts were hashed with a lower cost; they're upgraded when they next sign in. */
const needsRehash = (stored: string) => Number(stored.split("$")[1]) < N;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export class AuthError extends Error {
  constructor(public readonly code: "EXISTS" | "INVALID" | "UNAUTHENTICATED", message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Why an email or username can't be used — checked before writing, and again by the database's unique keys. */
async function assertAvailable(email: string, username: string, exceptId = "") {
  const taken = await db.get<{ email: string; username: string }>("SELECT email, username FROM users WHERE (email = ? OR username = ?) AND id != ?", email, username, exceptId);
  if (taken) throw new AuthError("EXISTS", taken.email.toLowerCase() === email.toLowerCase() ? "An account with this email already exists." : "That username is taken.");
}

const takenMeanwhile = (err: unknown) => (isUniqueViolation(err) ? new AuthError("EXISTS", "That email or username was just taken. Try another.") : err);

export async function createUser(input: { email: string; username: string; name: string; password: string; country?: Country }): Promise<User> {
  await assertAvailable(input.email, input.username);
  const id = randomUUID();
  const hash = await hashPassword(input.password);
  await db
    .run("INSERT INTO users (id, email, username, name, password_hash, created_at, country) VALUES (?, ?, ?, ?, ?, ?, ?)", id, input.email, input.username, input.name, hash, Date.now(), input.country ?? "IN")
    .catch((err) => Promise.reject(takenMeanwhile(err)));
  return (await findUserById(id))!;
}

export async function authenticate(login: string, password: string): Promise<User> {
  const row = await db.get<UserRow>("SELECT * FROM users WHERE (email = ? OR username = ?) AND is_demo = 0 AND is_guest = 0", login, login);
  // Hash anyway so timing does not reveal whether the account exists.
  const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, DUMMY_HASH);
  if (!row || !ok) throw new AuthError("INVALID", "Incorrect email/username or password.");
  if (needsRehash(row.password_hash)) await setPassword(row.id, password);
  return toUser(row);
}

export async function findUserById(id: string): Promise<User | null> {
  const row = await db.get<UserRow>("SELECT * FROM users WHERE id = ?", id);
  return row ? toUser(row) : null;
}

/** A real (non-demo, non-guest) account by email address. */
export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await db.get<UserRow>("SELECT * FROM users WHERE email = ? AND is_demo = 0 AND is_guest = 0", email.trim());
  return row ? toUser(row) : null;
}

export async function setPassword(userId: string, password: string) {
  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(password), userId);
}

/** Proof of consent: when this account accepted the terms and privacy policy, and which version. */
export async function recordConsent(userId: string, version: string) {
  await db.run("UPDATE users SET terms_accepted_at = ?, terms_version = ? WHERE id = ?", Date.now(), version, userId);
}

export async function markEmailVerified(userId: string) {
  await db.run("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?", Date.now(), userId);
}

/* -------------------------------------------------------------------------- */
/* Guests — the try-it-first demo                                              */
/* -------------------------------------------------------------------------- */

const GUEST_DAYS = 7;

const STALE_GUEST = "SELECT id FROM users WHERE is_guest = 1 AND created_at < ?";
let purgedAt = 0;

/** Removes unclaimed guests (and everything they played) at most once an hour per server. */
async function purgeStaleGuests(now: number) {
  if (now - purgedAt < 3_600_000) return;
  purgedAt = now;
  const before = now - GUEST_DAYS * 86_400_000;
  // Children first, explicitly: cascades depend on a per-connection setting the cloud database may not keep.
  const children = ["sessions", "results", "case_starts", "auth_tokens", "league_members", "payments", "push_subscriptions"];
  await db.batch([...children.map((t) => ({ sql: `DELETE FROM ${t} WHERE user_id IN (${STALE_GUEST})`, args: [before] })), { sql: "DELETE FROM users WHERE is_guest = 1 AND created_at < ?", args: [before] }]);
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

/** Turns the signed-in guest into a full account, keeping the demo case they played. */
export async function claimGuest(guestId: string, input: { email: string; username: string; name: string; password: string; country?: Country }): Promise<User> {
  await assertAvailable(input.email, input.username, guestId);
  const hash = await hashPassword(input.password);
  await db
    .run(
      "UPDATE users SET email = ?, username = ?, name = ?, password_hash = ?, is_guest = 0, created_at = ?, country = COALESCE(?, country) WHERE id = ? AND is_guest = 1",
      input.email, input.username, input.name, hash, Date.now(), input.country ?? null, guestId,
    )
    .catch((err) => Promise.reject(takenMeanwhile(err)));
  return (await findUserById(guestId))!;
}

export async function setPatientLang(userId: string, lang: PatientLang) {
  await db.run("UPDATE users SET patient_lang = ? WHERE id = ?", lang, userId);
}

export async function setCountry(userId: string, country: Country) {
  await db.run("UPDATE users SET country = ? WHERE id = ?", country, userId);
}

export async function setPlan(userId: string, plan: PlanId, expiresAt: number | null) {
  await db.run("UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?", plan, expiresAt, userId);
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

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

export async function userForToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const row = await db.get<UserRow>("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?", tokenHash(token), Date.now());
  return row ? toUser(row) : null;
}

export async function deleteSession(token: string | undefined) {
  if (token) await db.run("DELETE FROM sessions WHERE token_hash = ?", tokenHash(token));
}

/** Signs the user out everywhere (after a password reset). */
export async function deleteAllSessions(userId: string) {
  await db.run("DELETE FROM sessions WHERE user_id = ?", userId);
}

export const sessionCookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

/** The signed-in user for the current request (server components, route handlers). */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  return userForToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", "Please log in.");
  return user;
}
