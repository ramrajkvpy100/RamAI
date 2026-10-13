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
