import { beforeAll, describe, expect, it, vi } from "vitest";

import { createProfile, findUserById, setProfileDetails, type User } from "@/server/auth";
import { db } from "@/server/db";
import { createDuel } from "@/server/duels";
import { filterDoctors, formatDistance, formatSeen, haversineMeters, roundDistance, snapToGrid, type NearbyView } from "@/lib/nearby-geo";
import { liveDoctors, nearbyDoctors, optIn, pendingRequests, purgeExpiredPresence, radar, recordHeartbeat, requestDuel, setHidden, sharingState, stopSharing } from "@/server/nearby";

process.env.RAMAI_DB_PATH = ":memory:";

const signedIn = vi.hoisted(() => ({ user: null as unknown }));
vi.mock("@/server/auth", async (real) => ({ ...(await real<typeof import("@/server/auth")>()), requireUser: async () => signedIn.user }));

// Metres north/east of a point in Jaipur, close enough for these distances.
const JAIPUR = { lat: 26.9124, lng: 75.7873 };
const at = (north: number, east = 0) => ({ lat: JAIPUR.lat + north / 111_320, lng: JAIPUR.lng + east / (111_320 * Math.cos((JAIPUR.lat * Math.PI) / 180)) });
const view = (id: string, distanceM: number | null, inCity = false): NearbyView => ({ id, name: id, rankTier: 1, rankLabel: "x", specialty: null, distanceM, seenMinAgo: distanceM === null ? null : 0, activeAt: null, inCity });

describe("the arithmetic", () => {
  it("haversine matches worked examples", () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111_195, 0); // A degree on the equator.
    expect(haversineMeters({ lat: 28.6, lng: 77.2 }, { lat: 28.61, lng: 77.2 })).toBeCloseTo(1112, 0); // 0.01° north.
    expect(haversineMeters({ lat: 28.6, lng: 77.2 }, { lat: 28.6, lng: 77.21 })).toBeCloseTo(976, 0); // 0.01° east, shorter by cos(28.6°).
    expect(haversineMeters({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }) / 1000).toBeCloseTo(343.6, 0); // London to Paris.
    expect(haversineMeters({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 }) / 1000).toBeCloseTo(1148, 0); // Delhi to Mumbai.
    expect(haversineMeters(JAIPUR, JAIPUR)).toBe(0);
  });

  it("snaps to a square about 100 m wide, the same answer for everywhere in it", () => {
    const snapped = snapToGrid(JAIPUR);
    expect(haversineMeters(JAIPUR, snapped)).toBeLessThanOrEqual(71);
    expect(snapToGrid(snapped)).toEqual(snapped);
    expect(snapToGrid({ lat: snapped.lat + 0.0001, lng: snapped.lng - 0.0001 })).toEqual(snapped);
    // Farther than a square away is a different square, in both directions.
    expect(snapToGrid(at(150)).lat).not.toBe(snapToGrid(JAIPUR).lat);
    expect(snapToGrid(at(0, 150)).lng).not.toBe(snapToGrid(JAIPUR).lng);
    // Stored to six decimals (about 10 cm), which holds nothing of the original reading beyond the square.
    expect(String(snapped.lat).split(".")[1]!.length).toBeLessThanOrEqual(6);
  });

  it("rounds distances in 50 m and 100 m steps, never under 100 m", () => {
    for (const [m, shown] of [[0, 100], [40, 100], [124, 100], [130, 150], [342, 350], [999, 1000], [1049, 1000], [1370, 1400], [9949, 9900], [12_400, 12_000]] as const) expect(roundDistance(m)).toBe(shown);
    expect(formatDistance(100)).toBe("Within 100 m");
    expect(formatDistance(350)).toBe("350 m away");
    expect(formatDistance(1000)).toBe("1 km away");
    expect(formatDistance(1400)).toBe("1.4 km away");
    expect(formatSeen(0)).toBe("Active now");
    expect(formatSeen(2)).toBe("Active 2m ago");
  });

  it("filters by how far, nearest first; My City goes by city", () => {
    const list = [view("far", 9000), view("mid", 1400), view("near", 350, true), view("listed", null, true), view("away", 12_000, true)];
    expect(filterDoctors(list, "1km").map((d) => d.id)).toEqual(["near"]);
    expect(filterDoctors(list, "2km").map((d) => d.id)).toEqual(["near", "mid"]);
    expect(filterDoctors(list, "10km").map((d) => d.id)).toEqual(["near", "mid", "far"]);
    expect(filterDoctors(list, "city").map((d) => d.id)).toEqual(["near", "away", "listed"]);
  });
});

describe("the radar", () => {
  let asha: User, ravi: User, meera: User, off: User;
  const T = 1_800_000_000_000;

  const beat = (u: User, north: number, now = T) => recordHeartbeat(u, at(north), now);

  beforeAll(async () => {
    const make = async (name: string, city?: string) => {
      const u = await createProfile({ email: `${name}.p@example.com`, username: `${name}p`, name });
      if (city) await setProfileDetails(u.id, { city });
      return (await findUserById(u.id))!;
    };
    asha = await make("asha", "Jaipur");
    ravi = await make("ravi", "Jaipur");
    meera = await make("meera", "Kochi");
    off = await make("off", "Jaipur");
  });

  it("stores nothing without a yes", async () => {
    expect(await beat(asha, 0)).toBe("not-sharing");
    expect(await db.get("SELECT 1 FROM location_presence WHERE user_id = ?", asha.id)).toBeUndefined();
  });

  it("stores only the grid square, and shows only rounded distances to others who share", async () => {
    for (const u of [asha, ravi, meera]) await optIn(u.id, T);
    expect(await beat(asha, 0)).toBe("saved");
    expect(await beat(ravi, 1370)).toBe("saved");
    expect(await beat(meera, 340)).toBe("saved");

    const row = await db.get<{ lat: number; lng: number }>("SELECT lat, lng FROM location_presence WHERE user_id = ?", ravi.id);
    expect(row).toEqual(snapToGrid(at(1370)));

    const seen = await liveDoctors(asha, T + 120_000);
    const byName = Object.fromEntries(seen.map((d) => [d.name, d]));
    expect(byName.ravi).toMatchObject({ distanceM: 1400, seenMinAgo: 2, inCity: true });
    expect(byName.meera).toMatchObject({ distanceM: 300, inCity: false }); // Three squares north, whatever the reading inside the square.

    // Not sharing yourself? Nothing to see.
    expect(await liveDoctors(off, T)).toEqual([]);
    expect((await radar(off, {}, T)).doctors).toEqual([]);
  });

  it("no coordinates in what the API sends", async () => {
    signedIn.user = asha;
    const { GET } = await import("@/app/api/duels/nearby/route");
    // The route looks at the real clock, so bring the rows up to it.
    await db.run("DELETE FROM location_presence");
    for (const u of [asha, ravi, meera]) await recordHeartbeat(u, at(u === asha ? 0 : u === ravi ? 1370 : 340));
    const res = await GET(new Request("http://localhost/api/duels/nearby"));
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text) as { doctors: NearbyView[] };
    expect(body.doctors.map((d) => d.name).sort()).toEqual(["meera", "ravi"]);
    expect(text).not.toMatch(/"(lat|lng|lon|latitude|longitude|geo|coords?|bearing|last_seen_at)"/i);
    // Nor any number that looks like one: the only numbers near these digits would be a position.
    expect(text).not.toMatch(/\b(26\.\d+|75\.\d+)\b/);
    for (const d of body.doctors) expect(d.distanceM! % 50).toBe(0);
  });

  it("heartbeats too close together change nothing", async () => {
    expect(await beat(asha, 5000, T + 200_000)).toBe("saved");
    expect(await beat(asha, 0, T + 205_000)).toBe("too-soon");
    expect(await db.get("SELECT lat FROM location_presence WHERE user_id = ?", asha.id)).toEqual({ lat: snapToGrid(at(5000)).lat });
  });

  it("presence runs out after 10 minutes and the row is deleted", async () => {
    await db.run("DELETE FROM location_presence");
    await beat(asha, 0);
    await beat(ravi, 500);
    expect((await liveDoctors(asha, T + 9 * 60_000)).map((d) => d.name)).toEqual(["ravi"]);
    await beat(asha, 0, T + 10 * 60_000); // Asha is still here; Ravi's last word is ten minutes old.
    expect(await liveDoctors(asha, T + 10 * 60_000)).toEqual([]);
    await purgeExpiredPresence(T + 10 * 60_000);
    expect(await db.get("SELECT 1 FROM location_presence WHERE user_id = ?", ravi.id)).toBeUndefined();
    await db.run("UPDATE location_presence SET last_seen_at = ? WHERE user_id = ?", T, asha.id);
    expect(await purgeExpiredPresence(T + 10 * 60_000)).toBe(1);
  });

  it("Stop sharing deletes the row at once, and a late heartbeat can't bring it back", async () => {
    signedIn.user = ravi;
    await beat(ravi, 500, T + 10 * 60_000);
    const { DELETE } = await import("@/app/api/location/heartbeat/route");
    expect((await DELETE(new Request("http://localhost/api/location/heartbeat", { method: "DELETE" }))).status).toBe(200);
    expect(await db.get("SELECT 1 FROM location_presence WHERE user_id = ?", ravi.id)).toBeUndefined();
    expect((await sharingState(ravi.id)).sharing).toBe(false);
    expect(await beat(ravi, 500, T + 11 * 60_000)).toBe("not-sharing");
    expect(await db.get("SELECT 1 FROM location_presence WHERE user_id = ?", ravi.id)).toBeUndefined();
  });

  it("the heartbeat route refuses guests and anyone who hasn't said yes", async () => {
    const { POST } = await import("@/app/api/location/heartbeat/route");
    const post = (body: object) => POST(new Request("http://localhost/api/location/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    signedIn.user = { ...off, isGuest: true };
    expect((await post({ consent: true })).status).toBe(403);
    signedIn.user = off;
    expect((await post(at(0))).status).toBe(403);
    expect((await post({ lat: 91, lng: 0 })).status).toBe(400);
  });

  it("\"Don't show me\": off the city list and can't be challenged from Near me", async () => {
    expect((await nearbyDoctors(asha)).doctors.map((d) => d.name)).toContain("off");
    await setHidden(off.id, true);
    expect((await nearbyDoctors(asha)).doctors.map((d) => d.name)).not.toContain("off");
    await createDuel("aaaaaaaaaaa1", "invite", { id: asha.id, name: "asha" }, { kind: "library", id: "med-pad" });
    expect(await requestDuel(asha, "aaaaaaaaaaa1", [off.id])).toBe(0);
    await setHidden(off.id, false);
    expect((await nearbyDoctors(asha)).doctors.map((d) => d.name)).toContain("off");
  });

  it("a challenge waits a day, not half an hour", async () => {
    await requestDuel(asha, "aaaaaaaaaaa1", [off.id]);
    const [req] = await pendingRequests(off.id);
    expect(req?.duelId).toBe("aaaaaaaaaaa1");
    await db.run("UPDATE duel_requests SET created_at = ? WHERE id = ?", Date.now() - 23 * 60 * 60_000, req!.id);
    expect(await pendingRequests(off.id)).toHaveLength(1);
    await db.run("UPDATE duel_requests SET created_at = ? WHERE id = ?", Date.now() - 25 * 60 * 60_000, req!.id);
    expect(await pendingRequests(off.id)).toEqual([]);
  });

  it("limits challenges: the same doctor twice a day, anyone ten an hour", async () => {
    await db.run("DELETE FROM duel_requests");
    for (const [n, want] of [[2, 1], [3, 1], [4, 0]] as const) {
      await createDuel(`aaaaaaaaaaa${n}`, "invite", { id: asha.id, name: "asha" }, { kind: "library", id: "med-pad" });
      expect(await requestDuel(asha, `aaaaaaaaaaa${n}`, [off.id])).toBe(want);
    }
    await db.run("DELETE FROM duel_requests");
    const now = Date.now();
    for (let i = 0; i < 10; i++) await db.run("INSERT INTO duel_requests (id, duel_id, from_id, from_name, to_id, created_at) VALUES (?, 'x', ?, 'asha', ?, ?)", `r${i}`, asha.id, `someone-${i}`, now);
    expect(await requestDuel(asha, "aaaaaaaaaaa4", [off.id])).toBe(0);
  });

  it("stopSharing leaves a hidden doctor hidden", async () => {
    await setHidden(off.id, true);
    await stopSharing(off.id);
    expect(await sharingState(off.id)).toEqual({ sharing: false, hidden: true });
    await setHidden(off.id, false);
  });
});
