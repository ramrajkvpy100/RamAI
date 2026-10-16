import { beforeAll, describe, expect, it } from "vitest";

import { createProfile, type User } from "@/server/auth";
import { poolKey, takeReady, type PoolChoice } from "@/server/case-pool";
import { db } from "@/server/db";

process.env.RAMAI_DB_PATH = ":memory:";

let asha: User;
const usual: PoolChoice = { specialty: "Medicine", easy: false, country: "IN", lang: "en" };
const ready = JSON.stringify({ kind: "library", id: "med-pad" });

beforeAll(async () => {
  asha = await createProfile({ email: "asha@example.com", username: "asha", name: "Dr. Asha Verma" });
});

describe("patients written ahead of time", () => {
  it("a ready patient for exactly this choice is taken once; one still being written, or another choice's, is not", async () => {
    const now = Date.now();
    await db.run("INSERT INTO case_pool (id, user_id, pool_key, src, created_at) VALUES ('p1', ?, ?, ?, ?)", asha.id, poolKey(usual), ready, now);
    await db.run("INSERT INTO case_pool (id, user_id, pool_key, src, created_at) VALUES ('p2', ?, ?, '', ?)", asha.id, poolKey({ ...usual, specialty: "Surgery" }), now);

    expect(await takeReady(asha.id, { ...usual, specialty: "Surgery" })).toBeNull();
    expect(await takeReady(asha.id, { ...usual, track: "emergency" })).toBeNull();
    expect(await takeReady(asha.id, usual)).toEqual({ kind: "library", id: "med-pad" });
    expect(await takeReady(asha.id, usual)).toBeNull();
  });

  it("a stale one isn't served", async () => {
    await db.run("INSERT INTO case_pool (id, user_id, pool_key, src, created_at) VALUES ('p3', ?, ?, ?, ?)", asha.id, poolKey(usual), ready, Date.now() - 7 * 3_600_000);
    expect(await takeReady(asha.id, usual)).toBeNull();
  });
});

import { bankCase, bankHas, takeFromBank } from "@/server/case-pool";
describe("the case bank: invented once, met by many", () => {
  it("another doctor meets a banked patient once; its first doctor never meets it again", async () => {
    const ravi = await createProfile({ email: "ravi2@example.com", username: "ravi2", name: "Ravi" });
    const src = { kind: "generated", def: { id: "g1" } } as never;
    await bankCase(asha.id, src, { specialty: "Medicine", track: "opd", level: "district", easy: false, country: "IN", lang: "en" });
    expect(await takeFromBank(asha.id, usual)).toBeNull();
    expect(await bankHas(ravi.id, usual)).toBe(true);
    expect(await takeFromBank(ravi.id, usual)).toEqual(src);
    expect(await takeFromBank(ravi.id, usual)).toBeNull();
  });
});
