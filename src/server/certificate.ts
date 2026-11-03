/** The doctor's clinical credential: rating, career indices and specialties, and the public link they can turn on and off. */
import "server-only";

import { randomBytes } from "node:crypto";

import { careerIndices, type CareerIndices, type CareerRow } from "@/engine/career";
import { rankFor, withDerived } from "@/engine/progression";
import { CV_AT_FRIENDS, MENTOR_AT_FRIENDS } from "@/lib/plans";

import { db } from "./db";
import { historyFor } from "./progress";
import { ratingPercentile } from "./results";

/** Cases before a public, shareable credential means anything. */
export const CREDENTIAL_MIN_CASES = 10;
/** Doctors rated before a percentile means anything. */
const STANDING_MIN_DOCTORS = 10;

export interface Credential {
  name: string;
  rating: number;
  rank: string;
  top: number | null;
  ratedCases: number;
  indices: CareerIndices;
  mastery: { specialty: string; cases: number; percent: number }[];
  mentor: boolean;
  asOf: number;
}

async function credentialOf(user: { id: string; name: string; username: string; inviteTier: number }): Promise<Credential> {
  const [history, rows] = await Promise.all([
    historyFor(user.id),
    db.all<CareerRow>("SELECT verdict, failed, track, detail FROM results WHERE user_id = ? AND assisted = 0 AND COALESCE(tutorial, 0) = 0", user.id),
  ]);
  const p = withDerived(history);
  const standing = await ratingPercentile(p.rating);
  return {
    name: user.name || user.username,
    rating: p.rating,
    rank: rankFor(p.rating).label,
    top: standing.doctors >= STANDING_MIN_DOCTORS ? standing.top : null,
    ratedCases: p.ratedCases ?? 0,
    indices: careerIndices(rows),
    mastery: p.mastery.filter((m) => m.cases > 0).sort((a, b) => b.percent - a.percent).map((m) => ({ specialty: String(m.specialty), cases: m.cases, percent: Math.round(m.percent) })),
    mentor: user.inviteTier >= MENTOR_AT_FRIENDS,
    asOf: Date.now(),
  };
}

/** The doctor's own view: the credential, whether the verified link is unlocked, and the link if it's on. */
export async function myCredential(user: { id: string; name: string; username: string; inviteTier: number; plan: string }) {
  const [credential, link] = await Promise.all([credentialOf(user), db.get<{ id: string }>("SELECT id FROM certificates WHERE user_id = ?", user.id)]);
  return { credential, verifyId: link?.id ?? null, unlocked: user.plan === "pro" || user.inviteTier >= CV_AT_FRIENDS, minCases: CREDENTIAL_MIN_CASES };
}

export async function turnOnVerifyLink(userId: string): Promise<string> {
  await db.run("INSERT OR IGNORE INTO certificates (id, user_id, created_at) VALUES (?, ?, ?)", randomBytes(9).toString("base64url"), userId, Date.now());
  return (await db.get<{ id: string }>("SELECT id FROM certificates WHERE user_id = ?", userId))!.id;
}

export const turnOffVerifyLink = (userId: string) => db.run("DELETE FROM certificates WHERE user_id = ?", userId);

/** What a public link shows, or null when it's off. */
export async function publicCredential(id: string): Promise<Credential | null> {
  const row = await db.get<{ id: string; name: string; username: string; invite_tier: number }>(
    "SELECT u.id, u.name, u.username, u.invite_tier FROM certificates c JOIN users u ON u.id = c.user_id WHERE c.id = ?",
    id,
  );
  return row ? credentialOf({ id: row.id, name: row.name, username: row.username, inviteTier: row.invite_tier ?? 0 }) : null;
}
