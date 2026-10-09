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

import { getDb } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;

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

const N = 16384;
const R = 8;
const P = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
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

export async function createUser(input: { email: string; username: string; name: string; password: string; country?: Country }): Promise<User> {
  const db = getDb();
  const taken = db.prepare("SELECT email, username FROM users WHERE email = ? OR username = ?").get(input.email, input.username) as { email: string; username: string } | undefined;
  if (taken) {
    throw new AuthError("EXISTS", taken.email.toLowerCase() === input.email.toLowerCase() ? "An account with this email already exists." : "That username is taken.");
  }
  const id = randomUUID();
  const now = Date.now();
  db.prepare("INSERT INTO users (id, email, username, name, password_hash, created_at, country) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id, input.email, input.username, input.name, await hashPassword(input.password), now, input.country ?? "IN",
  );
  return findUserById(id)!;
}

export async function authenticate(login: string, password: string): Promise<User> {
  const row = getDb().prepare("SELECT * FROM users WHERE (email = ? OR username = ?) AND is_demo = 0 AND is_guest = 0").get(login, login) as UserRow | undefined;
  // Hash anyway so timing does not reveal whether the account exists.
  const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!row || !ok) throw new AuthError("INVALID", "Incorrect email/username or password.");
  return toUser(row);
}

export function findUserById(id: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/** A real (non-demo, non-guest) account by email address. */
export function findUserByEmail(email: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE email = ? AND is_demo = 0 AND is_guest = 0").get(email.trim()) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export async function setPassword(userId: string, password: string) {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(password), userId);
}

export function markEmailVerified(userId: string) {
  getDb().prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(Date.now(), userId);
}

/* -------------------------------------------------------------------------- */
/* Guests — the try-it-first demo                                              */
/* -------------------------------------------------------------------------- */

const GUEST_DAYS = 7;

/** A throwaway account for the demo case. Unclaimed guests are removed after a week. */
export function createGuest(country: Country = "IN"): User {
  const db = getDb();
  const now = Date.now();
  db.prepare("DELETE FROM users WHERE is_guest = 1 AND created_at < ?").run(now - GUEST_DAYS * 86_400_000);
  const id = randomUUID();
  const handle = `guest-${id.slice(0, 8)}`;
  db.prepare("INSERT INTO users (id, email, username, name, password_hash, is_guest, created_at, country) VALUES (?, ?, ?, 'Guest doctor', '!guest', 1, ?, ?)").run(id, `${handle}@guest.ramai.invalid`, handle, now, country);
  return findUserById(id)!;
}

/** Turns the signed-in guest into a full account, keeping the demo case they played. */
export async function claimGuest(guestId: string, input: { email: string; username: string; name: string; password: string; country?: Country }): Promise<User> {
  const db = getDb();
  const taken = db.prepare("SELECT email, username FROM users WHERE (email = ? OR username = ?) AND id != ?").get(input.email, input.username, guestId) as { email: string; username: string } | undefined;
  if (taken) {
    throw new AuthError("EXISTS", taken.email.toLowerCase() === input.email.toLowerCase() ? "An account with this email already exists." : "That username is taken.");
  }
  db.prepare("UPDATE users SET email = ?, username = ?, name = ?, password_hash = ?, is_guest = 0, created_at = ?, country = COALESCE(?, country) WHERE id = ? AND is_guest = 1").run(
    input.email, input.username, input.name, await hashPassword(input.password), Date.now(), input.country ?? null, guestId,
  );
  return findUserById(guestId)!;
}

export function setPatientLang(userId: string, lang: PatientLang) {
  getDb().prepare("UPDATE users SET patient_lang = ? WHERE id = ?").run(lang, userId);
}

export function setCountry(userId: string, country: Country) {
  getDb().prepare("UPDATE users SET country = ? WHERE id = ?").run(country, userId);
}

export function setPlan(userId: string, plan: PlanId, expiresAt: number | null) {
  getDb().prepare("UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?").run(plan, expiresAt, userId);
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

export function createSession(userId: string): { token: string; expires: Date } {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expires = now + SESSION_DAYS * 86_400_000;
  const db = getDb();
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(tokenHash(token), userId, now, expires);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  return { token, expires: new Date(expires) };
}

export function userForToken(token: string | undefined): User | null {
  if (!token) return null;
  const row = getDb()
    .prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .get(tokenHash(token), Date.now()) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function deleteSession(token: string | undefined) {
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}

/** Signs the user out everywhere (after a password reset). */
export function deleteAllSessions(userId: string) {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
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
