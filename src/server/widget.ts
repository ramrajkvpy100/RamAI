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
  /** Today's plan (the phone's own date): the most important task, the next to-dos, habits done. */
  plan?: { mit: string | null; mitDone: boolean; todos: string[]; left: number; habitsDone: number; habits: number };
}

/** What the progress widget shows — nothing else is readable with the key. */
export async function widgetData(token: string, day?: string): Promise<WidgetData | null> {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const row = await db.get<{ user_id: string }>("SELECT user_id FROM widget_tokens WHERE token_hash = ?", hash(token));
  if (!row) return null;
  const d = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const [p, today, docs] = await Promise.all([
    progressFor(row.user_id),
    casesStartedToday(row.user_id),
    db.all<{ doc: string; data: string }>("SELECT doc, data FROM planner_docs WHERE user_id = ? AND doc IN (?, 'habits')", row.user_id, `day:${d}`).catch(() => []),
  ]);
  const json = (doc: string) => { try { return JSON.parse(docs.find((x) => x.doc === doc)?.data ?? "null"); } catch { return null; } };
  const dayDoc = json(`day:${d}`) as { mit?: { text: string; done: boolean } | null; todos?: { text: string; done: boolean }[]; habits?: Record<string, boolean> } | null;
  const habits = (json("habits") as { id: string }[] | null) ?? [];
  const open = (dayDoc?.todos ?? []).filter((t) => !t.done);
  const plan = { mit: dayDoc?.mit?.text ?? null, mitDone: !!dayDoc?.mit?.done, todos: open.slice(0, 3).map((t) => t.text.slice(0, 60)), left: open.length, habitsDone: habits.filter((h) => dayDoc?.habits?.[h.id]).length, habits: habits.length };
  return {
    plan, streak: p.streakDays, xpToday: p.dailyXp, goal: p.dailyGoal, rating: Math.round(p.rating ?? 1200), casesToday: today, level: rankFor(p.percent).label };
}
