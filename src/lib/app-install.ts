/**
 * RamAI as an installed app: the service worker, the install prompt, and the
 * daily reminder (Web Push). Browser-only — use from client components.
 */
import { useEffect, useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------- */
/* Service worker                                                              */
/* -------------------------------------------------------------------------- */

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(undefined);
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Installing                                                                  */
/* -------------------------------------------------------------------------- */

type InstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * How this browser installs RamAI: its own prompt (Chrome, Edge, Android), the
 * Share menu (iPhone, iPad), File → Add to Dock (Safari on a Mac) — or not at all.
 */
export type InstallRoute = "prompt" | "ios" | "mac-safari" | "installed" | "none";

let deferred: InstallPromptEvent | null = null;
let justInstalled = false;
const installListeners = new Set<() => void>();
const installChanged = () => installListeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Our own button, at a good moment, instead of the browser's banner.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    installChanged();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    justInstalled = true;
    installChanged();
  });
}

export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
// iPads present themselves as Macs — but with a touch screen.
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isMacSafari = () => {
  const ua = navigator.userAgent;
  return /Macintosh/.test(ua) && /Version\/(1[7-9]|[2-9]\d)\b.*Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua) && navigator.maxTouchPoints <= 1;
};

function installRoute(): InstallRoute {
  if (justInstalled || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  if (isMacSafari()) return "mac-safari";
  return "none";
}

export function useInstallRoute(): InstallRoute {
  return useSyncExternalStore(
    (l) => {
      installListeners.add(l);
      return () => installListeners.delete(l);
    },
    installRoute,
    () => "none",
  );
}

/** The browser's own install dialog. False if it isn't available or the player said no. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  installChanged();
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}

/* -------------------------------------------------------------------------- */
/* The daily reminder                                                          */
/* -------------------------------------------------------------------------- */

/** `install-first`: iPhones and iPads only allow notifications from apps on the home screen. */
export type ReminderState = "loading" | "unsupported" | "install-first" | "blocked" | "off" | "on";

let reminder: ReminderState = "loading";
const reminderListeners = new Set<() => void>();
const setReminder = (s: ReminderState) => {
  reminder = s;
  reminderListeners.forEach((l) => l());
};

const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const unsupportedState = (): ReminderState => (isIos() && !isStandalone() ? "install-first" : "unsupported");

/** When the reminder arrives, in the player's own time (the server sends it at about 7 pm India time). */
export function reminderTime(): string {
  if (new Date().getTimezoneOffset() === -330) return "7 pm";
  const at = new Date();
  at.setUTCHours(13, 30, 0, 0);
  return at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

let keyRequest: Promise<Uint8Array<ArrayBuffer>> | null = null;
function serverKey(): Promise<Uint8Array<ArrayBuffer>> {
  keyRequest ??= fetch("/api/push", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error("Couldn't reach RamAI. Check your connection.");
      const { key } = (await res.json()) as { key: string };
      const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
      return Uint8Array.from(raw, (c) => c.charCodeAt(0));
    })
    .catch((err) => {
      keyRequest = null;
      throw err;
    });
  return keyRequest;
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) => !!a && a.byteLength === b.length && new Uint8Array(a).every((v, i) => v === b[i]);

async function tellServer(method: "POST" | "DELETE", body: unknown) {
  const res = await fetch("/api/push", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(err?.error?.message ?? "Couldn't save that. Please try again.");
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** This browser's subscription under the server's current key — renewed if the key changed. */
async function subscribe(): Promise<PushSubscription> {
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
  if (!reg) throw new Error("This browser can't run RamAI's reminders.");
  const ready = await navigator.serviceWorker.ready;
  const key = await serverKey();
  const existing = await ready.pushManager.getSubscription();
  if (existing && sameKey(existing.options.applicationServerKey, key)) return existing;
  await existing?.unsubscribe();
  return ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

const SYNC_KEY = "ramai.push.synced";

let checked = false;
/**
 * Once per page load: what this browser allows. Once a day, the server is kept
 * in step too — a new key, or a browser it had given up on.
 */
async function check() {
  if (!pushSupported()) return setReminder(unsupportedState());
  if (Notification.permission === "denied") return setReminder("blocked");
  // Fetched ahead, so turning reminders on is quick after the permission prompt.
  void serverKey().catch(() => undefined);
  const sub = Notification.permission === "granted" ? await currentSubscription().catch(() => null) : null;
  setReminder(sub ? "on" : "off");
  if (!sub) return;
  const today = new Date().toDateString();
  try {
    if (localStorage.getItem(SYNC_KEY) === today) return;
  } catch {}
  await subscribe()
    .then((s) => tellServer("POST", s.toJSON()))
    .then(() => {
      try {
        localStorage.setItem(SYNC_KEY, today);
      } catch {}
    })
    .catch(() => undefined);
}

export function useReminders(): ReminderState {
  const state = useSyncExternalStore(
    (l) => {
      reminderListeners.add(l);
      return () => reminderListeners.delete(l);
    },
    () => reminder,
    () => "loading" as const,
  );
  useEffect(() => {
    if (checked) return;
    checked = true;
    void check();
  }, []);
  return state;
}

/** Call straight from a tap: Safari only asks for permission in response to one. */
export async function enableReminders(): Promise<ReminderState> {
  if (!pushSupported()) {
    setReminder(unsupportedState());
    return reminder;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    setReminder(permission === "denied" ? "blocked" : "off");
    return reminder;
  }
  const sub = await subscribe();
  try {
    await tellServer("POST", sub.toJSON());
  } catch (err) {
    // Half on is worse than off: the browser would think it's subscribed.
    await sub.unsubscribe().catch(() => undefined);
    throw err;
  }
  setReminder("on");
  const reg = await navigator.serviceWorker.ready;
  await reg
    .showNotification("Daily reminder is on", {
      body: `If you haven't played by about ${reminderTime()}, RamAI will nudge you — never more than once a day.`,
      icon: "/icon-192.png",
      badge: "/icon-badge.png",
      tag: "ramai-welcome",
    })
    .catch(() => undefined);
  return "on";
}

export async function disableReminders(): Promise<void> {
  if (!pushSupported()) return;
  const sub = await currentSubscription().catch(() => null);
  if (sub) {
    await tellServer("DELETE", { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  setReminder(Notification.permission === "denied" ? "blocked" : "off");
}
