import { beforeAll, describe, expect, it } from "vitest";

import { istWeekStart } from "@/engine/progression";
import { createGuest, createUser, findUserById, markEmailVerified, type User } from "@/server/auth";
import { db } from "@/server/db";
import { demoXp, ensureMembership, leaguePosition, leagueView } from "@/server/leagues";
import { COHORT_SIZE, outcomeFor, zones } from "@/lib/leagues";

process.env.RAMAI_DB_PATH = ":memory:";
delete process.env.RAMAI_SEED_DEMO;

const DAY = 86_400_000;
const now = Date.now();
const thisWeek = istWeekStart(new Date(now));
const lastWeek = thisWeek - 7 * DAY;
let n = 0;

async function player(tier = 0): Promise<User> {
  n += 1;
  const u = await createUser({ email: `league${n}@example.com`, username: `league${n}`, name: `Dr. League ${n}`, password: "stethoscope" });
  await markEmailVerified(u.id);
  await db.run("UPDATE users SET league_tier = ? WHERE id = ?", tier, u.id);
  return (await findUserById(u.id))!;
}

async function earn(user: User, xp: number, at: number) {
  await db.run(
    "INSERT INTO results (user_id, session_id, case_ref, case_number, specialty, track, level, diagnosis, verdict, score, xp, created_at) VALUES (?, ?, 'c', 1, 'Emergency', 'emergency', 'chc', 'x', 'correct', 80, ?, ?)",
    user.id, `s-${user.id}-${at}-${xp}`, xp, at,
  );
}

describe("league rules", () => {
  it("top five move up and bottom five move down in a full group", () => {
    expect(zones(30, 0)).toEqual({ promote: 5, demote: 0 });
    expect(zones(30, 2)).toEqual({ promote: 5, demote: 5 });
    expect(zones(30, 5)).toEqual({ promote: 0, demote: 5 });
    expect(outcomeFor(5, 30, 2)).toBe("promoted");
    expect(outcomeFor(6, 30, 2)).toBe("stayed");
    expect(outcomeFor(26, 30, 2)).toBe("demoted");
  });

  it("a small group still lets the winner climb", () => {
    expect(zones(1, 0).promote).toBe(1);
    expect(outcomeFor(1, 3, 1)).toBe("promoted");
    expect(outcomeFor(3, 3, 1)).toBe("stayed");
  });
});

describe("joining a league", () => {
  it("unverified players and guests don't join", async () => {
    const u = await createUser({ email: "unverified.l@example.com", username: "unverified.l", name: "Dr. U", password: "stethoscope" });
    await earn(u, 100, now - 1000);
    expect(await ensureMembership(u)).toBeUndefined();
    expect((await leagueView(u)).status).toBe("unverified");
    expect((await leagueView(await createGuest())).status).toBe("guest");
  });

  it("a verified player joins with their first case of the week", async () => {
    const u = await player();
    expect((await leagueView(u)).status).toBe("waiting");
    await earn(u, 120, now - 1000);
    const m = await ensureMembership(u);
    expect(m?.tier).toBe(0);
    expect((await leagueView(u)).status).toBe("joined");
  });

  it("groups hold 30 players; the next one starts a new group", async () => {
    const week = thisWeek + DAY; // a fresh week of its own, so other tests don't share the groups
    const joined: number[] = [];
    for (let i = 0; i <= COHORT_SIZE; i++) {
      const u = await player(4);
      await earn(u, 100 + i, week + 1000);
      joined.push((await ensureMembership(u, week + 2000))!.cohort);
    }
    expect(joined.filter((c) => c === joined[0]).length).toBe(COHORT_SIZE);
    expect(new Set(joined).size).toBe(2);
  });
});

describe("standings", () => {
  let first: User;
  let second: User;
  beforeAll(async () => {
    first = await player(3);
    second = await player(3);
    await earn(first, 300, now - 2 * DAY < thisWeek ? thisWeek + 1 : now - 2 * DAY);
    await earn(second, 100, now - 2 * DAY < thisWeek ? thisWeek + 2 : now - 2 * DAY);
    await ensureMembership(first);
    await ensureMembership(second);
  });

  it("orders the group by this week's XP", async () => {
    expect((await leaguePosition(first))?.position).toBe(1);
    expect((await leaguePosition(second))?.position).toBe(2);
  });

  it("shows who moved in the last 24 hours", async () => {
    await earn(second, 400, now - 1000);
    const rows = (await leagueView(second)).rows;
    const me = rows.find((r) => r.userId === second.id)!;
    expect(me.position).toBe(1);
    if (now - 2 * DAY >= thisWeek) {
      expect(me.movement).toBe(1);
      expect(rows.find((r) => r.userId === first.id)!.movement).toBe(-1);
    }
  });
});

describe("the week settles", () => {
  it("promotes the top of last week's group and demotes the bottom", async () => {
    const group: User[] = [];
    for (let i = 0; i < 12; i++) {
      const u = await player(2);
      await earn(u, 1000 - i * 50, lastWeek + DAY);
      await ensureMembership(u, lastWeek + 2 * DAY);
      group.push(u);
    }
    const top = await leagueView((await findUserById(group[0]!.id))!);
    expect(top.lastWeek).toMatchObject({ rank: 1, outcome: "promoted", nextTier: 3 });
    expect(top.tier).toBe(3);
    const middle = await leagueView((await findUserById(group[6]!.id))!);
    expect(middle.lastWeek).toMatchObject({ outcome: "stayed", nextTier: 2 });
    const bottom = await leagueView((await findUserById(group[11]!.id))!);
    expect(bottom.lastWeek).toMatchObject({ rank: 12, outcome: "demoted", nextTier: 1 });

    // Their first case this week puts them in the new league.
    const promoted = (await findUserById(group[0]!.id))!;
    await earn(promoted, 90, now - 500);
    expect((await ensureMembership(promoted))?.tier).toBe(3);
  });
});

describe("demo doctors", () => {
  it("have deterministic weekly XP that only grows through the week", () => {
    const id = "demo-doctor";
    const early = demoXp(id, thisWeek, 1, thisWeek + 2 * DAY);
    const late = demoXp(id, thisWeek, 1, thisWeek + 6 * DAY);
    expect(demoXp(id, thisWeek, 1, thisWeek + 2 * DAY)).toBe(early);
    expect(late).toBeGreaterThanOrEqual(early);
  });
});
