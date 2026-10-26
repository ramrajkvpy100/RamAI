import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { rankFor } from "@/engine/progression";

import { db } from "./db";
import { progressFor } from "./progress";
import { casesStartedToday } from "./results";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

/** A new read-only widget key for this doctor (the phone keeps it; we keep only its hash). Older keys stay valid. */
export async function newWidgetToken(userId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await db.run("INSERT INTO widget_tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)", hash(token), userId, Date.now());
  return token;
}

export interface WidgetData {
  streak: number;
  xpToday: number;
  goal: number;
  rating: number;
  casesToday: number;
  level: string;
}

/** What the progress widget shows — nothing else is readable with the key. */
export async function widgetData(token: string): Promise<WidgetData | null> {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const row = await db.get<{ user_id: string }>("SELECT user_id FROM widget_tokens WHERE token_hash = ?", hash(token));
  if (!row) return null;
  const [p, today] = await Promise.all([progressFor(row.user_id), casesStartedToday(row.user_id)]);
  return { streak: p.streakDays, xpToday: p.dailyXp, goal: p.dailyGoal, rating: Math.round(p.rating ?? 1200), casesToday: today, level: rankFor(p.percent).label };
}
