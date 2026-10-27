/*
 * RamAI service worker — what makes the app fast and work offline.
 *   · The app's code (/_next/static — every file name is unique to its build)
 *     and pictures, sounds and videos come from the phone after the first time.
 *   · Pages you've opened are kept on the phone too: the planner, focus timer,
 *     revision deck, profile, achievements, Learn and the Skills Lab open
 *     instantly from it and refresh in the background; other pages try the
 *     network first and use the kept copy when there's no connection (or it's
 *     too slow). Logging out empties the kept pages.
 *   · The daily reminder: shows the (end-to-end encrypted) message it carries.
 */

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Offline · RamAI</title><style>
:root{color-scheme:light dark;--bg:#f4f6fb;--card:rgba(255,255,255,.72);--fg:#0b1220;--fg2:#5b6475;--line:rgba(15,23,42,.08)}
@media (prefers-color-scheme:dark){:root{--bg:#05070d;--card:rgba(28,30,38,.72);--fg:#f5f7fb;--fg2:#9aa3b5;--line:rgba(255,255,255,.08)}}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(60% 50% at 15% 0%,rgba(124,58,237,.18),transparent 70%),radial-gradient(50% 50% at 90% 10%,rgba(6,182,212,.16),transparent 70%),var(--bg);color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.card{max-width:360px;padding:32px 28px;text-align:center;border-radius:24px;background:var(--card);border:1px solid var(--line);box-shadow:0 20px 60px -20px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(30px) saturate(1.8);backdrop-filter:blur(30px) saturate(1.8)}
h1{margin:16px 0 6px;font-size:21px;letter-spacing:-.02em}p{margin:0;color:var(--fg2)}
button{margin-top:22px;height:44px;padding:0 24px;border:0;border-radius:999px;color:#fff;font-family:inherit;font-size:15px;font-weight:600;line-height:1;background:linear-gradient(135deg,#7c3aed,#2563eb 55%,#06b6d4);cursor:pointer}
</style></head><body><main class="card"><svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset=".5" stop-color="#2563eb"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><rect width="64" height="64" rx="19" fill="url(#g)"/><path d="M10 35h12l4-9 6 19 5-14 3 4h14" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
<h1>You're offline</h1><p>This page needs a connection — open it once online and it'll work offline after. Your planner, focus timer and revision deck work offline. Your progress is safe — this page reloads by itself when you're back online.</p><button onclick="location.reload()">Try again</button></main>
<script>addEventListener("online",function(){location.reload()})</script></body></html>`;

const STATIC = "ramai-static-v1";
// Bump to empty the kept pages after a change to how they're kept.
const MEDIA = "ramai-media-v1";
const PAGES = "ramai-pages-v1";
const KEEP = [STATIC, MEDIA, PAGES];

/** Opened from the phone at once, refreshed behind the scenes (they draw from what's kept on the phone anyway). */
const INSTANT = /^\/(plan|focus|revision|profile|achievements|learn|practice)(\/|$)/;
// Not videos or sounds: those are streamed in pieces, which the browser's own cache already handles.
const MEDIA_RE = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?)$/i;

/** Opened offline even before you've visited them: fetched with the code each one needs. */
const READY = ["/", "/plan", "/focus", "/revision", "/practice", "/achievements", "/profile", "/progress"];

async function keepReady() {
  const [pages, code] = await Promise.all([caches.open(PAGES), caches.open(STATIC)]);
  await Promise.all(
    READY.map(async (u) => {
      try {
        const res = await fetch(u, { credentials: "include" });
        if (!keepable(res) || res.status !== 200) return;
        const html = await res.clone().text();
        await pages.put(self.location.origin + u, res);
        const chunks = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])].slice(0, 80);
        await Promise.all(chunks.map((c) => code.match(c).then((hit) => hit || fetch(c).then((r) => (r.ok ? code.put(c, r) : undefined))).catch(() => undefined)));
      } catch {}
    }),
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(keepReady());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Logging out: the kept pages are personal.
  if (event.data === "ramai:forget") event.waitUntil(caches.delete(PAGES));
  // Signed in (or the app opened): get the offline pages ready, at most once an hour.
  if (event.data === "ramai:ready" && Date.now() - lastReady > 3_600_000) {
    lastReady = Date.now();
    event.waitUntil(keepReady());
  }
});
let lastReady = 0;

const keepable = (res) => res && res.ok && (res.type === "basic" || res.type === "default") && !res.redirected;

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

/** From the phone if it's there, otherwise from the network (and kept). */
async function fromPhone(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (keepable(res) && res.status === 200) {
    await c.put(req, res.clone());
    if (max) trim(name, max);
  }
  return res;
}

const pageKey = (url) => url.origin + url.pathname;

/** A focus sound or video: the whole file from the phone; the first time, fetched whole (not in pieces) and kept. */
async function focusMedia(req) {
  const c = await caches.open(MEDIA);
  const key = req.url;
  const hit = await c.match(key);
  if (hit) return hit;
  if (req.headers.get("range")) {
    // Played in pieces from the network this time; the whole file is kept for next time.
    fetch(key).then((r) => (r.ok && r.status === 200 ? c.put(key, r) : undefined)).catch(() => undefined);
    return fetch(req);
  }
  const res = await fetch(req);
  if (res.ok && res.status === 200) await c.put(key, res.clone());
  return res;
}

async function page(event, url) {
  const c = await caches.open(PAGES);
  const key = pageKey(url);
  const network = (async () => {
    const res = (await event.preloadResponse) || (await fetch(event.request));
    if (keepable(res) && res.status === 200) {
      await c.put(key, res.clone());
      trim(PAGES, 40);
    }
    return res;
  })();
  const kept = await c.match(key);
  if (kept && INSTANT.test(url.pathname)) {
    event.waitUntil(network.catch(() => undefined));
    return kept;
  }
  // Everything else: the network, unless it fails or takes too long and there's a kept copy.
  try {
    if (!kept) return await network;
    return await Promise.race([network, new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000))]);
  } catch {
    if (kept) {
      event.waitUntil(network.catch(() => undefined));
      return kept;
    }
    return new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Skills Lab pictures never change for an id: kept on the phone, so rounds played work offline.
  if (url.pathname.startsWith("/api/practice/image/")) return event.respondWith(fromPhone(req, MEDIA, 300));
  if (url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") return event.respondWith(page(event, url));
  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(fromPhone(req, STATIC, 400));
  if (!url.search && MEDIA_RE.test(url.pathname) && !url.pathname.startsWith("/_next/")) return event.respondWith(fromPhone(req, MEDIA, 300));
  // The focus timer's sounds and short scene videos: whole files kept, so focus works offline.
  if (!url.search && url.pathname.startsWith("/focus/") && /\.(mp3|ogg|mp4|webm)$/i.test(url.pathname)) return event.respondWith(focusMedia(req));
});

/** Only ever opens RamAI's own pages. */
const ownUrl = (url) => {
  try {
    const u = new URL(url || "/", self.location.origin);
    return u.origin === self.location.origin ? u.href : self.location.origin + "/";
  } catch {
    return self.location.origin + "/";
  }
};

self.addEventListener("push", (event) => {
  let note = { title: "RamAI", body: "Today's patients are waiting.", url: "/" };
  try {
    if (event.data) note = Object.assign(note, event.data.json());
  } catch {}
  event.waitUntil(
    self.registration.showNotification(String(note.title).slice(0, 120), {
      body: String(note.body).slice(0, 300),
      icon: "/icon-192.png",
      badge: "/icon-badge.png",
      tag: note.tag || "ramai-daily",
      data: { url: ownUrl(note.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = ownUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const open = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).find((c) => new URL(c.url).origin === self.location.origin);
      // An open RamAI window is just brought forward — never pulled away from a case in progress.
      if (open && "focus" in open) return open.focus();
      return self.clients.openWindow(url);
    })(),
  );
});

// The push service replaced this browser's subscription: hand RamAI the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription && event.oldSubscription.options;
      const sub = event.newSubscription || (options && (await self.registration.pushManager.subscribe(options)));
      if (!sub) return;
      await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    })().catch(() => undefined),
  );
});
