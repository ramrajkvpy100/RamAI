/**
 * "Near me" games: doctors around you, and asking them to play the same patient — a duel request they see in the app and as a
 * notification, whenever they next open it.
 *
 * Two lists. The live radar holds only doctors who turned it on: a position snapped to a ~100 m grid, gone ten minutes after the
 * last heartbeat, seen only by others who share too, and only ever as a rounded distance. No response here carries anyone's
 * coordinates, and nothing can ask for them. The older city list goes by the city on the profile (or a location rounded to 10 km).
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { rankFor } from "@/engine/progression";

import type { User } from "./auth";
import { haversineMeters, PRESENCE_TTL_MS, roundDistance, snapToGrid, type LatLng, type NearbyView } from "@/lib/nearby-geo";

import { db } from "./db";
import { progressForMany } from "./progress";
import { isPushEndpoint, sendPush } from "./push";

export interface NearbyDoctor {
  id: string;
  name: string;
  rankTier: number;
  rankLabel: string;
  /** When they last started a case (ms), if ever. */
  activeAt: number | null;
  place: string | null;
}

/** A request waits a day: the other doctor plays it when they next open the app. */
const REQUEST_MS = 24 * 60 * 60_000;
/** A doctor can ask this many people an hour, and the same person only this often a day. Counted in the database, so it holds across servers. */
const CHALLENGES_PER_HOUR = 10;
const SAME_DOCTOR_PER_DAY = 2;
/** Heartbeats closer together than this change nothing: a made-up path can't be walked quickly to measure someone. */
const HEARTBEAT_MIN_MS = 20_000;
/** How far the radar looks; beyond 10 km it only matters for "My City". */
const RADAR_DEGREES = 0.45;
const CITY_RADIUS_M = 50_000;

/** Doctors near this one, the most recently active first; `needs` when the doctor hasn't said where they are. */
export async function nearbyDoctors(user: User): Promise<{ doctors: NearbyDoctor[]; place?: string; needs?: "location" }> {
  let where: string;
  let args: (string | number)[];
  let place: string;
  if (user.geo) {
    const dLat = 0.45, dLon = 0.45 / Math.max(0.2, Math.cos((user.geo.lat * Math.PI) / 180));
    where = "u.geo_lat BETWEEN ? AND ? AND u.geo_lon BETWEEN ? AND ?";
    args = [user.geo.lat - dLat, user.geo.lat + dLat, user.geo.lon - dLon, user.geo.lon + dLon];
    place = "within about 50 km";
  } else if (user.city?.trim()) {
    where = "lower(trim(u.city)) = lower(trim(?))";
    args = [user.city];
    place = user.city.trim();
  } else return { doctors: [], needs: "location" };
  const rows = await db.all<{ id: string; name: string; city: string | null; activeAt: number | null }>(
    `SELECT u.id, u.name, u.city, (SELECT MAX(created_at) FROM case_starts c WHERE c.user_id = u.id) AS activeAt
     FROM users u WHERE u.id != ? AND u.is_guest = 0 AND u.is_demo = 0 AND ${where}
       AND u.id NOT IN (SELECT user_id FROM nearby_prefs WHERE hidden = 1)
     ORDER BY activeAt IS NULL, activeAt DESC LIMIT 30`,
    user.id, ...args,
  );
  const progress = await progressForMany(rows.map((r) => r.id));
  return {
    place,
    doctors: rows.map((r) => {
      const rank = rankFor(progress.get(r.id)?.rating);
      return { id: r.id, name: r.name || "Doctor", rankTier: rank.tier, rankLabel: rank.label, activeAt: r.activeAt ?? null, place: r.city };
    }),
  };
}

export async function sharingState(userId: string): Promise<{ sharing: boolean; hidden: boolean }> {
  const row = await db.get<{ sharing: number; hidden: number }>("SELECT sharing, hidden FROM nearby_prefs WHERE user_id = ?", userId);
  return { sharing: row?.sharing === 1, hidden: row?.hidden === 1 };
}

/** The doctor said yes to the plain sentence on screen. Nothing is stored about where they are until a heartbeat arrives. */
export async function optIn(userId: string, now = Date.now()): Promise<void> {
  await db.run(
    "INSERT INTO nearby_prefs (user_id, sharing, hidden, consent_at) VALUES (?, 1, 0, ?) ON CONFLICT(user_id) DO UPDATE SET sharing = 1, hidden = 0, consent_at = excluded.consent_at",
    userId, now,
  );
}

/** Stop sharing: the position and the consent go together, at once, so another phone on this account stops too. */
export async function stopSharing(userId: string): Promise<void> {
  await db.batch([
    { sql: "DELETE FROM location_presence WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM nearby_prefs WHERE user_id = ? AND hidden = 0", args: [userId] },
    { sql: "UPDATE nearby_prefs SET sharing = 0 WHERE user_id = ?", args: [userId] },
  ]);
}

/** "Don't show me": off the radar and the city list, and no one can challenge them from Near me. */
export async function setHidden(userId: string, hidden: boolean): Promise<void> {
  if (!hidden) {
    await db.run("DELETE FROM nearby_prefs WHERE user_id = ?", userId);
    return;
  }
  await db.batch([
    { sql: "DELETE FROM location_presence WHERE user_id = ?", args: [userId] },
    { sql: "INSERT INTO nearby_prefs (user_id, sharing, hidden) VALUES (?, 0, 1) ON CONFLICT(user_id) DO UPDATE SET sharing = 0, hidden = 1", args: [userId] },
  ]);
}

export async function purgeExpiredPresence(now = Date.now()): Promise<number> {
  return (await db.run("DELETE FROM location_presence WHERE last_seen_at <= ?", now - PRESENCE_TTL_MS)).changes;
}

let lastPurge = 0;
const purgeNowAndThen = async (now: number) => {
  if (now - lastPurge < 60_000) return;
  lastPurge = now;
  await purgeExpiredPresence(now).catch(() => 0);
};

/** "Still here". Only the grid square is ever written; the phone's own reading stops at this function. */
export async function recordHeartbeat(user: User, position: LatLng, now = Date.now()): Promise<"saved" | "too-soon" | "not-sharing"> {
  if (user.isGuest) return "not-sharing";
  const was = await db.get<{ last_seen_at: number; rating: number | null }>("SELECT last_seen_at, rating FROM location_presence WHERE user_id = ? AND last_seen_at > ?", user.id, now - PRESENCE_TTL_MS);
  if (was && now - was.last_seen_at < HEARTBEAT_MIN_MS) return "too-soon";
  // Worked out when they arrive, not every 30 seconds: it reads their whole history.
  const rating = was ? was.rating : ((await progressForMany([user.id])).get(user.id)?.rating ?? null);
  const { lat, lng } = snapToGrid(position);
  // One statement, conditional on consent: a heartbeat already on its way when "Stop sharing" lands can't bring the row back.
  const { changes } = await db.run(
    `INSERT INTO location_presence (user_id, lat, lng, specialty, rating, last_seen_at)
     SELECT ?, ?, ?, ?, ?, ? FROM nearby_prefs WHERE user_id = ? AND sharing = 1 AND hidden = 0
     ON CONFLICT(user_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, specialty = excluded.specialty, rating = excluded.rating, last_seen_at = excluded.last_seen_at`,
    user.id, lat, lng, user.specialty, rating, now, user.id,
  );
  await purgeNowAndThen(now);
  return changes ? "saved" : "not-sharing";
}

const sameCity = (a: string | null | undefined, b: string | null | undefined) => !!a?.trim() && a.trim().toLowerCase() === b?.trim().toLowerCase();

/** Who is on the radar for this doctor: nothing unless they share too. Each row is built field by field, so a position can't slip out. */
export async function liveDoctors(user: User, now = Date.now()): Promise<NearbyView[]> {
  const cutoff = now - PRESENCE_TTL_MS;
  const me = await db.get<LatLng>("SELECT lat, lng FROM location_presence WHERE user_id = ? AND last_seen_at > ?", user.id, cutoff);
  if (!me) return [];
  const dLng = RADAR_DEGREES / Math.max(0.2, Math.cos((me.lat * Math.PI) / 180));
  const city = user.city?.trim();
  const rows = await db.all<LatLng & { id: string; name: string; city: string | null; specialty: string | null; rating: number | null; last_seen_at: number }>(
    `SELECT u.id, u.name, u.city, p.lat, p.lng, p.specialty, p.rating, p.last_seen_at
     FROM location_presence p JOIN users u ON u.id = p.user_id
     WHERE p.user_id != ? AND p.last_seen_at > ? AND u.is_guest = 0 AND u.is_demo = 0
       AND ((p.lat BETWEEN ? AND ? AND p.lng BETWEEN ? AND ?)${city ? " OR lower(trim(u.city)) = lower(trim(?))" : ""})
     ORDER BY p.last_seen_at DESC LIMIT 100`,
    user.id, cutoff, me.lat - RADAR_DEGREES, me.lat + RADAR_DEGREES, me.lng - dLng, me.lng + dLng, ...(city ? [city] : []),
  );
  const views: NearbyView[] = [];
  for (const r of rows) {
    const meters = haversineMeters(me, r);
    const inCity = city ? sameCity(city, r.city) : meters <= CITY_RADIUS_M;
    if (meters > 10_500 && !inCity) continue;
    const rank = rankFor(r.rating ?? undefined);
    views.push({ id: r.id, name: r.name || "Doctor", rankTier: rank.tier, rankLabel: rank.label, specialty: r.specialty, distanceM: roundDistance(meters), seenMinAgo: Math.floor((now - r.last_seen_at) / 60_000), activeAt: null, inCity });
  }
  return views;
}

export interface RadarResponse {
  sharing: boolean;
  hidden: boolean;
  doctors: NearbyView[];
  /** Doctors listed by city, not sharing a location. Left out when only the live part was asked for. */
  city?: NearbyView[];
  place?: string;
  needs?: "location";
}

export async function radar(user: User, { liveOnly = false } = {}, now = Date.now()): Promise<RadarResponse> {
  await purgeNowAndThen(now);
  const { sharing, hidden } = await sharingState(user.id);
  const doctors = sharing ? await liveDoctors(user, now) : [];
  if (liveOnly) return { sharing, hidden, doctors };
  const listed = await nearbyDoctors(user);
  return {
    sharing, hidden, doctors, place: listed.place, ...(listed.needs ? { needs: listed.needs } : {}),
    city: listed.doctors.map((d) => ({ id: d.id, name: d.name, rankTier: d.rankTier, rankLabel: d.rankLabel, specialty: null, distanceM: null, seenMinAgo: null, activeAt: d.activeAt, inCity: true })),
  };
}

/** Asks nearby doctors to play this duel: only doctors really listed for this one, at most five at a time, not twice, and within the limits above. */
export async function requestDuel(user: User, duelId: string, to: string[]): Promise<number> {
  const near = new Set([...(await nearbyDoctors(user)).doctors, ...((await sharingState(user.id)).sharing ? await liveDoctors(user) : [])].map((d) => d.id));
  const host = await db.get<{ host_id: string }>("SELECT host_id FROM duels WHERE id = ?", duelId);
  if (!host || host.host_id !== user.id) return 0;
  const from = user.name || user.username || "A doctor";
  const now = Date.now();
  const lastHour = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM duel_requests WHERE from_id = ? AND created_at > ?", user.id, now - 60 * 60_000);
  let room = CHALLENGES_PER_HOUR - (lastHour?.n ?? 0);
  let sent = 0;
  for (const id of [...new Set(to)].filter((t) => near.has(t)).slice(0, 5)) {
    const dup = await db.get("SELECT 1 FROM duel_requests WHERE duel_id = ? AND to_id = ?", duelId, id);
    if (dup || room <= 0) continue;
    const today = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM duel_requests WHERE to_id = ? AND from_id = ? AND created_at > ?", id, user.id, now - REQUEST_MS);
    if ((today?.n ?? 0) >= SAME_DOCTOR_PER_DAY) continue;
    room--;
    await db.run("INSERT INTO duel_requests (id, duel_id, from_id, from_name, to_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", randomUUID(), duelId, user.id, from.slice(0, 60), id, Date.now());
    sent++;
    // A notification on their phones too (where they've allowed them).
    const subs = await db.all<{ endpoint: string; p256dh: string; auth: string }>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? LIMIT 3", id);
    await Promise.all(
      subs.filter((s) => isPushEndpoint(s.endpoint)).map((s) =>
        sendPush(s, { title: `⚔️ ${from.slice(0, 40)} challenges you`, body: "A doctor near you wants to play the same patient. Who scores higher? Play it when you're free.", url: `/duel/${duelId}`, tag: "ramai-duel" }, 86_400, `duel-${duelId.slice(0, 8)}`).catch(() => "failed"),
      ),
    );
  }
  return sent;
}

export interface DuelRequest {
  id: string;
  duelId: string;
  from: string;
  at: number;
}

/** Challenges waiting for this doctor (the last day). */
export async function pendingRequests(userId: string): Promise<DuelRequest[]> {
  const rows = await db.all<{ id: string; duel_id: string; from_name: string; created_at: number }>(
    "SELECT id, duel_id, from_name, created_at FROM duel_requests WHERE to_id = ? AND status = 'pending' AND created_at > ? ORDER BY created_at DESC LIMIT 5",
    userId, Date.now() - REQUEST_MS,
  );
  return rows.map((r) => ({ id: r.id, duelId: r.duel_id, from: r.from_name, at: r.created_at }));
}

export async function answerRequest(userId: string, id: string, accept: boolean): Promise<string | null> {
  const row = await db.get<{ duel_id: string }>("SELECT duel_id FROM duel_requests WHERE id = ? AND to_id = ?", id, userId);
  if (!row) return null;
  await db.run("UPDATE duel_requests SET status = ? WHERE id = ?", accept ? "accepted" : "declined", id);
  return row.duel_id;
}
