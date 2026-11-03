import { db } from "@/server/db";
import { beforeAll, describe, expect, it } from "vitest";

import { createProfile, type User } from "@/server/auth";
import { createDuel, duelView, findOpenDuel, joinDuel, recordDuelScore } from "@/server/duels";

process.env.RAMAI_DB_PATH = ":memory:";

let asha: User;
let ravi: User;
const src = { kind: "library", id: "med-pad" } as const;

beforeAll(async () => {
  asha = await createProfile({ email: "asha@example.com", username: "asha", name: "Asha" });
  ravi = await createProfile({ email: "ravi@example.com", username: "ravi", name: "Ravi" });
});

describe("duels: two doctors, one patient", () => {
  it("a friend joins with the link, plays the same case, and the higher score wins", async () => {
    await createDuel("aaaaaaaaaaaa", "invite", { id: asha.id, name: "Asha" }, src);
    expect((await duelView("aaaaaaaaaaaa", asha.id))?.waiting).toBe(true);
    expect(await joinDuel("aaaaaaaaaaaa", { id: ravi.id, name: "Ravi" })).toEqual(src);
    await recordDuelScore("aaaaaaaaaaaa", asha.id, 80);
    await recordDuelScore("aaaaaaaaaaaa", ravi.id, 65);
    const v = await duelView("aaaaaaaaaaaa", ravi.id);
    expect(v?.you.score).toBe(65);
    expect(v?.them?.score).toBe(80);
  });

  it("someone looking for a game is matched with an open one, never their own", async () => {
    await createDuel("bbbbbbbbbbbb", "find", { id: asha.id, name: "Asha" }, src);
    expect(await findOpenDuel({ id: asha.id, name: "Asha" })).toBeNull();
    expect((await findOpenDuel({ id: ravi.id, name: "Ravi" }))?.id).toBe("bbbbbbbbbbbb");
  });

  it("the computer's score shows once you've finished", async () => {
    await createDuel("cccccccccccc", "computer", { id: asha.id, name: "Asha" }, src);
    expect((await duelView("cccccccccccc", asha.id))?.them?.score).toBeNull();
    await recordDuelScore("cccccccccccc", asha.id, 70);
    const s = (await duelView("cccccccccccc", asha.id))?.them?.score ?? 0;
    expect(s).toBeGreaterThanOrEqual(68);
    expect(s).toBeLessThanOrEqual(92);
  });
});

import { creditReferral, creditsLeft, useCredit } from "@/server/credits";
describe("free Pro cases", () => {
  it("every account has a 5-case trial, and a referral is remembered once, never for yourself", async () => {
    const neha = await createProfile({ email: "neha@example.com", username: "neha", name: "Neha" });
    expect(await creditsLeft(neha.id)).toBe(5);
    expect(await useCredit(neha.id)).toBe(true);
    await creditReferral(neha.id, "asha");
    await creditReferral(neha.id, "asha");
    expect(await creditsLeft(neha.id)).toBe(4);
    const row = await db.get<{ referred_by: string }>("SELECT referred_by FROM case_credits WHERE user_id = ?", neha.id);
    expect(row?.referred_by).toBe(asha.id);
    await creditReferral(asha.id, "asha");
    expect((await db.get<{ referred_by: string | null }>("SELECT referred_by FROM case_credits WHERE user_id = ?", asha.id))?.referred_by ?? null).toBeNull();
  });

  it("the ladder pays when a colleague finishes a case: each step once", async () => {
    const host = await createProfile({ email: "host@example.com", username: "host", name: "Host" });
    const finish = async (n: string) => {
      const f = await createProfile({ email: `${n}@example.com`, username: n, name: n });
      await creditReferral(f.id, "host");
      return f;
    };
    const tier = async () => db.get<{ invite_tier: number; plan: string; plan_expires_at: number }>("SELECT invite_tier, plan, plan_expires_at FROM users WHERE id = ?", host.id);
    const play = (id: string, s: string) => db.run("INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, score, xp, created_at) VALUES (?, ?, 'x', 1, 'Medicine', 'opd', 'phc', 'x', 80, 10, ?)", id, s, Date.now());
    const f1 = await finish("f1");
    // Signed in, but no case yet: nothing.
    await settleInviterOf(f1.id);
    expect((await tier())?.invite_tier).toBe(0);
    await play(f1.id, "s1");
    await settleInviterOf(f1.id);
    expect((await tier())?.invite_tier).toBe(1);
    const afterOne = (await tier())!.plan_expires_at;
    expect((await tier())?.plan).toBe("pro");
    expect(afterOne).toBeGreaterThan(Date.now() + 2.9 * 86_400_000);
    // Running it again pays nothing more.
    await settleInviterOf(f1.id);
    expect((await tier())!.plan_expires_at).toBe(afterOne);
    for (const n of ["f2", "f3"]) {
      const f = await finish(n);
      await play(f.id, `s-${n}`);
      await settleInviterOf(f.id);
    }
    expect((await tier())?.invite_tier).toBe(3);
    expect((await tier())!.plan_expires_at).toBeGreaterThan(afterOne + 13.9 * 86_400_000);
    for (const n of ["f4", "f5"]) {
      const f = await finish(n);
      await play(f.id, `s-${n}`);
      await settleInviterOf(f.id);
    }
    expect((await tier())?.invite_tier).toBe(5);
    expect(dailyLimitFor({ plan: "free", isGuest: false, inviteTier: 1 })).toBe(5);
    expect(dailyLimitFor({ plan: "free", isGuest: false, inviteTier: 0 })).toBe(3);
    expect(dailyLimitFor({ plan: "free", isGuest: true })).toBe(2);
  });
});

import { dailyLimitFor } from "@/lib/plans";
import { settleInviterOf } from "@/server/credits";
import { createGroup, joinGroup, myGroups } from "@/server/groups";
describe("private groups", () => {
  it("a class joins by code and sees itself ranked", async () => {
    const code = await createGroup(asha.id, "AIIMS batch 2026");
    expect(await joinGroup(ravi.id, code.toLowerCase())).toBe(true);
    expect(await joinGroup(ravi.id, "ZZZZZZ")).toBe(false);
    const [g] = await myGroups(ravi.id);
    expect(g?.name).toBe("AIIMS batch 2026");
    expect(g?.members.map((m) => m.name).sort()).toEqual(["Asha", "Ravi"]);
  });
});
