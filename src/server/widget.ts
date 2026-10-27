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
  plan?: {
    mit: string | null;
    mitDone: boolean;
    todos: string[];
    left: number;
    habitsDone: number;
    habits: number;
    /** The open to-dos and today's habits not yet done, with ids — ticked off from the widget itself. */
    open?: { id: string; text: string }[];
    habitsLeft?: { id: string; name: string }[];
    /** What to do next, in a few words. */
    next?: string;
    /** How the day is going: done of total (MIT + to-dos + habits). */
    done?: number;
    total?: number;
  };
}

interface Todo { id: string; text: string; done: boolean }
interface DayDoc { mit?: Todo | null; todos?: Todo[]; habits?: Record<string, boolean>; good?: string[] }
interface HabitDoc { id: string; name: string; tiny?: string }

const userOf = async (token: string) => {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  return (await db.get<{ user_id: string }>("SELECT user_id FROM widget_tokens WHERE token_hash = ?", hash(token)))?.user_id ?? null;
};
const dayOf = (day?: string) => (day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10));

/**
 * Ticks one planner item from the home-screen widget: today's most important task, a to-do or a habit. The key can do
 * only this — nothing else in the account can be changed with it.
 */
export async function widgetToggle(token: string, day: string | undefined, kind: "mit" | "todo" | "habit", id: string): Promise<boolean> {
  const user = await userOf(token);
  if (!user) return false;
  const doc = `day:${dayOf(day)}`;
  const row = await db.get<{ data: string }>("SELECT data FROM planner_docs WHERE user_id = ? AND doc = ?", user, doc);
  let d: DayDoc = { mit: null, todos: [], habits: {} };
  try { if (row) d = { ...d, ...(JSON.parse(row.data) as DayDoc) }; } catch {}
  if (kind === "mit" && d.mit) d.mit = { ...d.mit, done: !d.mit.done };
  else if (kind === "todo") d.todos = (d.todos ?? []).map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  else if (kind === "habit") d.habits = { ...(d.habits ?? {}), [id]: !d.habits?.[id] };
  else return false;
  await db.run("INSERT INTO planner_docs (user_id, doc, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, doc) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at", user, doc, JSON.stringify(d), Date.now());
  return true;
}

/** What the progress widget shows — nothing else is readable with the key. */
export async function widgetData(token: string, day?: string): Promise<WidgetData | null> {
  const user = await userOf(token);
  if (!user) return null;
  const row = { user_id: user };
  const d = dayOf(day);
  const [p, today, docs] = await Promise.all([
    progressFor(row.user_id),
    casesStartedToday(row.user_id),
    db.all<{ doc: string; data: string }>("SELECT doc, data FROM planner_docs WHERE user_id = ? AND doc IN (?, 'habits')", row.user_id, `day:${d}`).catch(() => []),
  ]);
  const json = (doc: string) => { try { return JSON.parse(docs.find((x) => x.doc === doc)?.data ?? "null"); } catch { return null; } };
  const dayDoc = json(`day:${d}`) as DayDoc | null;
  const habits = (json("habits") as HabitDoc[] | null) ?? [];
  const open = (dayDoc?.todos ?? []).filter((t) => !t.done);
  const habitsLeft = habits.filter((h) => !dayDoc?.habits?.[h.id]);
  const mit = dayDoc?.mit?.text ?? null, mitDone = !!dayDoc?.mit?.done;
  const hour = new Date(Date.now() + 5.5 * 3_600_000).getUTCHours();
  const reviewed = (dayDoc?.good ?? []).some((g) => g?.trim());
  const next = !mit ? "Set today's one most important task"
    : !mitDone ? `Start now: ${mit}`
    : open[0] ? `Next: ${open[0].text}`
    : habitsLeft[0] ? `Habit: ${habitsLeft[0].name}${habitsLeft[0].tiny ? ` — just ${habitsLeft[0].tiny}` : ""}`
    : hour >= 19 && !reviewed ? "Evening review: 3 good, 3 bad, 3 better"
    : "All done for today 🎉";
  const total = (mit ? 1 : 0) + (dayDoc?.todos?.length ?? 0) + habits.length;
  const doneCount = (mitDone ? 1 : 0) + ((dayDoc?.todos?.length ?? 0) - open.length) + (habits.length - habitsLeft.length);
  const plan = {
    mit, mitDone, todos: open.slice(0, 3).map((t) => t.text.slice(0, 60)), left: open.length, habitsDone: habits.length - habitsLeft.length, habits: habits.length,
    open: open.slice(0, 4).map((t) => ({ id: t.id, text: t.text.slice(0, 60) })),
    habitsLeft: habitsLeft.slice(0, 3).map((h) => ({ id: h.id, name: h.name.slice(0, 40) })),
    next: next.slice(0, 80), done: doneCount, total,
  };
  return {
    plan, streak: p.streakDays, xpToday: p.dailyXp, goal: p.dailyGoal, rating: Math.round(p.rating ?? 1200), casesToday: today, level: rankFor(p.percent).label };
}
