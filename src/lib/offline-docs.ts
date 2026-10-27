"use client";

/**
 * Planner documents saved while offline: kept on the phone and sent when the connection is back (each document's
 * latest version only — the phone's copy wins over the account's until it has gone up).
 */
const KEY = "ramai.pending.docs";

const read = (): Record<string, unknown> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>; } catch { return {}; }
};
const write = (p: Record<string, unknown>) => {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
};

/** The version of a document still waiting to go up, if any. */
export const pendingDoc = (doc: string): unknown => read()[doc];

let flushing: Promise<boolean> | null = null;
/** Sends everything waiting; true when nothing is left. */
export function flushDocs(): Promise<boolean> {
  flushing ??= (async () => {
    for (const [doc, data] of Object.entries(read())) {
      const r = await fetch("/api/planner", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc, data }) }).catch(() => null);
      if (!r?.ok) return false;
      const now = read();
      // Changed again while it was going up: the newer one stays for next time.
      if (JSON.stringify(now[doc]) === JSON.stringify(data)) {
        delete now[doc];
        write(now);
      }
    }
    return Object.keys(read()).length === 0;
  })().finally(() => { flushing = null; });
  return flushing;
}

/** Saves a planner document: on the phone at once, to the account as soon as it can. */
export function saveDoc(doc: string, data: unknown): Promise<boolean> {
  write({ ...read(), [doc]: data });
  return flushDocs();
}

/* Results finished offline (a Skills Lab round's score): sent when the connection is back. ---------------------- */
const POSTS = "ramai.pending.posts";
const posts = (): { url: string; body: unknown }[] => {
  try { return JSON.parse(localStorage.getItem(POSTS) ?? "[]") as { url: string; body: unknown }[]; } catch { return []; }
};
/** Posts it now, or keeps it for later when there's no connection. Only RamAI's own result routes. */
export async function postOrQueue(url: "/api/practice/result", body: unknown): Promise<void> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (r) return;
  try { localStorage.setItem(POSTS, JSON.stringify([...posts(), { url, body }].slice(-50))); } catch {}
}
async function flushPosts() {
  const left: { url: string; body: unknown }[] = [];
  for (const p of posts()) {
    if (p.url !== "/api/practice/result") continue;
    const r = await fetch(p.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p.body) }).catch(() => null);
    if (!r) left.push(p);
  }
  try { localStorage.setItem(POSTS, JSON.stringify(left)); } catch {}
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void flushDocs(); void flushPosts(); });
  setTimeout(() => { if (posts().length) void flushPosts(); }, 3500);
  // Anything left from last time goes up when the app opens.
  setTimeout(() => { if (Object.keys(read()).length) void flushDocs(); }, 3000);
}
