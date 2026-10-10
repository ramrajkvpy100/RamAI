import { randomUUID } from "node:crypto";

import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { authCookieOptions, hasAuthCookie, isSecretKey, supabaseConfig } from "@/lib/server/supabase-env";
import { rateLimited } from "@/lib/server/http";
import { appUrl } from "@/server/app-url";
import { createGuest, createProfile, emailForLogin, findUserById, isLegacyAccount, linkProfile, signupProblem, type AuthIdentity } from "@/server/auth";
import { authFailure } from "@/server/auth-errors";
import { db } from "@/server/db";

process.env.RAMAI_DB_PATH = ":memory:";
delete process.env.RAMAI_APP_URL;

const identity = (email: string, meta: Record<string, unknown> = {}, confirmed = true): AuthIdentity => ({ id: randomUUID(), email, confirmed, meta });

describe("Supabase settings", () => {
  it("reads the public URL and key under Supabase's and Vercel's names", () => {
    expect(supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" })).toEqual({ url: "https://abc.supabase.co", key: "sb_publishable_x" });
    expect(supabaseConfig({ SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJ.a.b" })).toEqual({ url: "https://abc.supabase.co", key: "eyJ.a.b" });
    expect(supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" })).toBeNull();
  });

  it("refuses a secret or service-role key in place of the public one", () => {
    const serviceRole = `x.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.y`;
    const anon = `x.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.y`;
    expect(isSecretKey("sb_secret_abc")).toBe(true);
    expect(isSecretKey(serviceRole)).toBe(true);
    expect(isSecretKey(anon)).toBe(false);
    expect(isSecretKey("sb_publishable_abc")).toBe(false);
    expect(supabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" })).toBeNull();
  });

  it("knows Supabase's session cookies, and keeps them away from page scripts", () => {
    expect(hasAuthCookie(["sb-abc-auth-token"])).toBe(true);
    expect(hasAuthCookie(["sb-abc-auth-token.0", "sb-abc-auth-token.1"])).toBe(true);
    expect(hasAuthCookie(["sb-abc-auth-token-code-verifier", "ramai_session"])).toBe(false);
    expect(authCookieOptions()).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });
});

describe("profiles for verified Supabase accounts", () => {
  it("are made only once the email is confirmed, from the sign-up details", async () => {
    expect(await linkProfile(identity("pending@example.com", { name: "Dr. Pending" }, false))).toBeNull();
    const who = identity("new.doc@example.com", { name: "Dr. New Doc", username: "new.doc", country: "UK", terms_version: "2026-10-10", terms_accepted_at: 1_700_000_000_000 });
    const user = (await linkProfile(who))!;
    expect(user).toMatchObject({ email: "new.doc@example.com", username: "new.doc", name: "Dr. New Doc", country: "UK", emailVerified: true, isGuest: false });
    const row = await db.get<{ auth_id: string; password_hash: string; terms_version: string }>("SELECT auth_id, password_hash, terms_version FROM users WHERE id = ?", user.id);
    expect(row).toEqual({ auth_id: who.id, password_hash: "!supabase", terms_version: "2026-10-10" });
    // Every later visit finds the same profile.
    expect((await linkProfile(who))!.id).toBe(user.id);
  });

  it("are made once, even when requests race", async () => {
    const who = identity("race@example.com", { name: "Dr. Race", username: "race.doc" });
    const made = await Promise.all([linkProfile(who), linkProfile(who), linkProfile(who)]);
    expect(new Set(made.map((u) => u!.id)).size).toBe(1);
  });

  it("link an account from before Supabase sign-in by its (now proven) email, keeping its progress", async () => {
    const old = await createProfile({ email: "veteran@example.com", username: "veteran", name: "Dr. Veteran" });
    await db.run("UPDATE users SET password_hash = 'scrypt$131072$8$1$c2FsdA$aGFzaA' WHERE id = ?", old.id);
    await db.run(
      "INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, score, xp, created_at) VALUES (?, 'vet-1', 'c', 1, 'Medicine', 'opd', 'chc', 'x', 'correct', 80, 100, ?)",
      old.id, Date.now(),
    );
    expect(await isLegacyAccount("veteran@example.com")).toBe(true);
    expect(await signupProblem("veteran@example.com", "veteran")).toBeNull(); // their own username, from before
    const linked = (await linkProfile(identity("veteran@example.com", { username: "someone.else" })))!;
    expect(linked.id).toBe(old.id);
    expect(linked.username).toBe("veteran");
    expect(await isLegacyAccount("veteran@example.com")).toBe(false);
    expect((await db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", old.id))?.password_hash).toBe("!supabase");
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ?", old.id))?.n).toBe(1);
  });

  it("turn the guest who signed up into the account, keeping the demo case", async () => {
    const guest = await createGuest("US");
    await db.run(
      "INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, score, xp, created_at) VALUES (?, 'guest-1', 'tut', 1, 'Emergency', 'emergency', 'chc', 'x', 'correct', 80, 100, ?)",
      guest.id, Date.now(),
    );
    const user = (await linkProfile(identity("arjun.g@example.com", { name: "Arjun Singh", username: "arjun.g" }), { guestId: guest.id }))!;
    expect(user).toMatchObject({ id: guest.id, isGuest: false, email: "arjun.g@example.com", username: "arjun.g", country: "US" });
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE user_id = ?", guest.id))?.n).toBe(1);
    // A guest can only be claimed once.
    const other = (await linkProfile(identity("second@example.com", { name: "Dr. Second", username: "second.doc" }), { guestId: guest.id }))!;
    expect(other.id).not.toBe(guest.id);
  });

  it("get a close variant when the username was taken meanwhile", async () => {
    await createProfile({ email: "first.taker@example.com", username: "popular", name: "Dr. First" });
    const user = (await linkProfile(identity("second.taker@example.com", { name: "Dr. Second", username: "popular" })))!;
    expect(user.username).not.toBe("popular");
    expect(user.username).toMatch(/^popular\d+$/);
    const bad = (await linkProfile(identity("odd.chars+x@example.com", { username: "x" })))!;
    expect(bad.username).toMatch(/^[a-zA-Z0-9._]{3,24}$/);
  });
});

describe("signing up and in", () => {
  it("refuses an email that already has an account, and someone else's username", async () => {
    await linkProfile(identity("taken@example.com", { name: "Dr. Taken", username: "taken.doc" }));
    expect(await signupProblem("taken@example.com", "fresh.name")).toMatch(/already exists/);
    expect(await signupProblem("brand.new@example.com", "taken.doc")).toMatch(/username is taken/);
    expect(await signupProblem("brand.new@example.com", "brand.new")).toBeNull();
  });

  it("finds the email behind a username — server-side only — and treats emails case-insensitively", async () => {
    await linkProfile(identity("usher@example.com", { name: "Dr. Usher", username: "usher.doc" }));
    expect(await emailForLogin("Usher.Doc")).toBe("usher@example.com");
    expect(await emailForLogin("USHER@Example.com")).toBe("usher@example.com");
    expect(await emailForLogin("nobody.here")).toBeNull();
    const guest = await createGuest();
    expect(await emailForLogin(guest.username)).toBeNull();
  });

  it("puts Supabase's answers in plain words, without revealing accounts", async () => {
    const err = (code: string, status = 400) => new AuthApiError("x", status, code);
    const answer = async (code: string, status?: number) => {
      const res = authFailure(err(code, status));
      return { status: res.status, ...((await res.json()) as { error: { code: string; message: string } }).error };
    };
    expect(await answer("invalid_credentials")).toMatchObject({ status: 401, code: "INVALID", message: "Incorrect email or password." });
    expect(await answer("email_not_confirmed")).toMatchObject({ status: 403, code: "VERIFY_REQUIRED" });
    expect(await answer("otp_expired", 403)).toMatchObject({ status: 400, code: "CODE_INVALID" });
    expect(await answer("over_email_send_rate_limit", 429)).toMatchObject({ status: 429, code: "RATE_LIMITED" });
    expect(await answer("flow_state_not_found", 404)).toMatchObject({ code: "LINK_EXPIRED" });
    expect(await answer("email_address_not_authorized")).toMatchObject({ status: 503, code: "EMAIL_UNAVAILABLE" });
    expect(await answer("same_password", 422)).toMatchObject({ code: "BAD_INPUT" });
    expect(await answer("something_new", 500)).toMatchObject({ status: 503, code: "AUTH_UNAVAILABLE" });
  });

  it("never lets a forged Host header decide where emailed links point", () => {
    const request = (host: string) => new Request(`http://${host}/api/auth`, { headers: { host } });
    expect(appUrl(request("evil.example.com"))).toBeNull();
    expect(appUrl(request("localhost:3218"))).toBe("http://localhost:3218");
    process.env.RAMAI_APP_URL = "https://ramai.app/";
    expect(appUrl(request("evil.example.com"))).toBe("https://ramai.app");
    delete process.env.RAMAI_APP_URL;
  });

  it("rate limits are per endpoint: playing a case doesn't use up sign-up or reset attempts", () => {
    const from = (path: string) => new Request(`http://localhost:3218${path}`, { headers: { "x-forwarded-for": "203.0.113.7" } });
    for (let i = 0; i < 20; i++) rateLimited(from("/api/cases/turn"), 90);
    expect(rateLimited(from("/api/auth/signup"), 10)).toBeNull();
    for (let i = 0; i < 5; i++) expect(rateLimited(from("/api/auth/forgot"), 5)).toBeNull();
    expect(rateLimited(from("/api/auth/forgot"), 5)?.status).toBe(429);
  });

  it("finds a profile by id after linking", async () => {
    const u = (await linkProfile(identity("lookup@example.com", { name: "Dr. Lookup", username: "lookup.doc" })))!;
    expect((await findUserById(u.id))?.email).toBe("lookup@example.com");
  });
});
