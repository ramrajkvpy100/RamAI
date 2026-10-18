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
  it("every account has a 5-case trial; a friend's link gives you both 5 more, once", async () => {
    const neha = await createProfile({ email: "neha@example.com", username: "neha", name: "Neha" });
    expect(await creditsLeft(neha.id)).toBe(5);
    expect(await useCredit(neha.id)).toBe(true);
    await creditReferral(neha.id, "asha");
    await creditReferral(neha.id, "asha");
    expect(await creditsLeft(neha.id)).toBe(9);
    expect(await creditsLeft(asha.id)).toBe(10);
    await creditReferral(asha.id, "asha");
    expect(await creditsLeft(asha.id)).toBe(10);
  });
});
