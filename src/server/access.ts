/**
 * Invite-only access. A browser is let in by a one-time invite code (or a code you made for a
 * group), by signing in with an allowed email, or because the account existed before invites
 * began. Codes and emails are managed on /admin/access.
 */
import "server-only";

import { randomInt } from "node:crypto";

import { SITE } from "@/lib/site";
import { ACCESS_COOKIE, inviteOnly, validAccessCookie } from "@/lib/server/access-cookie";

import type { User } from "./auth";
import { db } from "./db";

/** Accounts made before invites began keep their access. */
const INVITES_SINCE = Date.UTC(2026, 9, 19);
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const owners = () => (process.env.RAMAI_ADMIN_EMAILS ?? SITE.ownerAccounts.join(",")).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/** Whether this account may use RamAI (and, if it came in with a pass, remembers it on the account). */
export async function userAllowed(user: User, cookieValue?: string): Promise<boolean> {
  if (!inviteOnly()) return true;
  const email = user.email.toLowerCase();
  if (owners().includes(email)) return true;
  if (!user.isGuest && user.createdAt < INVITES_SINCE) return true;
  if (await db.get("SELECT 1 AS ok FROM access_users WHERE user_id = ?", user.id)) return true;
  if (!user.isGuest && (await db.get("SELECT 1 AS ok FROM access_emails WHERE email = ?", email))) return true;
  if (await validAccessCookie(cookieValue)) {
    await db.run("INSERT OR IGNORE INTO access_users (user_id, via, at) VALUES (?, 'invite', ?)", user.id, Date.now());
    return true;
  }
  return false;
}

export async function accessCookieValue(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

/** Uses one invite code; true when it was valid and had a use left. */
export async function redeemCode(code: string): Promise<boolean> {
  const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length < 6) return false;
  const r = await db.run("UPDATE access_codes SET uses = uses + 1 WHERE code = ? AND revoked = 0 AND uses < max_uses", c);
  return r.changes === 1;
}

export async function createCodes(count: number, label: string, maxUses: number): Promise<string[]> {
  const out: string[] = [];
  while (out.length < count) {
    const code = Array.from({ length: 8 }, () => LETTERS[randomInt(LETTERS.length)]).join("");
    const r = await db.run("INSERT OR IGNORE INTO access_codes (code, label, max_uses, created_at) VALUES (?, ?, ?, ?)", code, label, maxUses, Date.now());
    if (r.changes === 1) out.push(code);
  }
  return out;
}

export async function listAccess() {
  const [codes, emails] = await Promise.all([
    db.all<{ code: string; label: string; max_uses: number; uses: number; revoked: number; created_at: number }>("SELECT * FROM access_codes ORDER BY created_at DESC LIMIT 300"),
    db.all<{ email: string; added_at: number }>("SELECT * FROM access_emails ORDER BY added_at DESC"),
  ]);
  return { codes, emails };
}

export async function revokeCode(code: string) {
  await db.run("UPDATE access_codes SET revoked = 1 WHERE code = ?", code.toUpperCase());
}
export async function allowEmail(email: string) {
  await db.run("INSERT OR IGNORE INTO access_emails (email, added_at) VALUES (?, ?)", email.trim().toLowerCase(), Date.now());
}
export async function removeEmail(email: string) {
  await db.run("DELETE FROM access_emails WHERE email = ?", email.trim().toLowerCase());
}
