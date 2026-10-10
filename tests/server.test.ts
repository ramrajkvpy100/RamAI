import { createHmac } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { phAcs } from "@/engine/cases/ph-acs";
import { generateDebrief } from "@/engine/debrief";
import { createGuest, createProfile, createSession, deleteSession, findUserById, guestForToken, setPatientLang, setPlan, type User } from "@/server/auth";
import { verifyPayment } from "@/server/billing";
import { db } from "@/server/db";
import { casesStartedToday, historyFor, leaderboard, progressFor, recordCase, recordCaseStart } from "@/server/results";

import { play } from "./helpers";

process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAZORPAY_KEY_SECRET = "test-secret";

let asha: User;
let kabir: User;

beforeAll(async () => {
  asha = await createProfile({ email: "asha@example.com", username: "asha.v", name: "Asha Verma" });
  kabir = await createProfile({ email: "kabir@example.com", username: "kabir", name: "Kabir Shah" });
});

describe("accounts", () => {
  it("refuses duplicate emails and usernames, case-insensitively", async () => {
    await expect(createProfile({ email: "ASHA@example.com", username: "other", name: "X Y" })).rejects.toMatchObject({ code: "EXISTS" });
    await expect(createProfile({ email: "new@example.com", username: "KABIR", name: "X Y" })).rejects.toMatchObject({ code: "EXISTS" });
  });

  it("keeps no passwords — Supabase does — and only hashes of guests' session tokens", async () => {
    const row = (await db.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", asha.id))!;
    expect(row.password_hash).toBe("!supabase");
    const guest = await createGuest();
    const { token } = await createSession(guest.id);
    const stored = await db.all<{ token_hash: string }>("SELECT token_hash FROM sessions");
    expect(stored.some((s) => s.token_hash === token)).toBe(false);
  });

  it("guest sessions resolve, can be revoked, and never sign in a real account", async () => {
    const guest = await createGuest();
    const { token } = await createSession(guest.id);
    expect((await guestForToken(token))?.id).toBe(guest.id);
    await deleteSession(token);
    expect(await guestForToken(token)).toBeNull();
    expect(await guestForToken("forged-token")).toBeNull();
    const { token: old } = await createSession(kabir.id);
    expect(await guestForToken(old)).toBeNull();
  });

  it("remembers the patient language, English by default", async () => {
    expect((await findUserById(kabir.id))?.patientLang).toBe("en");
    await setPatientLang(kabir.id, "hinglish");
    expect((await findUserById(kabir.id))?.patientLang).toBe("hinglish");
    await setPatientLang(kabir.id, "en");
  });

  it("Pro lapses when it expires", async () => {
    await setPlan(kabir.id, "pro", Date.now() - 1000);
    expect((await findUserById(kabir.id))?.plan).toBe("free");
    await setPlan(kabir.id, "pro", Date.now() + 86_400_000);
    expect((await findUserById(kabir.id))?.plan).toBe("pro");
    await setPlan(kabir.id, "free", null);
  });
});

describe("results and rewards", () => {
  const closedAcne = () => {
    const { hidden, state } = play(dermAcne, ["What brings you here?", "Examine the face", "Final diagnosis: acne vulgaris. Case close."]);
    return generateDebrief(dermAcne, hidden, state);
  };

  it("records a case once and returns what it earned", async () => {
    const debrief = closedAcne();
    const rewards = await recordCase(asha, "session-1", debrief);
    expect(rewards.xp).toBe(debrief.score.xp);
    expect(rewards.streakDays).toBe(1);
    expect(rewards.streakExtended).toBe(true);
    expect(rewards.newBadges.map((b) => b.id)).toContain("first-case");

    const again = await recordCase(asha, "session-1", debrief);
    expect(again.streakExtended).toBe(false);
    expect(await historyFor(asha.id)).toHaveLength(1);
    expect((await progressFor(asha.id)).casesCompleted).toBe(1);
  });

  it("counts case starts per IST day", async () => {
    await recordCaseStart(kabir.id, "s-a");
    await recordCaseStart(kabir.id, "s-b");
    expect(await casesStartedToday(kabir.id)).toBe(2);
  });

  it("ranks weekly boards by XP and filters by mode", async () => {
    const { hidden, state } = play(phAcs, ["What happened?", "Call 108", "Chew aspirin 325 mg now", "Final diagnosis: acute coronary syndrome. Case close."]);
    await recordCase(kabir, "session-phone", generateDebrief(phAcs, hidden, state));

    const overall = await leaderboard("overall", "week", asha.id);
    expect(overall.rows.length).toBe(2);
    expect(overall.rows[0]!.xp).toBeGreaterThanOrEqual(overall.rows[1]!.xp);
    expect(overall.me?.userId).toBe(asha.id);

    const phone = await leaderboard("phone", "week");
    expect(phone.rows.map((r) => r.userId)).toEqual([kabir.id]);
  });
});

describe("billing", () => {
  it("verifies the Razorpay signature and extends Pro exactly once", async () => {
    await db.run("INSERT INTO payments (id, user_id, provider, order_id, amount, period, status, created_at) VALUES ('p1', ?, 'razorpay', 'order_1', 29900, 'monthly', 'created', ?)", asha.id, Date.now());
    const signature = createHmac("sha256", "test-secret").update("order_1|pay_1").digest("hex");
    await expect(verifyPayment(asha, { orderId: "order_1", paymentId: "pay_1", signature: "0".repeat(64) })).rejects.toThrow();

    await verifyPayment(asha, { orderId: "order_1", paymentId: "pay_1", signature });
    const first = (await findUserById(asha.id))!;
    expect(first.plan).toBe("pro");
    await verifyPayment(first, { orderId: "order_1", paymentId: "pay_1", signature });
    const second = (await findUserById(asha.id))!;
    expect(second.planExpiresAt).toBe(first.planExpiresAt);
    expect(second.planExpiresAt! - Date.now()).toBeLessThanOrEqual(30 * 86_400_000);
  });
});
