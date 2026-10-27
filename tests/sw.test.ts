import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(fileURLToPath(new URL("../public/sw.js", import.meta.url)), "utf8");
const ORIGIN = "https://ram.example";

type Handler = (event: Record<string, unknown>) => void;

/** Runs public/sw.js against a stand-in for the browser's service-worker scope. */
function worker(opts: { fetch?: (req: unknown) => Promise<Response>; windows?: { url: string }[] } = {}) {
  const on: Record<string, Handler> = {};
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const focused: string[] = [];
  const deleted: string[] = [];
  let preload = false;
  let claimed = false;
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => (on[type] = fn),
    skipWaiting: () => undefined,
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options }),
      navigationPreload: { enable: async () => void (preload = true) },
    },
    clients: {
      claim: async () => void (claimed = true),
      matchAll: async () => (opts.windows ?? []).map((w) => ({ ...w, focus: async () => void focused.push(w.url) })),
      openWindow: async (url: string) => void opened.push(url),
    },
  };
  // An in-memory CacheStorage.
  const store = new Map<string, Map<string, Response>>([["ramai-v1", new Map()]]);
  const keyOf = (r: unknown) => (typeof r === "string" ? r : (r as { url: string }).url);
  const cache = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name)!;
    return {
      match: async (r: unknown) => m.get(keyOf(r))?.clone(),
      put: async (r: unknown, res: Response) => void m.set(keyOf(r), res),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r: unknown) => m.delete(keyOf(r)),
    };
  };
  const caches = { keys: async () => [...store.keys()], open: async (n: string) => cache(n), delete: async (k: string) => (deleted.push(k), store.delete(k)) };
  runInNewContext(SOURCE, { self, caches, fetch: opts.fetch ?? (async () => new Response("page")), Response, URL, String, Object, JSON, Promise, setTimeout, Error });

  /** Fires an event; resolves with what the worker answered (respondWith) once its work (waitUntil) is done. */
  const fire = async (type: string, init: Record<string, unknown> = {}) => {
    let responded: Promise<Response> | undefined;
    let pending: Promise<unknown> | undefined;
    on[type]!({ ...init, respondWith: (p: Promise<Response>) => (responded = p), waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
    return responded ? await responded : undefined;
  };
  return { fire, shown, opened, focused, deleted, store, state: () => ({ preload, claimed }) };
}

const navigation = (path: string, method = "GET") => ({ request: { url: `${ORIGIN}${path}`, mode: "navigate", method }, preloadResponse: Promise.resolve(undefined) });

describe("the service worker", () => {
  it("starts clean: old caches go, navigation preload on, open pages taken over", async () => {
    const sw = worker();
    await sw.fire("activate");
    expect(sw.deleted).toEqual(["ramai-v1"]);
    expect(sw.state()).toEqual({ preload: true, claimed: true });
  });

  it("serves pages from the network, keeps a copy, and leaves the API and posts alone", async () => {
    const sw = worker({ fetch: async () => new Response("fresh page") });
    expect(await (await sw.fire("fetch", navigation("/leaderboard")))!.text()).toBe("fresh page");
    const preloaded = { ...navigation("/"), preloadResponse: Promise.resolve(new Response("preloaded")) };
    expect(await (await sw.fire("fetch", preloaded))!.text()).toBe("preloaded");
    expect(sw.store.get("ramai-pages-v1")?.has(`${ORIGIN}/leaderboard`)).toBe(true);
    expect(await sw.fire("fetch", navigation("/api/me/export"))).toBeUndefined();
    expect(await sw.fire("fetch", navigation("/login", "POST"))).toBeUndefined();
  });

  it("keeps the app's code on the phone after the first time", async () => {
    let n = 0;
    const sw = worker({ fetch: async () => new Response(`chunk ${++n}`) });
    const chunk = { request: { url: `${ORIGIN}/_next/static/x.js`, mode: "no-cors", method: "GET" } };
    expect(await (await sw.fire("fetch", chunk))!.text()).toBe("chunk 1");
    expect(await (await sw.fire("fetch", chunk))!.text()).toBe("chunk 1");
    expect(n).toBe(1);
  });

  it("opens a kept page offline, and the planner from the phone at once", async () => {
    let online = true;
    const sw = worker({ fetch: async () => (online ? new Response("live") : Promise.reject(new TypeError("offline"))) });
    await sw.fire("fetch", navigation("/cases"));
    await sw.fire("fetch", navigation("/plan"));
    online = false;
    expect(await (await sw.fire("fetch", navigation("/cases")))!.text()).toBe("live");
    expect(await (await sw.fire("fetch", navigation("/plan")))!.text()).toBe("live");
  });

  it("forgets kept pages on logout", async () => {
    const sw = worker({ fetch: async () => new Response("mine") });
    await sw.fire("fetch", navigation("/plan"));
    await sw.fire("message", { data: "ramai:forget" });
    expect(sw.store.has("ramai-pages-v1")).toBe(false);
  });

  it("shows its own offline page when there's no connection", async () => {
    const sw = worker({ fetch: async () => Promise.reject(new TypeError("Failed to fetch")) });
    const res = (await sw.fire("fetch", navigation("/case")))!;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    expect(await res.text()).toContain("You're offline");
  });

  it("shows the reminder it was sent, linking only to RamAI's own pages", async () => {
    const sw = worker();
    const message = (body: object) => ({ data: { json: () => body } });
    await sw.fire("push", message({ title: "🔥 Your 5-day streak ends in 5 hours", body: "One case keeps it alive.", url: "/" }));
    await sw.fire("push", message({ title: "x", body: "y", url: "https://evil.example/phish" }));
    await sw.fire("push", { data: null });
    expect(sw.shown[0]).toMatchObject({ title: "🔥 Your 5-day streak ends in 5 hours", options: { body: "One case keeps it alive.", tag: "ramai-daily", data: { url: `${ORIGIN}/` } } });
    expect(sw.shown[1]!.options.data).toEqual({ url: `${ORIGIN}/` });
    expect(sw.shown[2]).toMatchObject({ title: "RamAI", options: { body: "Today's patients are waiting." } });
  });

  it("brings an open RamAI window forward instead of navigating it away from a case", async () => {
    const tap = { notification: { close: () => undefined, data: { url: `${ORIGIN}/` } } };
    const open = worker({ windows: [{ url: `${ORIGIN}/case` }] });
    await open.fire("notificationclick", tap);
    expect(open.focused).toEqual([`${ORIGIN}/case`]);
    expect(open.opened).toEqual([]);

    const closed = worker({ windows: [{ url: "https://elsewhere.example/" }] });
    await closed.fire("notificationclick", tap);
    expect(closed.opened).toEqual([`${ORIGIN}/`]);
  });
});
