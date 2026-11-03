import { beforeEach, describe, expect, it, vi } from "vitest";

import { complete, getActive, getDone, giveUp, growthOf, startGrove, stop, startBreak, totalOf } from "@/lib/focus";
import { breakMinutes, DURATIONS, focusedMinutes, focusXp, getGrove, isUnlocked, mergeRecords, nextUnlock, PLANT_IDS, PLANTS, plantedRecord, plotOf, stageOf, STAGE_FROM, streaks, unlockedPlants, witheredRecord, withinStage, type GroveRecord } from "@/lib/grove";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => {
  store.clear();
  vi.useRealTimers();
});

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const planted = (at: number, minutes = 25): GroveRecord => plantedRecord({ plant: "salix", minutes, startedAt: at, at });

describe("stages", () => {
  it("changes exactly at the thresholds", () => {
    expect(stageOf(0)).toBe("seed");
    expect(stageOf(0.1499)).toBe("seed");
    expect(stageOf(0.15)).toBe("sprout");
    expect(stageOf(0.3499)).toBe("sprout");
    expect(stageOf(0.35)).toBe("sapling");
    expect(stageOf(0.6499)).toBe("sapling");
    expect(stageOf(0.65)).toBe("canopy");
    expect(stageOf(0.9)).toBe("canopy");
    expect(stageOf(0.9999)).toBe("canopy");
    expect(stageOf(1)).toBe("flowering");
    expect(STAGE_FROM.flowering).toBe(1);
  });
  it("grows smoothly inside a stage", () => {
    expect(withinStage(0.15)).toBe(0);
    expect(withinStage(0.25)).toBeCloseTo(0.5);
    expect(withinStage(1)).toBe(1);
  });
});

describe("the plants", () => {
  it("offers the six durations, with a break for each", () => {
    expect([...DURATIONS]).toEqual([15, 25, 45, 60, 90, 120]);
    expect(DURATIONS.map(breakMinutes)).toEqual([5, 5, 10, 10, 15, 20]);
  });
  it("keeps the pharmacology straight", () => {
    expect(PLANTS.cinchona.pearl).toMatch(/quinine/);
    expect(PLANTS.cinchona.drug).not.toMatch(/artesunate|artemisinin/i);
    expect(PLANTS.cinchona.pearl).toMatch(/does not come from Cinchona/);
    expect(PLANTS.artemisia.pearl).toMatch(/artemisinin/);
    expect(PLANTS.colchicum.pearl).toMatch(/colchicine/);
    expect(PLANTS.colchicum.pearl).not.toMatch(/morphine/);
    expect(PLANTS.papaver.pearl).toMatch(/morphine/);
    expect(PLANTS.papaver.pearl).not.toMatch(/colchicine/);
    expect(PLANTS.digitalis.pearl).toMatch(/D\. lanata/);
    expect(PLANTS.penicillium.kind).toBe("culture");
    expect(PLANTS.penicillium.pearl).toMatch(/not a tree/);
    expect(PLANTS.taxus.stages.flowering).toBe("Red arils");
    for (const id of PLANT_IDS) expect(PLANTS[id].pearl.length).toBeGreaterThan(40);
  });
});

describe("a session", () => {
  const T0 = day(2026, 11, 3, 9);

  it("giving up withers the plant at the stage it reached, and it stays on record", () => {
    vi.useFakeTimers({ now: T0 });
    startGrove("digitalis", 60, "cardiology");
    vi.setSystemTime(T0 + 30 * 60_000); // 50%: a sapling
    const r = giveUp();
    expect(r).toMatchObject({ plant: "digitalis", status: "withered", stage: "sapling", minutes: 30, planned: 60 });
    expect(getActive()).toBeNull();
    expect(getGrove()).toEqual([r]);
    // What was studied still counts for today; the widgets read this.
    expect(getDone().at(-1)).toMatchObject({ name: "cardiology", minutes: 30 });
    // Withered plants earn nothing.
    expect(focusXp(getGrove())).toBe(0);
    expect(focusedMinutes(getGrove())).toBe(0);
    expect(streaks(getGrove(), Date.now()).longest).toBe(0);
  });

  it("the stop action can't dodge the withering", () => {
    vi.useFakeTimers({ now: T0 });
    startGrove("salix", 25, "");
    vi.setSystemTime(T0 + 60_000);
    stop();
    expect(getGrove()[0]).toMatchObject({ status: "withered", stage: "seed" });
  });

  it("a completed session is planted once, dated when it ended, then the break waits", () => {
    vi.useFakeTimers({ now: T0 });
    startGrove("cinchona", 45, "malaria");
    const started = getActive()!;
    expect(totalOf(started)).toBe(45 * 60_000);
    vi.setSystemTime(T0 + 10 * 3_600_000); // Opened the app long after it ended.
    expect(complete()).toBe("focus-done");
    expect(getGrove()).toHaveLength(1);
    expect(getGrove()[0]).toMatchObject({ plant: "cinchona", status: "planted", stage: "flowering", minutes: 45, planned: 45, at: T0 + 45 * 60_000 });
    expect(getDone().at(-1)).toMatchObject({ minutes: 45 });
    const a = getActive()!;
    expect(a.phase).toBe("break");
    expect(a.endsAt).toBeNull();
    expect(growthOf(a)).toBe(1);
    startBreak();
    expect(totalOf(getActive()!)).toBe(10 * 60_000);
    // Nothing to give up by now, and leaving the break keeps the plant.
    expect(giveUp()).toBeNull();
    stop();
    expect(getActive()).toBeNull();
    expect(getGrove()).toHaveLength(1);
    expect(getGrove()[0]!.status).toBe("planted");
  });

  it("giving up after the time has run out counts as completing it", () => {
    vi.useFakeTimers({ now: T0 });
    startGrove("salix", 15, "");
    vi.setSystemTime(T0 + 16 * 60_000);
    expect(giveUp()).toBeNull();
    expect(getGrove()[0]!.status).toBe("planted");
  });

  it("growth tracks the clock", () => {
    vi.useFakeTimers({ now: T0 });
    startGrove("salix", 100 as never, "");
    expect(growthOf(getActive()!, T0 + 35 * 60_000)).toBeCloseTo(0.35);
  });

  it("a withered plant is never flowering, however close", () => {
    expect(witheredRecord({ plant: "salix", planned: 25, progress: 1, startedAt: 1, at: 2 }).stage).toBe("canopy");
  });
});

describe("streaks", () => {
  const now = day(2026, 11, 3);
  it("counts days in a row, not sessions", () => {
    const list = [planted(day(2026, 11, 3)), planted(day(2026, 11, 3, 15)), planted(day(2026, 11, 2)), planted(day(2026, 11, 1))];
    expect(streaks(list, now)).toEqual({ current: 3, longest: 3 });
  });
  it("yesterday's streak stands until today is over, then breaks", () => {
    const list = [planted(day(2026, 11, 2)), planted(day(2026, 11, 1))];
    expect(streaks(list, now).current).toBe(2);
    expect(streaks(list, day(2026, 11, 4)).current).toBe(0);
    expect(streaks(list, day(2026, 11, 4)).longest).toBe(2);
  });
  it("keeps the longest after a gap, across a month end", () => {
    const list = [planted(day(2026, 10, 30)), planted(day(2026, 10, 31)), planted(day(2026, 11, 1)), planted(day(2026, 11, 3))];
    expect(streaks(list, now)).toEqual({ current: 1, longest: 3 });
  });
  it("ignores withered plants", () => {
    const list = [witheredRecord({ plant: "salix", planned: 25, progress: 0.5, startedAt: now, at: now })];
    expect(streaks(list, now)).toEqual({ current: 0, longest: 0 });
  });
  it("is empty with nothing planted", () => {
    expect(streaks([], now)).toEqual({ current: 0, longest: 0 });
  });
});

describe("plots and focus XP", () => {
  // 2026-11-04 is a Wednesday: this week began on Monday the 2nd.
  const now = day(2026, 11, 4);
  const list = [planted(day(2026, 11, 1)), planted(day(2026, 11, 2)), planted(day(2026, 11, 4)), planted(day(2026, 11, 4, 18), 60)];
  it("sorts into today, this week and all time", () => {
    expect(plotOf(list, "today", now)).toHaveLength(2);
    expect(plotOf(list, "week", now)).toHaveLength(3);
    expect(plotOf(list, "all", now)).toHaveLength(4);
  });
  it("a Sunday still belongs to the week that began on Monday", () => {
    expect(plotOf(list, "week", day(2026, 11, 8))).toHaveLength(3);
  });
  it("gives 1 XP a minute and 10 for each day's first plant", () => {
    expect(focusedMinutes(list)).toBe(135);
    expect(focusXp(list)).toBe(135 + 3 * 10);
  });
  it("merges each session once", () => {
    const a = planted(5);
    expect(mergeRecords([a, planted(9)], [a])).toHaveLength(2);
    expect(mergeRecords([planted(9)], [a]).map((r) => r.at)).toEqual([5, 9]);
  });
});

describe("rare plants", () => {
  it("opens with the commons and unlocks rare ones by completed sessions", () => {
    expect(unlockedPlants(0)).toEqual(["salix", "digitalis", "cinchona", "artemisia", "papaver"]);
    expect(isUnlocked("catharanthus", 2)).toBe(false);
    expect(isUnlocked("catharanthus", 3)).toBe(true);
    expect(isUnlocked("penicillium", 39)).toBe(false);
    expect(isUnlocked("penicillium", 40)).toBe(true);
    expect(unlockedPlants(40)).toHaveLength(PLANT_IDS.length);
  });
  it("names the next one", () => {
    expect(nextUnlock(0)?.id).toBe("catharanthus");
    expect(nextUnlock(3)?.id).toBe("atropa");
    expect(nextUnlock(40)).toBeNull();
  });
});
