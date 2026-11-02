/** Inventing costs credit: only when the doctor is running out of unmet cases, and one at a time. */
import { beforeAll, describe, expect, it, vi } from "vitest";

const createCase = vi.fn(async () => ({ kind: "library", id: "x" }));
vi.mock("@/engine/providers", () => ({ getProvider: async () => ({ id: "openai", createCase }) }));
vi.mock("@/server/case-check", () => ({ checkCase: async () => ({ status: "passed", errors: [] }) }));

import { filterCases } from "@/engine/cases";
import { createProfile, type User } from "@/server/auth";
import { prepareNext } from "@/server/case-pool";
import { db } from "@/server/db";

process.env.RAMAI_DB_PATH = ":memory:";

let asha: User;
const choice = { track: "emergency" as const, country: "IN" as const, lang: "en" as const };

beforeAll(async () => {
  asha = await createProfile({ email: "gate@example.com", username: "gate", name: "Dr. Gate" });
});

describe("the next patient is invented only when needed", () => {
  it("two or more unmet: nothing is invented", async () => {
    expect(filterCases(choice).length).toBeGreaterThanOrEqual(2);
    expect(await prepareNext(asha.id, choice, {} as never)).toBe("skipped");
    expect(createCase).not.toHaveBeenCalled();
  });

  it("fewer than two: one is, but not while another is being written", async () => {
    for (const c of filterCases(choice)) {
      await db.run("INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, score, xp, created_at) VALUES (?, ?, ?, 1, 'Medicine', 'phone', 'phc', 'x', 1, 1, ?)", asha.id, `g-${c.id}`, c.id, Date.now());
    }
    await db.run("INSERT INTO case_pool (id, user_id, pool_key, src, created_at) VALUES ('w1', ?, 'someone-else', '', ?)", asha.id, Date.now());
    expect(await prepareNext(asha.id, choice, {} as never)).toBe("writing");
    expect(createCase).not.toHaveBeenCalled();
    await db.run("DELETE FROM case_pool WHERE id = 'w1'");
    await prepareNext(asha.id, choice, {} as never);
    expect(createCase).toHaveBeenCalledTimes(1);
  });
});
