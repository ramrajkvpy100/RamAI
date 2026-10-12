/** The browser's side of the community. */
import type { Post, PostSummary, Reply, Topic } from "@/lib/community";

import { ClinicalEngineError } from "@/lib/engine-client";

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ClinicalEngineError("NETWORK", "You're offline. Check your connection and try again.", true);
  }
  const json = (await res.json().catch(() => null)) as ({ error?: { code?: string; message?: string } } & T) | null;
  if (!res.ok) throw new ClinicalEngineError(json?.error?.code ?? "FAILED", json?.error?.message ?? "Something went wrong. Please try again.", res.status >= 500);
  return json as T;
}

export const feed = (topic?: Topic, before?: number) => call<{ posts: PostSummary[]; more: boolean }>(`/api/community?${new URLSearchParams({ ...(topic ? { topic } : {}), ...(before ? { before: String(before) } : {}) })}`);
export const loadPost = (id: string) => call<{ post: Post }>(`/api/community/${id}`);
export const newPost = (body: { topic: Topic; title: string; body: string; shareId?: string | null; spoiler?: boolean }) => call<{ id: string }>("/api/community", body);
export const newReply = (postId: string, body: string) => call<{ reply: Reply }>(`/api/community/${postId}`, { body });
export const like = (target: string) => call<{ liked: boolean; likes: number }>("/api/community/action", { action: "like", target });
export const reportItem = (target: string, reason?: string) => call<{ ok: true }>("/api/community/action", { action: "report", target, reason });
export const removeItem = (target: string) => call<{ ok: true }>("/api/community/action", { action: "remove", target });

export function ago(ms: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
