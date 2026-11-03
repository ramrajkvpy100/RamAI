import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { proxy } from "@/proxy";
import { CheckoutSchema, SignupSchema } from "@/lib/server/schemas";
import { createProfile, recordConsent } from "@/server/auth";
import { db } from "@/server/db";
import { passwordProblem } from "@/server/passwords";
import { deleteAccount, exportData, passwordMatches } from "@/server/privacy";
import { clearLimit, exhausted, overLimit } from "@/server/rate-limit";

import { startFakeGoTrue, type FakeGoTrue } from "./support/fake-gotrue";

process.env.RAMAI_DB_PATH = ":memory:";

let auth: FakeGoTrue;
beforeAll(async () => {
  auth = await startFakeGoTrue();
  process.env.NEXT_PUBLIC_SUPABASE_URL = auth.url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = auth.publishableKey;
  process.env.SUPABASE_SECRET_KEY = auth.secretKey;
});
afterAll(async () => {
  await auth.close();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
});

describe("passwords", () => {
  it("refuses short, common and personal passwords", () => {
    expect(passwordProblem("short1")).toMatch(/8 characters/);
    expect(passwordProblem("password123")).toMatch(/easy to guess/);
    expect(passwordProblem("11111111")).toMatch(/easy to guess/);
    expect(passwordProblem("Kansana@2026", { name: "Dr. Ramraj Singh Kansana" })).toMatch(/name, username or email/);
    expect(passwordProblem("meera.iyer#77", { email: "meera.iyer@example.com" })).toMatch(/name, username or email/);
    expect(passwordProblem("blue-river-quiet-87", { name: "Dr. Asha Verma", username: "asha.v" })).toBeNull();
  });
});

describe("rate limits shared through the database", () => {
  it("counts attempts per window and resets after it", async () => {
    const t = 1_000_000;
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await overLimit("test:ip", 3, 60_000, t + i));
    expect(hits).toEqual([false, false, false, true]);
    expect(await exhausted("test:ip", 3, 60_000, t + 10)).toBe(true);
    expect(await overLimit("test:ip", 3, 60_000, t + 61_000)).toBe(false);
    await clearLimit("test:ip");
    expect(await exhausted("test:ip", 3, 60_000, t + 61_001)).toBe(false);
  });
});

describe("consent and data rights", () => {
  it("records consent, exports without secrets, and deletes everything but anonymous payment records", async () => {
    // The sign-in lives in Supabase; RamAI's profile links to it.
    const authId = "0b6f1c2a-1111-4c3d-9e8f-00000000a11c";
    auth.users.set("rights@example.com", { id: authId, email: "rights@example.com", password: "a calm blue river 7", confirmedAt: Date.now(), meta: {}, createdAt: Date.now() });
    const user = await createProfile({ email: "rights@example.com", username: "rights", name: "Dr. Rights", authId });
    await recordConsent(user.id, "2026-10-09");
    await db.run(
      "INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, score, xp, created_at) VALUES (?, 'r-s1', 'c', 1, 'Medicine', 'opd', 'chc', 'x', 'correct', 80, 100, ?)",
      user.id, Date.now(),
    );
    await db.run("INSERT INTO payments (id, user_id, provider, order_id, payment_id, amount, period, status, created_at) VALUES ('p-r', ?, 'razorpay', 'order_r', 'pay_r', 29900, 'monthly', 'paid', ?)", user.id, Date.now());

    const data = await exportData(user.id);
    expect(data?.account).toMatchObject({ email: "rights@example.com", termsVersion: "2026-10-09" });
    expect(data?.results).toHaveLength(1);
    expect(JSON.stringify(data)).not.toMatch(/scrypt\$|password_hash|token_hash/);

    expect(await passwordMatches(user.email, "wrong password")).toBe(false);
    expect(await passwordMatches(user.email, "a calm blue river 7")).toBe(true);
    expect(await deleteAccount(user.id)).toEqual({ signInRemoved: true });
    expect(auth.deleted).toContain(authId);
    expect(await db.get("SELECT id FROM users WHERE id = ?", user.id)).toBeUndefined();
    expect(await db.get("SELECT id FROM results WHERE user_id = ?", user.id)).toBeUndefined();
    expect(await db.get("SELECT id FROM payments WHERE user_id = ?", user.id)).toBeUndefined();
    const archived = await db.get<Record<string, unknown>>("SELECT * FROM payments_archive WHERE order_id = 'order_r'");
    expect(archived).toMatchObject({ payment_id: "pay_r", amount: 29900 });
    expect(Object.keys(archived!)).not.toContain("user_id");
  });

  it("needs explicit consent to sign up and to start Pro straight away", () => {
    const form = { name: "Dr. A", username: "doc.a", email: "a@example.com", password: "a calm blue river 7" };
    expect(SignupSchema.safeParse(form).success).toBe(false);
    expect(SignupSchema.safeParse({ ...form, acceptTerms: false }).success).toBe(false);
    expect(SignupSchema.safeParse({ ...form, acceptTerms: true }).success).toBe(true);
    expect(CheckoutSchema.safeParse({ period: "monthly" }).success).toBe(false);
    expect(CheckoutSchema.safeParse({ period: "monthly", startNow: true }).success).toBe(true);
  });
});

describe("open to everyone", () => {
  it("a visitor with no pass or session goes straight in, wherever they land", async () => {
    for (const path of ["/", "/case", "/cases", "/practice", "/invite"]) expect((await proxy(new NextRequest(`https://ram-ai.example${path}`))).status).toBe(200);
  });
});

describe("content security policy", () => {
  it("sends one fixed policy that keeps scripts to known hosts and locks framing and plugins down", async () => {
    const { default: config } = await import("../next.config");
    const rules = await config.headers!();
    const csp = rules.find((r) => r.source === "/(.*)")!.headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).toMatch(/script-src 'self' 'unsafe-inline' https:\/\/checkout\.razorpay\.com https:\/\/accounts\.google\.com\/gsi\/client(;|$)/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*\*/);
    process.env.RAMAI_INVITE_ONLY = "0";
    expect((await proxy(new NextRequest("https://ram-ai.example/case"))).headers.get("x-nonce")).toBeNull();
  });
});
