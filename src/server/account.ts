/**
 * Email verification and password reset.
 *
 * Links carry a random 256-bit token; only its SHA-256 hash is stored, it
 * expires, works once, and a newer link replaces older ones. Reset requests
 * never reveal whether an email has an account. A password reset signs the
 * account out everywhere.
 */
import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { deleteAllSessions, findUserByEmail, findUserById, markEmailVerified, setPassword, type User } from "./auth";
import { getDb } from "./db";
import { resetPasswordMessage, verifyEmailMessage } from "./emails";
import { ensureMembership } from "./leagues";
import { emailDelivery, sendEmail } from "./mailer";

type Purpose = "verify" | "reset";

const TTL: Record<Purpose, number> = { verify: 48 * 3_600_000, reset: 3_600_000 };
/** A new link of the same kind can be requested this often. */
const COOLDOWN_MS = 60_000;

const hashOf = (token: string) => createHash("sha256").update(token).digest("base64url");

function issue(user: User, purpose: Purpose): string {
  const db = getDb();
  const now = Date.now();
  const token = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM auth_tokens WHERE expires_at < ? OR (user_id = ? AND purpose = ? AND used_at IS NULL)").run(now, user.id, purpose);
  db.prepare("INSERT INTO auth_tokens (token_hash, user_id, purpose, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").run(hashOf(token), user.id, purpose, user.email, now, now + TTL[purpose]);
  return token;
}

function coolingDown(userId: string, purpose: Purpose): boolean {
  const row = getDb().prepare("SELECT MAX(created_at) AS at FROM auth_tokens WHERE user_id = ? AND purpose = ?").get(userId, purpose) as { at: number | null };
  return row.at !== null && Date.now() - row.at < COOLDOWN_MS;
}

interface TokenRow {
  user_id: string;
  email: string;
  expires_at: number;
  used_at: number | null;
}

function lookup(token: string, purpose: Purpose): TokenRow | null {
  if (!token || token.length > 200) return null;
  const row = getDb().prepare("SELECT user_id, email, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND purpose = ?").get(hashOf(token), purpose) as TokenRow | undefined;
  if (!row || row.used_at !== null || row.expires_at < Date.now()) return null;
  return row;
}

function spend(token: string) {
  getDb().prepare("UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?").run(Date.now(), hashOf(token));
}

/* -------------------------------------------------------------------------- */
/* Links                                                                       */
/* -------------------------------------------------------------------------- */

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|::1|.+\.localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * Where links in emails point. RAMAI_APP_URL in production; otherwise the
 * request's own host, but only for local addresses — a forged Host header must
 * never decide where a password-reset link goes.
 */
export function appUrl(req: Request): string | null {
  const configured = process.env.RAMAI_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = req.headers.get("host") ?? "";
  const hostname = host.replace(/:\d+$/, "").replace(/^\[(.*)\]$/, "$1");
  if (!PRIVATE_HOST.test(hostname)) {
    console.error("[ramai] Set RAMAI_APP_URL so account emails can link back to the app.");
    return null;
  }
  return `${req.headers.get("x-forwarded-proto") === "https" ? "https" : "http"}://${host}`;
}

/* -------------------------------------------------------------------------- */
/* Verification                                                                */
/* -------------------------------------------------------------------------- */

export type SendResult = { sent: true; devLink?: string } | { sent: false; reason: "VERIFIED" | "COOLDOWN" | "UNAVAILABLE" };

/**
 * Emails a verification link. With no email provider configured (local use),
 * the link is also returned so the owner of this account can open it.
 */
export async function sendVerification(user: User, baseUrl: string | null): Promise<SendResult> {
  if (user.emailVerified) return { sent: false, reason: "VERIFIED" };
  if (user.isGuest || !baseUrl) return { sent: false, reason: "UNAVAILABLE" };
  if (coolingDown(user.id, "verify")) return { sent: false, reason: "COOLDOWN" };
  const link = `${baseUrl}/verify-email?token=${issue(user, "verify")}`;
  const ok = await sendEmail(verifyEmailMessage(user.email, user.name, link));
  if (!ok) return { sent: false, reason: "UNAVAILABLE" };
  return emailDelivery() === "outbox" ? { sent: true, devLink: link } : { sent: true };
}

/** Confirms an email from its link. Returns the verified user, or null for a bad or used link. */
export function confirmEmail(token: string): User | null {
  const row = lookup(token, "verify");
  if (!row) return null;
  const user = findUserById(row.user_id);
  // The link only counts for the address it was sent to.
  if (!user || user.email.toLowerCase() !== row.email.toLowerCase()) return null;
  spend(token);
  markEmailVerified(user.id);
  const verified = findUserById(user.id)!;
  // Cases already played this week count: the player joins this week's league now.
  ensureMembership(verified);
  return verified;
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

/** Emails a reset link if the address has an account. Always looks the same to the caller. */
export async function requestPasswordReset(email: string, baseUrl: string | null): Promise<void> {
  const user = findUserByEmail(email);
  if (!user || !baseUrl || coolingDown(user.id, "reset")) return;
  const link = `${baseUrl}/reset-password?token=${issue(user, "reset")}`;
  await sendEmail(resetPasswordMessage(user.email, user.name, link));
}

/** Whether a reset link is still good (to show the form or an "expired" message). */
export function resetLinkValid(token: string): boolean {
  return lookup(token, "reset") !== null;
}

/**
 * Sets a new password from a reset link. Signs out every session; the link
 * proved the email, so the address counts as verified too.
 */
export async function resetPassword(token: string, password: string): Promise<User | null> {
  const row = lookup(token, "reset");
  if (!row) return null;
  spend(token);
  await setPassword(row.user_id, password);
  deleteAllSessions(row.user_id);
  markEmailVerified(row.user_id);
  return findUserById(row.user_id);
}
