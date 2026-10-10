/*
 * RamAI service worker — for the installed app.
 *   · Pages always come fresh from the network (they're personal); with no
 *     connection, a small offline page instead of the browser's error.
 *   · The daily reminder: shows the (end-to-end encrypted) message it carries.
 * Nothing is cached.
 */

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Offline · RamAI</title><style>
:root{color-scheme:light dark;--bg:#f4f6fb;--card:rgba(255,255,255,.72);--fg:#0b1220;--fg2:#5b6475;--line:rgba(15,23,42,.08)}
@media (prefers-color-scheme:dark){:root{--bg:#05070d;--card:rgba(28,30,38,.72);--fg:#f5f7fb;--fg2:#9aa3b5;--line:rgba(255,255,255,.08)}}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(60% 50% at 15% 0%,rgba(124,58,237,.18),transparent 70%),radial-gradient(50% 50% at 90% 10%,rgba(6,182,212,.16),transparent 70%),var(--bg);color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.card{max-width:360px;padding:32px 28px;text-align:center;border-radius:24px;background:var(--card);border:1px solid var(--line);box-shadow:0 20px 60px -20px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(30px) saturate(1.8);backdrop-filter:blur(30px) saturate(1.8)}
h1{margin:16px 0 6px;font-size:21px;letter-spacing:-.02em}p{margin:0;color:var(--fg2)}
button{margin-top:22px;height:44px;padding:0 24px;border:0;border-radius:999px;color:#fff;font-family:inherit;font-size:15px;font-weight:600;line-height:1;background:linear-gradient(135deg,#7c3aed,#2563eb 55%,#06b6d4);cursor:pointer}
</style></head><body><main class="card"><svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset=".5" stop-color="#2563eb"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><rect width="64" height="64" rx="19" fill="url(#g)"/><path d="M10 35h12l4-9 6 19 5-14 3 4h14" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
<h1>You're offline</h1><p>RamAI needs a connection to run your cases. Your progress is safe — this page reloads by itself when you're back online.</p><button onclick="location.reload()">Try again</button></main>
<script>addEventListener("online",function(){location.reload()})</script></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Earlier versions may have cached things; this one caches nothing.
      for (const key of await caches.keys()) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET" || new URL(req.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) || (await fetch(req));
      } catch {
        return new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
    })(),
  );
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
      tag: "ramai-daily",
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
