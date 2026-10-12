/**
 * Players' suggestions, kept in Supabase (public.suggestions — see
 * supabase/migrations). Every query runs as the signed-in player, so the
 * database's row-level security decides what each person may see or change:
 * players their own, admins everything.
 */
import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { SITE } from "@/lib/site";

import { randomUUID } from "node:crypto";

import type { User } from "./auth";
import { db } from "./db";
import { currentAccount, supabaseServer } from "./supabase";

export const SUGGESTION_CATEGORIES = ["idea", "problem", "case", "other"] as const;
export const SUGGESTION_STATUSES = ["new", "reviewing", "planned", "done", "declined"] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export interface Suggestion {
  id: string;
  category: SuggestionCategory;
  message: string;
  page: string | null;
  status: SuggestionStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  /** Who sent it — admins only. */
  name?: string;
  email?: string;
}

export class SuggestionsError extends Error {
  constructor(
    public readonly code: "UNAVAILABLE" | "NOT_FOUND" | "FORBIDDEN" | "FAILED",
    message: string,
  ) {
    super(message);
    this.name = "SuggestionsError";
  }
}

const COLUMNS = "id, category, message, page, status, reply, replied_at, created_at";
const ADMIN_COLUMNS = `${COLUMNS}, name, email`;

interface Row {
  id: string;
  category: SuggestionCategory;
  message: string;
  page: string | null;
  status: SuggestionStatus;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  name?: string;
  email?: string;
}

const toSuggestion = (r: Row): Suggestion => ({
  id: r.id,
  category: r.category,
  message: r.message,
  page: r.page,
  status: r.status,
  reply: r.reply,
  repliedAt: r.replied_at,
  createdAt: r.created_at,
  ...(r.email ? { name: r.name, email: r.email } : {}),
});

function fail(error: PostgrestError): never {
  if (error.code === "PGRST205" || error.code === "42P01") {
    console.error("[ramai] Supabase has no public.suggestions table yet — run supabase/migrations/20261011000000_suggestions.sql in its SQL editor.");
    throw new SuggestionsError("UNAVAILABLE", "Suggestions aren't switched on yet. Please try again later.");
  }
  if (error.code === "42501") throw new SuggestionsError("FORBIDDEN", "That isn't allowed.");
  console.error("[ramai] suggestions:", error.code, error.message);
  throw new SuggestionsError("FAILED", "That didn't save. Please try again.");
}

/** Sends a suggestion as the signed-in player. */
export async function sendSuggestion(user: User, input: { category: SuggestionCategory; message: string; page?: string | null }): Promise<Suggestion> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("suggestions")
    .insert({ name: user.name.slice(0, 80), email: user.email, category: input.category, message: input.message, page: input.page ?? null })
    .select(COLUMNS)
    .single();
  if (error) fail(error);
  return toSuggestion(data as Row);
}

/** The signed-in player's own suggestions, newest first, with any answers (and any sent as a guest before signing up). */
export async function mySuggestions(user?: User | null): Promise<Suggestion[]> {
  const account = await currentAccount();
  const asGuest = user ? await openSuggestionsOf(user.id) : [];
  if (!account) return asGuest;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("suggestions").select(COLUMNS).eq("user_id", account.id).order("created_at", { ascending: false }).limit(50);
  if (error) fail(error);
  return [...(data as Row[]).map(toSuggestion), ...asGuest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------------------------------------------------- */
/* Without an account: guests and visitors                                     */
/* -------------------------------------------------------------------------- */

/** Ids of suggestions kept in RamAI's own database start with this; Supabase's are plain UUIDs. */
const OPEN = "g-";
const isOpen = (id: string) => id.startsWith(OPEN);

interface OpenRow {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  category: SuggestionCategory;
  message: string;
  page: string | null;
  status: SuggestionStatus;
  reply: string | null;
  replied_at: number | null;
  created_at: number;
}

const fromOpen = (r: OpenRow, admin = false): Suggestion => ({
  id: r.id,
  category: r.category,
  message: r.message,
  page: r.page,
  status: r.status,
  reply: r.reply,
  repliedAt: r.replied_at ? new Date(r.replied_at).toISOString() : null,
  createdAt: new Date(r.created_at).toISOString(),
  ...(admin ? { name: r.name, email: r.email ?? "" } : {}),
});

/** A guest's or visitor's suggestion. The email is optional — it's how we can answer someone without an account. */
export async function sendOpenSuggestion(user: User | null, input: { category: SuggestionCategory; message: string; page?: string | null; email?: string | null }): Promise<Suggestion> {
  const row: OpenRow = {
    id: `${OPEN}${randomUUID()}`,
    user_id: user?.id ?? null,
    name: user ? "Guest doctor" : "Visitor",
    email: input.email?.trim().toLowerCase() || null,
    category: input.category,
    message: input.message,
    page: input.page ?? null,
    status: "new",
    reply: null,
    replied_at: null,
    created_at: Date.now(),
  };
  await db.run(
    "INSERT INTO open_suggestions (id, user_id, name, email, category, message, page, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)",
    row.id, row.user_id, row.name, row.email, row.category, row.message, row.page, row.created_at,
  );
  return fromOpen(row);
}

async function openSuggestionsOf(userId: string): Promise<Suggestion[]> {
  return (await db.all<OpenRow>("SELECT * FROM open_suggestions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", userId)).map((r) => fromOpen(r));
}

/** Emails that may be admins (the database has the final say). */
const adminEmails = () =>
  (process.env.RAMAI_ADMIN_EMAILS ?? SITE.email)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Whether the signed-in player is an admin — asked of the database itself. */
export async function isAdmin(user?: User | null): Promise<boolean> {
  if (user && !adminEmails().includes(user.email.toLowerCase())) return false;
  if (!(await currentAccount())) return false;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    if (error.code !== "PGRST202") console.error("[ramai] is_admin:", error.code, error.message);
    return false;
  }
  return data === true;
}

export type StatusCounts = Record<SuggestionStatus | "all", number>;

/** Admins: suggestions, filtered, with a count for each status. */
export async function listSuggestions(filter: { status?: SuggestionStatus; category?: SuggestionCategory; q?: string } = {}): Promise<{ items: Suggestion[]; counts: StatusCounts }> {
  const supabase = await supabaseServer();
  let query = supabase.from("suggestions").select(ADMIN_COLUMNS).order("created_at", { ascending: false }).limit(300);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.category) query = query.eq("category", filter.category);
  const q = filter.q?.replace(/[%_*,()\\]/g, " ").trim();
  if (q) query = query.ilike("message", `%${q}%`);
  const where: string[] = [];
  const args: string[] = [];
  if (filter.status) (where.push("status = ?"), args.push(filter.status));
  if (filter.category) (where.push("category = ?"), args.push(filter.category));
  if (q) (where.push("message LIKE ?"), args.push(`%${q}%`));
  const [{ data, error }, all, open, openAll] = await Promise.all([
    query,
    supabase.from("suggestions").select("status").limit(10_000),
    db.all<OpenRow>(`SELECT * FROM open_suggestions ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 300`, ...args),
    db.all<{ status: SuggestionStatus }>("SELECT status FROM open_suggestions"),
  ]);
  if (error) fail(error);
  if (all.error) fail(all.error);
  const counts = Object.fromEntries([["all", 0], ...SUGGESTION_STATUSES.map((s) => [s, 0])]) as StatusCounts;
  for (const r of [...(all.data as { status: SuggestionStatus }[]), ...openAll]) {
    counts.all += 1;
    counts[r.status] += 1;
  }
  const items = [...(data as Row[]).map(toSuggestion), ...open.map((r) => fromOpen(r, true))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, counts };
}

/** Admins: answer a suggestion and/or move it along. */
export async function answerSuggestion(id: string, patch: { status?: SuggestionStatus; reply?: string | null }): Promise<Suggestion> {
  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.reply !== undefined) update.reply = patch.reply?.trim() ? patch.reply.trim() : null;
  if (isOpen(id)) {
    const set: string[] = [];
    const args: (string | number | null)[] = [];
    if (update.status) (set.push("status = ?"), args.push(update.status as string));
    if ("reply" in update) (set.push("reply = ?", "replied_at = ?"), args.push(update.reply as string | null, update.reply ? Date.now() : null));
    const done = await db.run(`UPDATE open_suggestions SET ${set.join(", ")} WHERE id = ?`, ...args, id);
    const row = await db.get<OpenRow>("SELECT * FROM open_suggestions WHERE id = ?", id);
    if (!done.changes || !row) throw new SuggestionsError("NOT_FOUND", "That suggestion isn't there any more.");
    return fromOpen(row, true);
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("suggestions").update(update).eq("id", id).select(ADMIN_COLUMNS).maybeSingle();
  if (error) fail(error);
  if (!data) throw new SuggestionsError("NOT_FOUND", "That suggestion isn't there any more.");
  return toSuggestion(data as Row);
}

/** Admins: how many suggestions are still new. */
export async function newSuggestionCount(): Promise<number> {
  const supabase = await supabaseServer();
  const [{ count, error }, open] = await Promise.all([
    supabase.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "new"),
    db.get<{ n: number }>("SELECT COUNT(*) AS n FROM open_suggestions WHERE status = 'new'").catch(() => undefined),
  ]);
  return (error ? 0 : (count ?? 0)) + (open?.n ?? 0);
}

export async function deleteSuggestion(id: string): Promise<void> {
  if (isOpen(id)) {
    const done = await db.run("DELETE FROM open_suggestions WHERE id = ?", id);
    if (!done.changes) throw new SuggestionsError("NOT_FOUND", "That suggestion isn't there any more.");
    return;
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("suggestions").delete().eq("id", id).select("id");
  if (error) fail(error);
  if (!data?.length) throw new SuggestionsError("NOT_FOUND", "That suggestion isn't there any more.");
}
