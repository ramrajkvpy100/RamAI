import { describe, expect, it } from "vitest";

import { CASE_LIBRARY, dailyCase } from "@/engine/cases";
import { generateDebrief } from "@/engine/debrief";
import { sessionInfo, simulateCase } from "@/engine/engine";
import { dailyEndsAt, dailyKeyFor, dailyNumber, shareText, squares } from "@/lib/daily";
import { createUser, markEmailVerified } from "@/server/auth";
import { casesStartedToday, dailyBoard, recordCase, recordCaseStart } from "@/server/results";

import { play } from "./helpers";

process.env.RAMAI_DB_PATH = ":memory:";
process.env.RAMAI_SESSION_SECRET = "test-secret-test-secret-test-secret-123";

describe("choosing the daily case", () => {
  it("is the same for everyone on a day, never India-only, and runs every case before repeating", () => {
    expect(dailyCase("2026-10-10").id).toBe(dailyCase("2026-10-10").id);
    const shared = CASE_LIBRARY.filter((c) => !c.countries);
    const days = Array.from({ length: shared.length }, (_, i) => new Date(Date.UTC(2026, 9, 10 + i)).toISOString().slice(0, 10));
    const ids = days.map((d) => dailyCase(d).id);
    expect(new Set(ids).size).toBe(shared.length);
    expect(ids).not.toContain("em-viper-phc-01");
  });

  it("numbers days from launch and changes at midnight IST", () => {
    expect(dailyNumber("2026-10-10")).toBe(1);
    expect(dailyNumber("2026-11-09")).toBe(31);
    expect(dailyKeyFor(Date.parse("2026-10-10T18:29:00Z"))).toBe("2026-10-10");
    expect(dailyKeyFor(Date.parse("2026-10-10T18:31:00Z"))).toBe("2026-10-11");
    expect(dailyEndsAt("2026-10-10")).toBe(Date.parse("2026-10-11T00:00:00+05:30"));
  });
});

describe("the share card", () => {
  it("shows squares, score and time — never the diagnosis", () => {
    const def = dailyCase("2026-10-12");
    const { hidden, state } = play(def, ["What brings you here?", "Check vitals", "Case close."]);
    const debrief = generateDebrief(def, hidden, state);
    const text = shareText({ number: 3, score: debrief.score, minutes: debrief.elapsedMin, url: "https://ram.example" });
    expect(text.split("\n")[0]).toMatch(/^RamAI Daily #3 — \d+\/100$/);
    expect(squares(debrief.score).split("\n")).toHaveLength(2);
    expect(squares(debrief.score).replace(/\n/g, "")).toMatch(/^[🟩🟨🟥⬜]{10}$/u);
    expect(text.toLowerCase()).not.toContain(debrief.diagnosis.toLowerCase());
  });
});

describe("playing it", () => {
  it("ranks only the first attempt of the day and doesn't use up free cases", async () => {
    const dayKey = dailyKeyFor();
    const user = await createUser({ email: "daily@example.com", username: "daily.doc", name: "Dr. Daily", password: "quiet harbour 77" });
    await markEmailVerified(user.id);

    const first = await simulateCase({ userId: user.id, caseNumber: 1, daily: dayKey });
    expect(first.state.daily).toBe(dayKey);
    expect(sessionInfo(first.token).daily).toBe(dayKey);
    await recordCaseStart(user.id, first.state.sessionId, false, dayKey);
    const second = await simulateCase({ userId: user.id, caseNumber: 2, daily: dayKey });
    await recordCaseStart(user.id, second.state.sessionId, false, dayKey);
    expect(await casesStartedToday(user.id)).toBe(0);

    const def = dailyCase(dayKey);
    const { hidden, state } = play(def, ["What brings you here?", "Case close."]);
    const debrief = generateDebrief(def, hidden, state);
    const practice = await recordCase(user, second.state.sessionId, debrief, { daily: dayKey });
    expect(practice.daily?.ranked).toBe(false);
    const ranked = await recordCase(user, first.state.sessionId, debrief, { daily: dayKey });
    expect(ranked.daily).toMatchObject({ ranked: true, position: 1, total: 1 });

    const board = await dailyBoard(dayKey, user.id);
    expect(board.total).toBe(1);
    expect(board.me?.grid).toMatch(/[🟩🟨🟥⬜]/u);
  });
});
