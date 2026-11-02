/** Inventing costs credit: only when the doctor is running out of unmet cases, and one at a time. */
import { beforeAll, describe, expect, it, vi } from "vitest";

const createCase = vi.fn(async () => ({ kind: "library", id: "x" }));
vi.mock("@/engine/providers", () => ({ getProvider: async () => ({ id: "openai", createCase }) }));
vi.mock("@/server/case-check", () => ({ checkCase: async () => ({ status: "passed", errors: [] }) }));

import { filterCases } from "@/engine/cases";
import { createProfile, type User } from "@/server/auth";
import { dropWritingLock, prepareNext, takeWritingLock } from "@/server/case-pool";
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
    // Another server holds the lock.
    expect(await takeWritingLock("another-server")).toBe(true);
    expect(await prepareNext(asha.id, choice, {} as never)).toBe("writing");
    expect(createCase).not.toHaveBeenCalled();
    await dropWritingLock("another-server");
    await prepareNext(asha.id, choice, {} as never);
    expect(createCase).toHaveBeenCalledTimes(1);
  });

  it("20 doctors at once, on any number of servers: one patient is written, and the lock frees itself", async () => {
    createCase.mockClear();
    const doctors = await Promise.all(Array.from({ length: 20 }, (_, i) => createProfile({ email: `race${i}@example.com`, username: `race${i}`, name: "Dr. Race" })));
    const none = { specialty: "None" as never, country: "IN" as const, lang: "en" as const };
    await Promise.all(doctors.map((d) => prepareNext(d.id, none, {} as never)));
    expect(createCase).toHaveBeenCalledTimes(1);
    // The lock itself is atomic: with no help from this server's own flag, 20 takers get one winner.
    const taken = await Promise.all(Array.from({ length: 20 }, (_, i) => takeWritingLock(`taker-${i}`)));
    expect(taken.filter(Boolean)).toHaveLength(1);
    // If its holder dies, it's free again after 90 seconds.
    expect(await takeWritingLock("later", Date.now() + 91_000)).toBe(true);
    await dropWritingLock("later");
  });
});
