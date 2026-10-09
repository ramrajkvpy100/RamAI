import { createHmac } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { phAcs } from "@/engine/cases/ph-acs";
import { generateDebrief } from "@/engine/debrief";
import { AuthError, authenticate, createSession, createUser, deleteSession, findUserById, markEmailVerified, setPatientLang, setPlan, userForToken, type User } from "@/server/auth";
import { verifyPayment } from "@/server/billing";
import { getDb } from "@/server/db";
import { casesStartedToday, historyFor, leaderboard, progressFor, recordCase, recordCaseStart } from "@/server/results";

import { play } from "./helpers";

process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAZORPAY_KEY_SECRET = "test-secret";

let asha: User;
let kabir: User;

beforeAll(async () => {
  asha = await createUser({ email: "asha@example.com", username: "asha.v", name: "Asha Verma", password: "correct horse" });
  kabir = await createUser({ email: "kabir@example.com", username: "kabir", name: "Kabir Shah", password: "battery staple" });
  // Leaderboards list verified players only.
  markEmailVerified(asha.id);
  markEmailVerified(kabir.id);
  asha = findUserById(asha.id)!;
  kabir = findUserById(kabir.id)!;
});

describe("accounts", () => {
  it("logs in by email or username, case-insensitively", async () => {
    expect((await authenticate("ASHA@example.com", "correct horse")).id).toBe(asha.id);
    expect((await authenticate("Asha.V", "correct horse")).id).toBe(asha.id);
  });

  it("rejects a wrong password with a generic message", async () => {
    await expect(authenticate("asha.v", "wrong password")).rejects.toMatchObject({ code: "INVALID" });
    await expect(authenticate("nobody", "whatever1")).rejects.toBeInstanceOf(AuthError);
  });

  it("refuses duplicate emails and usernames", async () => {
    await expect(createUser({ email: "asha@example.com", username: "other", name: "X Y", password: "12345678" })).rejects.toMatchObject({ code: "EXISTS" });
    await expect(createUser({ email: "new@example.com", username: "KABIR", name: "X Y", password: "12345678" })).rejects.toMatchObject({ code: "EXISTS" });
  });

  it("never stores passwords or session tokens in plain text", () => {
    const row = getDb().prepare("SELECT password_hash FROM users WHERE id = ?").get(asha.id) as { password_hash: string };
    expect(row.password_hash.startsWith("scrypt$")).toBe(true);
    expect(row.password_hash).not.toContain("correct horse");
    const { token } = createSession(asha.id);
    const stored = getDb().prepare("SELECT token_hash FROM sessions").all() as { token_hash: string }[];
    expect(stored.some((s) => s.token_hash === token)).toBe(false);
  });

  it("sessions resolve to their user and can be revoked", () => {
    const { token } = createSession(kabir.id);
    expect(userForToken(token)?.id).toBe(kabir.id);
    deleteSession(token);
    expect(userForToken(token)).toBeNull();
    expect(userForToken("forged-token")).toBeNull();
  });

  it("remembers the patient language, English by default", () => {
    expect(findUserById(kabir.id)?.patientLang).toBe("en");
    setPatientLang(kabir.id, "hinglish");
    expect(findUserById(kabir.id)?.patientLang).toBe("hinglish");
    setPatientLang(kabir.id, "en");
  });

  it("Pro lapses when it expires", () => {
    setPlan(kabir.id, "pro", Date.now() - 1000);
    expect(findUserById(kabir.id)?.plan).toBe("free");
    setPlan(kabir.id, "pro", Date.now() + 86_400_000);
    expect(findUserById(kabir.id)?.plan).toBe("pro");
    setPlan(kabir.id, "free", null);
  });
});

describe("results and rewards", () => {
  const closedAcne = () => {
    const { hidden, state } = play(dermAcne, ["What brings you here?", "Examine the face", "Final diagnosis: acne vulgaris. Case close."]);
    return generateDebrief(dermAcne, hidden, state);
  };

  it("records a case once and returns what it earned", () => {
    const debrief = closedAcne();
    const rewards = recordCase(asha, "session-1", debrief);
    expect(rewards.xp).toBe(debrief.score.xp);
    expect(rewards.streakDays).toBe(1);
    expect(rewards.streakExtended).toBe(true);
    expect(rewards.newBadges.map((b) => b.id)).toContain("first-case");

    const again = recordCase(asha, "session-1", debrief);
    expect(again.streakExtended).toBe(false);
    expect(historyFor(asha.id)).toHaveLength(1);
    expect(progressFor(asha.id).casesCompleted).toBe(1);
  });

  it("counts case starts per IST day", () => {
    recordCaseStart(kabir.id, "s-a");
    recordCaseStart(kabir.id, "s-b");
    expect(casesStartedToday(kabir.id)).toBe(2);
  });

  it("ranks weekly boards by XP and filters by mode", () => {
    const { hidden, state } = play(phAcs, ["What happened?", "Call 108", "Chew aspirin 325 mg now", "Final diagnosis: acute coronary syndrome. Case close."]);
    recordCase(kabir, "session-phone", generateDebrief(phAcs, hidden, state));

    const overall = leaderboard("overall", "week", asha.id);
    expect(overall.rows.length).toBe(2);
    expect(overall.rows[0]!.xp).toBeGreaterThanOrEqual(overall.rows[1]!.xp);
    expect(overall.me?.userId).toBe(asha.id);

    const phone = leaderboard("phone", "week");
    expect(phone.rows.map((r) => r.userId)).toEqual([kabir.id]);
  });
});

describe("billing", () => {
  it("verifies the Razorpay signature and extends Pro exactly once", () => {
    getDb().prepare("INSERT INTO payments (id, user_id, provider, order_id, amount, period, status, created_at) VALUES ('p1', ?, 'razorpay', 'order_1', 29900, 'monthly', 'created', ?)").run(asha.id, Date.now());
    const signature = createHmac("sha256", "test-secret").update("order_1|pay_1").digest("hex");
    expect(() => verifyPayment(asha, { orderId: "order_1", paymentId: "pay_1", signature: "0".repeat(64) })).toThrow();

    verifyPayment(asha, { orderId: "order_1", paymentId: "pay_1", signature });
    const first = findUserById(asha.id)!;
    expect(first.plan).toBe("pro");
    verifyPayment(first, { orderId: "order_1", paymentId: "pay_1", signature });
    const second = findUserById(asha.id)!;
    expect(second.planExpiresAt).toBe(first.planExpiresAt);
    expect(second.planExpiresAt! - Date.now()).toBeLessThanOrEqual(30 * 86_400_000);
  });
});
