import { readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { appUrl, confirmEmail, requestPasswordReset, resetLinkValid, resetPassword, sendVerification } from "@/server/account";
import { authenticate, claimGuest, createGuest, createSession, createUser, findUserById, userForToken } from "@/server/auth";
import { rateLimited } from "@/lib/server/http";
import { getDb } from "@/server/db";

process.env.RAMAI_DB_PATH = ":memory:";
const OUTBOX = path.join(tmpdir(), `ramai-outbox-${process.pid}-${Date.now()}`);
process.env.RAMAI_OUTBOX_DIR = OUTBOX;
delete process.env.RAMAI_EMAIL_PROVIDER;
delete process.env.RAMAI_APP_URL;

afterAll(() => rmSync(OUTBOX, { recursive: true, force: true }));

const request = (host: string) => new Request(`http://${host}/api/auth`, { headers: { host } });
const BASE = "http://localhost:3218";
const tokenOf = (link: string) => new URL(link).searchParams.get("token")!;
/** The newest link of a kind in the outbox (emails are files there without a provider). */
function lastLink(kind: "verify-email" | "reset-password"): string {
  const files = readdirSync(OUTBOX).sort();
  for (const file of files.reverse()) {
    const m = readFileSync(path.join(OUTBOX, file), "utf8").match(new RegExp(`https?://[^"\\s<]+/${kind}\\?token=[A-Za-z0-9_-]+`));
    if (m) return m[0];
  }
  throw new Error("no link in outbox");
}
const skipCooldown = (userId: string) => getDb().prepare("UPDATE auth_tokens SET created_at = created_at - 120000 WHERE user_id = ?").run(userId);

describe("email verification", () => {
  it("new accounts start unverified; the emailed link verifies them, once", async () => {
    const user = await createUser({ email: "meera.v@example.com", username: "meera.v", name: "Meera Iyer", password: "stethoscope" });
    expect(user.emailVerified).toBe(false);
    const sent = await sendVerification(user, BASE);
    expect(sent.sent).toBe(true);
    const token = tokenOf(lastLink("verify-email"));
    expect(confirmEmail(token)?.emailVerified).toBe(true);
    expect(findUserById(user.id)?.emailVerified).toBe(true);
    expect(confirmEmail(token)).toBeNull();
  });

  it("only the newest link works, and asking again too quickly is refused", async () => {
    const user = await createUser({ email: "farhan.v@example.com", username: "farhan.v", name: "Farhan Ali", password: "stethoscope" });
    await sendVerification(user, BASE);
    const first = tokenOf(lastLink("verify-email"));
    expect(await sendVerification(user, BASE)).toEqual({ sent: false, reason: "COOLDOWN" });
    skipCooldown(user.id);
    await sendVerification(user, BASE);
    const second = tokenOf(lastLink("verify-email"));
    expect(confirmEmail(first)).toBeNull();
    expect(confirmEmail(second)?.emailVerified).toBe(true);
  });

  it("expired links do nothing", async () => {
    const user = await createUser({ email: "tanvi.v@example.com", username: "tanvi.v", name: "Tanvi Joshi", password: "stethoscope" });
    await sendVerification(user, BASE);
    getDb().prepare("UPDATE auth_tokens SET expires_at = 1 WHERE user_id = ?").run(user.id);
    expect(confirmEmail(tokenOf(lastLink("verify-email")))).toBeNull();
    expect(findUserById(user.id)?.emailVerified).toBe(false);
  });

  it("never lets a forged Host header decide where links point", () => {
    expect(appUrl(request("evil.example.com"))).toBeNull();
    expect(appUrl(request("localhost:3218"))).toBe("http://localhost:3218");
    expect(appUrl(request("192.168.1.48:3218"))).toBe("http://192.168.1.48:3218");
    process.env.RAMAI_APP_URL = "https://ramai.app/";
    expect(appUrl(request("evil.example.com"))).toBe("https://ramai.app");
    delete process.env.RAMAI_APP_URL;
  });
});

describe("password reset", () => {
  it("looks the same whether or not the account exists", async () => {
    const before = readdirSync(OUTBOX).length;
    await expect(requestPasswordReset("nobody-here@example.com", BASE)).resolves.toBeUndefined();
    expect(readdirSync(OUTBOX).length).toBe(before);
  });

  it("sets a new password once, signs out everywhere, and verifies the email", async () => {
    const user = await createUser({ email: "rohan.r@example.com", username: "rohan.r", name: "Rohan Verma", password: "old password 1" });
    const { token: session } = createSession(user.id);
    await requestPasswordReset("ROHAN.R@example.com", BASE);
    const token = tokenOf(lastLink("reset-password"));
    expect(resetLinkValid(token)).toBe(true);

    const updated = await resetPassword(token, "new password 2");
    expect(updated?.emailVerified).toBe(true);
    expect(userForToken(session)).toBeNull();
    expect((await authenticate("rohan.r", "new password 2")).id).toBe(user.id);
    await expect(authenticate("rohan.r", "old password 1")).rejects.toMatchObject({ code: "INVALID" });

    expect(resetLinkValid(token)).toBe(false);
    expect(await resetPassword(token, "another one 3")).toBeNull();
  });

  it("reset links expire after an hour", async () => {
    const user = await createUser({ email: "sana.r@example.com", username: "sana.r", name: "Sana Qureshi", password: "old password 1" });
    await requestPasswordReset(user.email, BASE);
    const token = tokenOf(lastLink("reset-password"));
    getDb().prepare("UPDATE auth_tokens SET expires_at = ? WHERE user_id = ?").run(Date.now() - 1, user.id);
    expect(await resetPassword(token, "new password 2")).toBeNull();
  });
});

describe("guests", () => {
  it("can try the demo, can't log in, and keep their case when they sign up", async () => {
    const guest = createGuest();
    expect(guest.isGuest).toBe(true);
    getDb()
      .prepare("INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, score, xp, created_at) VALUES (?, 'guest-s1', 'tut', 1, 'Emergency', 'emergency', 'chc', 'x', 'correct', 80, 100, ?)")
      .run(guest.id, Date.now());
    await expect(authenticate(guest.username, "!guest")).rejects.toMatchObject({ code: "INVALID" });

    const claimed = await claimGuest(guest.id, { email: "arjun.g@example.com", username: "arjun.g", name: "Arjun Singh", password: "stethoscope" });
    expect(claimed.id).toBe(guest.id);
    expect(claimed.isGuest).toBe(false);
    expect((getDb().prepare("SELECT COUNT(*) AS n FROM results WHERE user_id = ?").get(guest.id) as { n: number }).n).toBe(1);
    expect((await authenticate("arjun.g@example.com", "stethoscope")).id).toBe(guest.id);
  });

  it("can't take an email or username that's already in use", async () => {
    const guest = createGuest();
    await expect(claimGuest(guest.id, { email: "meera.v@example.com", username: "fresh.name", name: "X Y", password: "stethoscope" })).rejects.toMatchObject({ code: "EXISTS" });
  });
});

describe("rate limits", () => {
  it("are per endpoint: playing a case doesn't use up sign-up or reset attempts", () => {
    const from = (path: string) => new Request(`http://localhost:3218${path}`, { headers: { "x-forwarded-for": "203.0.113.7" } });
    for (let i = 0; i < 20; i++) rateLimited(from("/api/cases/turn"), 90);
    expect(rateLimited(from("/api/auth/signup"), 10)).toBeNull();
    for (let i = 0; i < 4; i++) expect(rateLimited(from("/api/auth/forgot"), 5)).toBeNull();
    expect(rateLimited(from("/api/auth/forgot"), 5)).toBeNull();
    expect(rateLimited(from("/api/auth/forgot"), 5)?.status).toBe(429);
  });
});

