/**
 * "Near me" games: doctors within about 50 km (by the phone's rounded location, or the same city on the profile),
 * and asking them to play the same patient — a duel request they see in the app and as a notification.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { rankFor } from "@/engine/progression";

import type { User } from "./auth";
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

/** A request is answerable for half an hour. */
const REQUEST_MS = 30 * 60_000;

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
     ORDER BY activeAt IS NULL, activeAt DESC LIMIT 30`,
    user.id, ...args,
  );
  const progress = await progressForMany(rows.map((r) => r.id));
  return {
    place,
    doctors: rows.map((r) => {
      const rank = rankFor(progress.get(r.id)?.percent ?? 0);
      return { id: r.id, name: r.name || "Doctor", rankTier: rank.tier, rankLabel: rank.label, activeAt: r.activeAt ?? null, place: r.city };
    }),
  };
}

/** Asks nearby doctors to play this duel; only doctors who really are near, at most five, and not twice. */
export async function requestDuel(user: User, duelId: string, to: string[]): Promise<number> {
  const near = new Set((await nearbyDoctors(user)).doctors.map((d) => d.id));
  const host = await db.get<{ host_id: string }>("SELECT host_id FROM duels WHERE id = ?", duelId);
  if (!host || host.host_id !== user.id) return 0;
  const from = user.name || user.username || "A doctor";
  let sent = 0;
  for (const id of [...new Set(to)].filter((t) => near.has(t)).slice(0, 5)) {
    const dup = await db.get("SELECT 1 FROM duel_requests WHERE duel_id = ? AND to_id = ?", duelId, id);
    if (dup) continue;
    await db.run("INSERT INTO duel_requests (id, duel_id, from_id, from_name, to_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", randomUUID(), duelId, user.id, from.slice(0, 60), id, Date.now());
    sent++;
    // A notification on their phones too (where they've allowed them).
    const subs = await db.all<{ endpoint: string; p256dh: string; auth: string }>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? LIMIT 3", id);
    await Promise.all(
      subs.filter((s) => isPushEndpoint(s.endpoint)).map((s) =>
        sendPush(s, { title: `⚔️ ${from.slice(0, 40)} challenges you`, body: "A doctor near you wants to play the same patient. Who scores higher? Open within 30 minutes.", url: `/duel/${duelId}`, tag: "ramai-duel" }, 1800, `duel-${duelId.slice(0, 8)}`).catch(() => "failed"),
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

/** Challenges waiting for this doctor (the last half hour). */
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
