/**
 * Players' suggestions, kept in Supabase (public.suggestions — see
 * supabase/migrations). Every query runs as the signed-in player, so the
 * database's row-level security decides what each person may see or change:
 * players their own, admins everything.
 */
import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { SITE } from "@/lib/site";

import type { User } from "./auth";
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

/** The signed-in player's own suggestions, newest first, with any answers. */
export async function mySuggestions(): Promise<Suggestion[]> {
  const account = await currentAccount();
  if (!account) return [];
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("suggestions").select(COLUMNS).eq("user_id", account.id).order("created_at", { ascending: false }).limit(50);
  if (error) fail(error);
  return (data as Row[]).map(toSuggestion);
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
  const [{ data, error }, all] = await Promise.all([query, supabase.from("suggestions").select("status").limit(10_000)]);
  if (error) fail(error);
  if (all.error) fail(all.error);
  const counts = Object.fromEntries([["all", 0], ...SUGGESTION_STATUSES.map((s) => [s, 0])]) as StatusCounts;
  for (const r of all.data as { status: SuggestionStatus }[]) {
    counts.all += 1;
    counts[r.status] += 1;
  }
  return { items: (data as Row[]).map(toSuggestion), counts };
}

/** Admins: answer a suggestion and/or move it along. */
export async function answerSuggestion(id: string, patch: { status?: SuggestionStatus; reply?: string | null }): Promise<Suggestion> {
  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.reply !== undefined) update.reply = patch.reply?.trim() ? patch.reply.trim() : null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("suggestions").update(update).eq("id", id).select(ADMIN_COLUMNS).maybeSingle();
  if (error) fail(error);
  if (!data) throw new SuggestionsError("NOT_FOUND", "That suggestion isn't there any more.");
  return toSuggestion(data as Row);
}

/** Admins: how many suggestions are still new. */
export async function newSuggestionCount(): Promise<number> {
  const supabase = await supabaseServer();
  const { count, error } = await supabase.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "new");
  if (error) return 0;
  return count ?? 0;
}

export async function deleteSuggestion(id: string): Promise<void> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("suggestions").delete().eq("id", id).select("id");
  if (error) fail(error);
  if (!data?.length) throw new SuggestionsError("NOT_FOUND", "That suggestion isn't there any more.");
}
