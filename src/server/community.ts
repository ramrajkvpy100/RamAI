/**
 * The community: posts, replies, likes and reports, in RamAI's own database.
 * Anyone can read; posting needs a free account. Every post and reply is read
 * by the model first (src/server/moderation.ts); three reports hide one until
 * an admin looks.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { rankFor } from "@/engine/progression";
import { TOPIC_IDS, type Author, type CaseSummary, type Post, type PostSummary, type Reply, type Topic } from "@/lib/community";

import { apiError, handleError } from "@/lib/server/http";

import type { User } from "./auth";
import { db } from "./db";
import { moderate } from "./moderation";
import { progressForMany } from "./progress";
import { overLimit } from "./rate-limit";
import { readShareId } from "./share";

export class CommunityError extends Error {
  constructor(
    public readonly code: "SIGNUP_REQUIRED" | "NOT_FOUND" | "BLOCKED" | "RATE_LIMITED" | "FORBIDDEN" | "BAD_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "CommunityError";
  }
}

const STATUS = { SIGNUP_REQUIRED: 403, NOT_FOUND: 404, BLOCKED: 422, RATE_LIMITED: 429, FORBIDDEN: 403, BAD_INPUT: 400 } as const;

/** The API's answer for a community error (or any other). */
export const communityFailure = (err: unknown) => (err instanceof CommunityError ? apiError(STATUS[err.code], err.code, err.message) : handleError(err));

/** Reports that hide a post or reply until an admin looks. */
const HIDE_AT = 3;
const PAGE = 20;

interface PostRow {
  id: string;
  user_id: string;
  topic: Topic;
  title: string;
  body: string;
  share_id: string | null;
  spoiler: number;
  reply_count: number;
  like_count: number;
  created_at: number;
  last_activity_at: number;
  name: string;
  username: string;
}

interface ReplyRow {
  id: string;
  user_id: string;
  body: string;
  like_count: number;
  created_at: number;
  name: string;
  username: string;
}

async function authors(userIds: string[]): Promise<Map<string, { rankTier: number; rankLabel: string }>> {
  const progress = await progressForMany(userIds);
  return new Map([...progress].map(([id, p]) => {
    const rank = rankFor(p.percent);
    return [id, { rankTier: rank.tier, rankLabel: rank.label }];
  }));
}

const author = (row: { user_id: string; name: string; username: string }, ranks: Map<string, { rankTier: number; rankLabel: string }>): Author => ({
  // Guests are told apart by their handle's tag: "Guest doctor · 4f3a".
  name: row.username.startsWith("guest-") ? `${row.name} · ${row.username.slice(6, 10)}` : row.name,
  username: row.username,
  ...(ranks.get(row.user_id) ?? { rankTier: 1, rankLabel: "Medical Student" }),
});

async function likedBy(viewerId: string | undefined, targets: string[]): Promise<Set<string>> {
  if (!viewerId || targets.length === 0) return new Set();
  const rows = await db.all<{ target: string }>(`SELECT target FROM likes WHERE user_id = ? AND target IN (${targets.map(() => "?").join(", ")})`, viewerId, ...targets);
  return new Set(rows.map((r) => r.target));
}

function summary(row: PostRow, ranks: Map<string, { rankTier: number; rankLabel: string }>, liked: Set<string>, viewerId?: string): PostSummary {
  const flat = row.body.replace(/\s+/g, " ").trim();
  return {
    id: row.id,
    topic: row.topic,
    title: row.title,
    excerpt: flat.length > 220 ? `${flat.slice(0, 217).trimEnd()}…` : flat,
    author: author(row, ranks),
    spoiler: row.spoiler === 1,
    shareId: row.share_id,
    replies: row.reply_count,
    likes: row.like_count,
    liked: liked.has(`p:${row.id}`),
    mine: row.user_id === viewerId,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
  };
}

/** The feed: most recently active first, optionally one topic; `before` pages back. */
export async function listPosts(opts: { topic?: Topic; before?: number; viewerId?: string } = {}): Promise<{ posts: PostSummary[]; more: boolean }> {
  const where = ["p.hidden = 0"];
  const args: (string | number)[] = [];
  if (opts.topic) (where.push("p.topic = ?"), args.push(opts.topic));
  if (opts.before) (where.push("p.last_activity_at < ?"), args.push(opts.before));
  const rows = await db.all<PostRow>(
    `SELECT p.*, u.name, u.username FROM posts p JOIN users u ON u.id = p.user_id WHERE ${where.join(" AND ")} ORDER BY p.last_activity_at DESC LIMIT ?`,
    ...args,
    PAGE + 1,
  );
  const page = rows.slice(0, PAGE);
  const [ranks, liked] = await Promise.all([authors(page.map((r) => r.user_id)), likedBy(opts.viewerId, page.map((r) => `p:${r.id}`))]);
  return { posts: page.map((r) => summary(r, ranks, liked, opts.viewerId)), more: rows.length > PAGE };
}

export async function getPost(id: string, viewerId?: string): Promise<Post | null> {
  const row = await db.get<PostRow>("SELECT p.*, u.name, u.username FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ? AND p.hidden = 0", id);
  if (!row) return null;
  const replies = await db.all<ReplyRow>("SELECT r.*, u.name, u.username FROM replies r JOIN users u ON u.id = r.user_id WHERE r.post_id = ? AND r.hidden = 0 ORDER BY r.created_at ASC LIMIT 500", id);
  const [ranks, liked] = await Promise.all([authors([row.user_id, ...replies.map((r) => r.user_id)]), likedBy(viewerId, [`p:${id}`, ...replies.map((r) => `r:${r.id}`)])]);
  const discussed = await discussedCase(row.share_id);
  return {
    ...summary(row, ranks, liked, viewerId),
    ...(discussed ? { case: discussed } : {}),
    body: row.body,
    replyList: replies.map(
      (r): Reply => ({ id: r.id, body: r.body, author: author(r, ranks), likes: r.like_count, liked: liked.has(`r:${r.id}`), mine: r.user_id === viewerId, createdAt: r.created_at }),
    ),
  };
}

/** The case a post discusses: its shared result's summary, kept when the case closed. */
async function discussedCase(shareId: string | null): Promise<CaseSummary | null> {
  const share = shareId ? readShareId(shareId) : null;
  if (share?.kind !== "r") return null;
  const row = await db.get<{ summary: string | null }>("SELECT summary FROM results WHERE id = ?", Number(share.value));
  if (!row?.summary) return null;
  try {
    return JSON.parse(row.summary) as CaseSummary;
  } catch {
    return null;
  }
}

/** Everyone can write — guests too (a visitor becomes one on their first post); the model reads everything first. */
function canWrite(_user: User) {}

export async function createPost(user: User, input: { topic: Topic; title: string; body: string; shareId?: string | null; spoiler?: boolean }): Promise<{ id: string }> {
  canWrite(user);
  if (!TOPIC_IDS.includes(input.topic)) throw new CommunityError("BAD_INPUT", "Choose a topic.");
  if (await overLimit(`post:${user.id}`, 6, 3_600_000)) throw new CommunityError("RATE_LIMITED", "That's plenty of posts for one hour — reply to others meanwhile.");
  // A case card can be attached only if it really is a share link (the card shows only what the database says).
  const shareId = input.shareId && readShareId(input.shareId) ? input.shareId : null;
  const verdict = await moderate(`${input.title}\n\n${input.body}`);
  if (!verdict.allowed) throw new CommunityError("BLOCKED", verdict.message);
  const id = randomUUID();
  const now = Date.now();
  await db.run(
    "INSERT INTO posts (id, user_id, topic, title, body, share_id, spoiler, created_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, user.id, input.topic, input.title, input.body, shareId, input.spoiler ? 1 : 0, now, now,
  );
  return { id };
}

export async function createReply(user: User, postId: string, body: string): Promise<Reply> {
  canWrite(user);
  const post = await db.get<{ id: string }>("SELECT id FROM posts WHERE id = ? AND hidden = 0", postId);
  if (!post) throw new CommunityError("NOT_FOUND", "That post isn't there any more.");
  if (await overLimit(`reply:${user.id}`, 40, 3_600_000)) throw new CommunityError("RATE_LIMITED", "That's a lot of replies for one hour — please slow down.");
  const verdict = await moderate(body);
  if (!verdict.allowed) throw new CommunityError("BLOCKED", verdict.message);
  const id = randomUUID();
  const now = Date.now();
  await db.batch([
    { sql: "INSERT INTO replies (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)", args: [id, postId, user.id, body, now] },
    { sql: "UPDATE posts SET reply_count = reply_count + 1, last_activity_at = ? WHERE id = ?", args: [now, postId] },
  ]);
  const ranks = await authors([user.id]);
  return { id, body, author: author({ user_id: user.id, name: user.name, username: user.username }, ranks), likes: 0, liked: false, mine: true, createdAt: now };
}

const parseTarget = (target: string) => {
  const m = target.match(/^([pr]):([0-9a-f-]{36})$/);
  return m ? { kind: m[1] as "p" | "r", id: m[2]!, table: m[1] === "p" ? "posts" : "replies" } : null;
};

/** Likes and unlikes a post or reply; returns its new count. Guests can like too. */
export async function toggleLike(user: User, target: string): Promise<{ liked: boolean; likes: number }> {
  const t = parseTarget(target);
  if (!t) throw new CommunityError("NOT_FOUND", "Not found.");
  if (!(await db.get(`SELECT 1 AS x FROM ${t.table} WHERE id = ? AND hidden = 0`, t.id))) throw new CommunityError("NOT_FOUND", "Not found.");
  const removed = await db.run("DELETE FROM likes WHERE target = ? AND user_id = ?", target, user.id);
  if (removed.changes === 0) await db.run("INSERT OR IGNORE INTO likes (target, user_id, created_at) VALUES (?, ?, ?)", target, user.id, Date.now());
  const likes = (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM likes WHERE target = ?", target))?.n ?? 0;
  await db.run(`UPDATE ${t.table} SET like_count = ? WHERE id = ?`, likes, t.id);
  return { liked: removed.changes === 0, likes };
}

/** Reports a post or reply once per person; three reports hide it until an admin looks. */
export async function report(user: User, target: string, reason?: string): Promise<void> {
  const t = parseTarget(target);
  if (!t) throw new CommunityError("NOT_FOUND", "Not found.");
  const added = await db.run("INSERT OR IGNORE INTO reports (target, user_id, reason, created_at) VALUES (?, ?, ?, ?)", target, user.id, reason?.slice(0, 200) ?? null, Date.now());
  if (added.changes === 0) return;
  await db.run(`UPDATE ${t.table} SET report_count = report_count + 1, hidden = CASE WHEN report_count + 1 >= ? THEN 1 ELSE hidden END WHERE id = ?`, HIDE_AT, t.id);
}

/** Removes your own post (with its replies) or reply — or anyone's, for an admin. */
export async function remove(user: User, target: string, admin = false): Promise<void> {
  const t = parseTarget(target);
  if (!t) throw new CommunityError("NOT_FOUND", "Not found.");
  const row = await db.get<{ user_id: string; post_id?: string }>(`SELECT user_id${t.kind === "r" ? ", post_id" : ""} FROM ${t.table} WHERE id = ?`, t.id);
  if (!row) throw new CommunityError("NOT_FOUND", "That's already gone.");
  if (row.user_id !== user.id && !admin) throw new CommunityError("FORBIDDEN", "You can only remove your own posts.");
  if (t.kind === "p") {
    await db.batch([
      { sql: "DELETE FROM likes WHERE target = ? OR target IN (SELECT 'r:' || id FROM replies WHERE post_id = ?)", args: [target, t.id] },
      { sql: "DELETE FROM replies WHERE post_id = ?", args: [t.id] },
      { sql: "DELETE FROM posts WHERE id = ?", args: [t.id] },
    ]);
  } else {
    await db.batch([
      { sql: "DELETE FROM likes WHERE target = ?", args: [target] },
      { sql: "DELETE FROM replies WHERE id = ?", args: [t.id] },
      { sql: "UPDATE posts SET reply_count = MAX(0, reply_count - 1) WHERE id = ?", args: [row.post_id ?? ""] },
    ]);
  }
}

/** Admins: what's been hidden by reports, to restore or remove. */
export async function hiddenItems(): Promise<{ target: string; text: string; reports: number }[]> {
  const posts = await db.all<{ id: string; title: string; report_count: number }>("SELECT id, title, report_count FROM posts WHERE hidden = 1 ORDER BY created_at DESC LIMIT 100");
  const replies = await db.all<{ id: string; body: string; report_count: number }>("SELECT id, body, report_count FROM replies WHERE hidden = 1 ORDER BY created_at DESC LIMIT 100");
  return [...posts.map((p) => ({ target: `p:${p.id}`, text: p.title, reports: p.report_count })), ...replies.map((r) => ({ target: `r:${r.id}`, text: r.body.slice(0, 200), reports: r.report_count }))];
}

export async function restore(target: string): Promise<void> {
  const t = parseTarget(target);
  if (!t) throw new CommunityError("NOT_FOUND", "Not found.");
  await db.batch([
    { sql: `UPDATE ${t.table} SET hidden = 0, report_count = 0 WHERE id = ?`, args: [t.id] },
    { sql: "DELETE FROM reports WHERE target = ?", args: [target] },
  ]);
}
