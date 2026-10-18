/**
 * Private leaderboards: anyone can start a group (a college, hospital or coaching class) and share
 * its six-letter code; members see each other ranked by this week's XP and average score.
 */
import "server-only";

import { randomInt } from "node:crypto";

import { db } from "./db";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const WEEK_MS = 7 * 86_400_000;

export async function createGroup(ownerId: string, name: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => LETTERS[randomInt(LETTERS.length)]).join("");
    const made = await db.run("INSERT OR IGNORE INTO study_groups (code, name, owner_id, created_at) VALUES (?, ?, ?, ?)", code, name, ownerId, Date.now());
    if (made.changes === 1) {
      await db.run("INSERT OR IGNORE INTO study_group_members (code, user_id, joined_at) VALUES (?, ?, ?)", code, ownerId, Date.now());
      return code;
    }
  }
  throw new Error("Couldn't make a group code.");
}

export async function joinGroup(userId: string, code: string): Promise<boolean> {
  const g = await db.get("SELECT code FROM study_groups WHERE code = ?", code.toUpperCase());
  if (!g) return false;
  await db.run("INSERT OR IGNORE INTO study_group_members (code, user_id, joined_at) VALUES (?, ?, ?)", code.toUpperCase(), userId, Date.now());
  return true;
}

export async function leaveGroup(userId: string, code: string): Promise<void> {
  await db.run("DELETE FROM study_group_members WHERE code = ? AND user_id = ?", code.toUpperCase(), userId);
}

export interface GroupBoard {
  code: string;
  name: string;
  members: { name: string; xp: number; average: number; cases: number; me: boolean }[];
}

export async function myGroups(userId: string, now = Date.now()): Promise<GroupBoard[]> {
  const groups = await db.all<{ code: string; name: string }>("SELECT g.code, g.name FROM study_groups g JOIN study_group_members m ON m.code = g.code WHERE m.user_id = ? ORDER BY m.joined_at", userId);
  const out: GroupBoard[] = [];
  for (const g of groups) {
    const rows = await db.all<{ id: string; name: string; xp: number; average: number; cases: number }>(
      `SELECT u.id, u.name, COALESCE(SUM(r.xp), 0) AS xp, COALESCE(AVG(r.score), 0) AS average, COUNT(r.id) AS cases
       FROM study_group_members m JOIN users u ON u.id = m.user_id
       LEFT JOIN results r ON r.user_id = u.id AND r.created_at > ?
       WHERE m.code = ? GROUP BY u.id, u.name ORDER BY xp DESC LIMIT 100`,
      now - WEEK_MS, g.code,
    );
    out.push({ code: g.code, name: g.name, members: rows.map((r) => ({ name: r.name, xp: Number(r.xp), average: Math.round(Number(r.average)), cases: Number(r.cases), me: r.id === userId })) });
  }
  return out;
}
