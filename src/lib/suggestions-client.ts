/** The browser's side of suggestions: send one, read your own, and (admins) manage them all. */
import { ClinicalEngineError } from "./engine-client";

export const CATEGORY_LABEL = { idea: "Idea", problem: "Problem", case: "Case request", other: "Other" } as const;
export const STATUS_LABEL = { new: "New", reviewing: "Looking into it", planned: "Planned", done: "Done", declined: "Not planned" } as const;
export type SuggestionCategory = keyof typeof CATEGORY_LABEL;
export type SuggestionStatus = keyof typeof STATUS_LABEL;

export interface Suggestion {
  id: string;
  category: SuggestionCategory;
  message: string;
  page: string | null;
  status: SuggestionStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  name?: string;
  email?: string;
}

export type StatusCounts = Record<SuggestionStatus | "all", number>;

async function request<T>(path: string, init?: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ClinicalEngineError("NETWORK", "You're offline. Check your connection and try again.", true);
  }
  const json = (await res.json().catch(() => null)) as ({ error?: { code?: string; message?: string } } & T) | null;
  if (!res.ok) throw new ClinicalEngineError(json?.error?.code ?? "FAILED", json?.error?.message ?? "Something went wrong. Please try again.", res.status >= 500);
  return json as T;
}

export const sendSuggestion = (body: { category: SuggestionCategory; message: string; page?: string; email?: string }) =>
  request<{ suggestion: Suggestion }>("/api/suggestions", { method: "POST", body });
export const mySuggestions = () => request<{ items: Suggestion[] }>("/api/suggestions");
export const adminSuggestions = (filter: { status?: SuggestionStatus; category?: SuggestionCategory; q?: string }) =>
  request<{ items: Suggestion[]; counts: StatusCounts }>(`/api/admin/suggestions?${new URLSearchParams(Object.entries(filter).filter(([, v]) => !!v) as [string, string][])}`);
export const answerSuggestion = (id: string, patch: { status?: SuggestionStatus; reply?: string | null }) =>
  request<{ suggestion: Suggestion }>(`/api/admin/suggestions/${id}`, { method: "PATCH", body: patch });
export const removeSuggestion = (id: string) => request<{ ok: true }>(`/api/admin/suggestions/${id}`, { method: "DELETE" });
