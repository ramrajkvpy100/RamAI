/**
 * Sign-up, verification, login, logout and password reset, end to end: the
 * real RamAI server (a production build) against a stand-in for Supabase Auth.
 *
 *   npx next build && RAMAI_E2E=1 npx vitest run tests/e2e
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Browser as BaseBrowser, E2E, startStack, type Stack } from "./harness";
import type { FakeGoTrue } from "../support/fake-gotrue";

const PORT = 3299;
const BASE = `http://localhost:${PORT}`;
const RUN = E2E;

class Browser extends BaseBrowser {
  constructor() {
    super(BASE);
  }
}

describe.skipIf(!RUN)("accounts end to end (Supabase Auth stand-in)", () => {
  let auth: FakeGoTrue;
  let stack: Stack;
  const email = "e2e.doctor@example.com";
  const password = "violet kestrel 2026";
  const browser = new Browser();

  beforeAll(async () => {
    stack = await startStack(PORT);
    auth = stack.auth;
  }, 60_000);

  afterAll(async () => {
    await stack?.stop();
  });

  const signupBody = (over: Record<string, unknown> = {}) => ({ name: "Dr. Eve Tester", username: "eve.tester", email, password, country: "IN", acceptTerms: true, ...over });

  it("1–2 · signs up and emails a six-digit code — and nothing opens up yet", async () => {
    const res = await browser.api("/api/auth/signup", signupBody());
    expect(res).toMatchObject({ status: 200, body: { status: "verify", email } });
    expect(auth.lastMail(email, "signup")?.code).toMatch(/^\d{6}$/);
    expect(browser.signedIn()).toBe(false);
  });

  it("12 · keeps unverified accounts out of everything", async () => {
    expect((await browser.api("/api/me")).status).toBe(401);
    expect((await browser.api("/api/cases", {})).status).toBe(401);
    const profile = await browser.go("/profile");
    expect([307, 308]).toContain(profile.status);
    expect(profile.headers.get("location")).toContain("/login");
    expect(await browser.api("/api/auth/login", { login: email, password })).toMatchObject({ status: 403, code: "VERIFY_REQUIRED" });
  });

  it("4 · turns a wrong code away, clearly", async () => {
    const real = auth.lastMail(email, "signup")!.code;
    const wrong = real === "000000" ? "111111" : "000000";
    expect(await browser.api("/api/auth/verify", { email, code: wrong })).toMatchObject({ status: 400, code: "CODE_INVALID" });
    expect(await browser.api("/api/auth/verify", { email, code: "12ab" })).toMatchObject({ status: 400, code: "BAD_INPUT" });
  });

  it("6 · resends a code only after the cooldown; only the newest works", async () => {
    const first = auth.lastMail(email, "signup")!.code;
    expect(await browser.api("/api/auth/resend", { email })).toMatchObject({ status: 429, code: "RATE_LIMITED" });
    auth.advance(61_000);
    expect(await browser.api("/api/auth/resend", { email })).toMatchObject({ status: 200, body: { ok: true, cooldown: 60 } });
    const second = auth.lastMail(email, "signup")!.code;
    if (second !== first) expect(await browser.api("/api/auth/verify", { email, code: first })).toMatchObject({ code: "CODE_INVALID" });
  });

  it("5 · an expired code fails; a fresh one works", async () => {
    auth.advance(61 * 60_000);
    expect(await browser.api("/api/auth/verify", { email, code: auth.lastMail(email, "signup")!.code })).toMatchObject({ status: 400, code: "CODE_INVALID" });
    expect((await browser.api("/api/auth/resend", { email })).status).toBe(200);
  });

  it("3 · the right code verifies the email and signs the player in", async () => {
    const res = await browser.api("/api/auth/verify", { email, code: auth.lastMail(email, "signup")!.code });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email, username: "eve.tester", name: "Dr. Eve Tester", isGuest: false, emailVerified: true });
    expect(browser.signedIn()).toBe(true);
    const me = await browser.api("/api/me");
    expect(me.status).toBe(200);
    expect((me.body as { user: { email: string } }).user.email).toBe(email);
    // The session cookie is out of page scripts' reach.
    const cookie = (await browser.post("/api/auth/verify", { email, code: "999999" })).headers.getSetCookie().join("\n");
    expect(cookie).not.toMatch(/sb-[^=]*-auth-token=[^;]*;(?![^\n]*HttpOnly)/i);
  });

  it("refuses a second account on the same email", async () => {
    expect(await new Browser().api("/api/auth/signup", signupBody({ username: "eve.again" }))).toMatchObject({ status: 409, code: "EXISTS" });
  });

  it("13 · stays signed in across reloads, refreshing the session when its token expires", async () => {
    const page = await browser.go("/");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Dr. Eve Tester");
    // A short-lived token: once it lapses, the next page load refreshes it.
    auth.setAccessTokenTtl(2);
    await browser.api("/api/auth/logout", {});
    expect((await browser.api("/api/auth/login", { login: email, password })).status).toBe(200);
    const before = [...browser.jar].find(([k]) => k.includes("auth-token"))?.[1];
    await new Promise((r) => setTimeout(r, 2600));
    const again = await browser.go("/");
    expect(await again.text()).toContain("Dr. Eve Tester");
    expect([...browser.jar].find(([k]) => k.includes("auth-token"))?.[1]).not.toBe(before);
    expect((await browser.api("/api/me")).status).toBe(200);
    auth.setAccessTokenTtl(3600);
  });

  it("9 · logs out", async () => {
    expect((await browser.api("/api/auth/logout", {})).status).toBe(200);
    expect(browser.signedIn()).toBe(false);
    expect((await browser.api("/api/me")).status).toBe(401);
  });

  it("8 · turns a wrong password away, without saying which part was wrong", async () => {
    expect(await browser.api("/api/auth/login", { login: email, password: "not the password" })).toMatchObject({ status: 401, code: "INVALID", body: { error: { message: "Incorrect email or password." } } });
    expect(await browser.api("/api/auth/login", { login: "nobody.at.all", password })).toMatchObject({ status: 401, code: "INVALID" });
  });

  it("7 · logs in with the right email — or username — and password", async () => {
    expect((await browser.api("/api/auth/login", { login: "eve.tester", password })).status).toBe(200);
    expect((await browser.api("/api/me")).status).toBe(200);
    await browser.api("/api/auth/logout", {});
  });

  it("10–11 · emails a reset link; the page doesn't use it up; the new password works and the old doesn't", async () => {
    // Another device, signed in with a short-lived token.
    auth.setAccessTokenTtl(2);
    const other = new Browser();
    expect((await other.api("/api/auth/login", { login: email, password })).status).toBe(200);
    const otherAt = Date.now();
    auth.setAccessTokenTtl(3600);

    auth.advance(61_000);
    expect(await browser.api("/api/auth/forgot", { email })).toMatchObject({ status: 200, body: { ok: true } });
    expect(await browser.api("/api/auth/forgot", { email: "no.such.person@example.com" })).toMatchObject({ status: 200, body: { ok: true } });
    const mail = auth.lastMail(email, "recovery")!;
    expect(mail.redirectTo).toBe(`${BASE}/reset-password`);

    // Opening the page (or an email scanner "clicking" it) spends nothing.
    const page = await browser.go(`/reset-password?token_hash=${mail.tokenHash}&type=recovery`);
    expect(await page.text()).toContain("Choose a new password");
    expect(await browser.api("/api/auth/reset", { password: "password123", tokenHash: mail.tokenHash })).toMatchObject({ status: 400, code: "BAD_INPUT" });

    // Supabase turns down the old password as the new one: the same link may be tried again with another.
    expect(await browser.api("/api/auth/reset", { password, tokenHash: mail.tokenHash })).toMatchObject({ status: 400, code: "BAD_INPUT" });
    const fresh = "amber falcon 4417";
    expect((await browser.api("/api/auth/reset", { password: fresh, tokenHash: mail.tokenHash })).status).toBe(200);
    expect((await browser.api("/api/me")).status).toBe(200); // signed in by the reset
    expect(await browser.api("/api/auth/reset", { password: "another river 88", tokenHash: "f".repeat(56) })).toMatchObject({ code: "LINK_EXPIRED" });
    await browser.api("/api/auth/logout", {});

    expect(await browser.api("/api/auth/login", { login: email, password })).toMatchObject({ code: "INVALID" });
    expect((await browser.api("/api/auth/login", { login: email, password: fresh })).status).toBe(200);
    // The reset signed every other device out: once its token lapses, its session can't be renewed.
    await new Promise((r) => setTimeout(r, Math.max(0, otherAt + 2600 - Date.now())));
    expect((await other.api("/api/me")).status).toBe(401);
    await browser.api("/api/auth/logout", {});
  });

  it("11 · handles Supabase's default reset link (PKCE) in the same browser — and an expired one anywhere", async () => {
    auth.advance(61_000);
    await browser.api("/api/auth/forgot", { email });
    const mail = auth.lastMail(email, "recovery")!;
    const hop = await fetch(mail.link, { redirect: "manual" });
    const landing = new URL(hop.headers.get("location")!);
    expect(landing.pathname).toBe("/reset-password");
    const code = landing.searchParams.get("code")!;
    expect(await new Browser().api("/api/auth/reset", { password: "sunlit harbour 31", code })).toMatchObject({ code: "LINK_EXPIRED" });
    expect((await browser.api("/api/auth/reset", { password: "sunlit harbour 31", code })).status).toBe(200);
    await browser.api("/api/auth/logout", {});

    const used = await fetch(mail.link, { redirect: "manual" });
    expect(used.headers.get("location")).toContain("error_code=otp_expired");
  });

  it("a guest who signs up keeps the demo case", async () => {
    const guest = new Browser();
    const started = await guest.api("/api/auth/guest", {});
    const guestId = (started.body.user as { id: string }).id;
    const who = "guest.convert@example.com";
    expect((await guest.api("/api/auth/signup", signupBody({ email: who, username: "guest.convert" }))).body).toMatchObject({ status: "verify" });
    const verified = await guest.api("/api/auth/verify", { email: who, code: auth.lastMail(who, "signup")!.code });
    expect((verified.body.user as { id: string }).id).toBe(guestId);
    expect(guest.jar.has("ramai_session")).toBe(false);
  });

  it("confirms sign-ups from Supabase's default link too", async () => {
    const tab = new Browser();
    const who = "link.confirm@example.com";
    await tab.api("/api/auth/signup", signupBody({ email: who, username: "link.confirm" }));
    const hop = await fetch(auth.lastMail(who, "signup")!.link, { redirect: "manual" });
    const landing = new URL(hop.headers.get("location")!);
    expect(landing.pathname).toBe("/verify-email");
    expect((await tab.api("/api/auth/verify", { code: landing.searchParams.get("code") })).status).toBe(200);
    expect((await tab.api("/api/me")).status).toBe(200);
  });

  it("deleting the account removes the Supabase sign-in too", async () => {
    const tab = new Browser();
    await tab.api("/api/auth/login", { login: "link.confirm@example.com", password });
    expect(await tab.api("/api/me/delete", { password: "wrong one" })).toMatchObject({ status: 401 });
    const id = auth.users.get("link.confirm@example.com")!.id;
    expect((await tab.api("/api/me/delete", { password })).status).toBe(200);
    expect(auth.deleted).toContain(id);
    expect((await tab.api("/api/me")).status).toBe(401);
  });
});
