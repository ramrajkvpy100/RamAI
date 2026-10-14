import { beforeAll, describe, expect, it } from "vitest";

import { dermAcne } from "@/engine/cases/derm-acne";
import { phAcs } from "@/engine/cases/ph-acs";
import { generateDebrief } from "@/engine/debrief";
import { createGuest, createProfile, createSession, deleteSession, findUserById, guestForToken, setPatientLang, setPlan, type User } from "@/server/auth";
import { db } from "@/server/db";
import { casesStartedToday, historyFor, leaderboard, progressFor, recordCase, recordCaseStart } from "@/server/results";
import { ownResultId, progressCard, readShareId, resultCard, shareIdFor } from "@/server/share";
import { answerSuggestion, deleteSuggestion, mySuggestions, sendOpenSuggestion } from "@/server/suggestions";
import { dailyKeyFor } from "@/lib/daily";

import { play } from "./helpers";

process.env.RAMAI_DB_PATH = ":memory:";

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

describe("sharing a result or progress", () => {
  it("links are signed: a forged or altered one shows nothing", () => {
    const id = shareIdFor("r", 42);
    expect(readShareId(id)).toEqual({ kind: "r", value: "42" });
    expect(readShareId(id.replace("r42", "r43"))).toBeNull();
    expect(readShareId("r42.AAAAAAAAAAAAAAAA")).toBeNull();
    expect(readShareId(shareIdFor("u", asha.id))).toEqual({ kind: "u", value: asha.id });
  });

  it("only your own result; a daily case's card never names the diagnosis; first names only", async () => {
    const { hidden, state } = play(dermAcne, ["What brings you here?", "Final diagnosis: acne vulgaris. Case close."]);
    const debrief = generateDebrief(dermAcne, hidden, state);
    const day = dailyKeyFor();
    await recordCaseStart(asha.id, "share-daily", false, day);
    await recordCase(asha, "share-daily", debrief, { daily: day });
    const id = (await ownResultId(asha.id, "share-daily"))!;
    expect(await ownResultId(kabir.id, "share-daily")).toBeNull();
    const card = (await resultCard(id))!;
    expect(card).toMatchObject({ kind: "result", name: "Dr. Asha", diagnosis: null, score: debrief.score.total });
    expect(card.daily?.grid).toBeTruthy();
    expect(await progressCard(asha.id)).toMatchObject({ kind: "progress", name: "Dr. Asha" });
  });
});

describe("suggestions without an account", () => {
  it("guests and visitors can send one; the guest sees theirs, answered; an admin can remove one", async () => {
    const guest = await createGuest();
    const mine = await sendOpenSuggestion(guest, { category: "idea", message: "More ECG cases, please." });
    const visitor = await sendOpenSuggestion(null, { category: "problem", message: "The menu is hard to read.", email: "Visitor@Example.com " });
    expect(mine.id).toMatch(/^g-/);
    expect(await db.get("SELECT name, email, user_id FROM open_suggestions WHERE id = ?", visitor.id)).toEqual({ name: "Visitor", email: "visitor@example.com", user_id: null });

    const answered = await answerSuggestion(mine.id, { status: "planned", reply: "Coming next week." });
    expect(answered).toMatchObject({ status: "planned", reply: "Coming next week.", name: "Guest doctor" });
    expect((await mySuggestions(guest)).map((s) => [s.message, s.reply])).toEqual([["More ECG cases, please.", "Coming next week."]]);

    await deleteSuggestion(visitor.id);
    await expect(deleteSuggestion(visitor.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

