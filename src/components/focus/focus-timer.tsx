"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { BREAK_MIN, FOCUS_MIN, cancel, complete, leftOf, pause, resume, start, todayMinutes, todaySessions, useFocus } from "@/lib/focus";
import { success, tap } from "@/lib/haptics";
import { playSfx } from "@/lib/sfx";
import { toast } from "@/lib/toast";

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** The lock screen: a quiet notification saying what you're on and when it ends (only if notifications are allowed). */
async function lockScreen(title: string, body: string, done = false) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(title, { body, tag: "ramai-focus", silent: !done, requireInteraction: !done, icon: "/icon-192.png", badge: "/icon-badge.png" });
  } catch {}
}
async function clearLockScreen() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    (await reg?.getNotifications({ tag: "ramai-focus" }))?.forEach((n) => n.close());
  } catch {}
}

/** Focus: name it, start 25 minutes, pause or cancel; then a 5-minute break when you're ready. Retro, calm, big. */
export function FocusTimer() {
  const { active, done, now } = useFocus();
  const [name, setName] = useState("");
  const ended = useRef<number | null>(null);
  const left = active ? leftOf(active, now) : FOCUS_MIN * 60_000;
  const running = !!active?.endsAt;
  const total = (active?.phase === "break" ? BREAK_MIN : FOCUS_MIN) * 60_000;
  const pct = active ? 1 - left / total : 0;

  // Time's up (also after reopening the app): record it, cheer quietly.
  useEffect(() => {
    if (!active?.endsAt || left > 0 || ended.current === active.endsAt) return;
    ended.current = active.endsAt;
    const wasFocus = active.phase === "focus";
    complete();
    success();
    playSfx("win");
    void lockScreen(wasFocus ? "Focus complete 🎉" : "Break over", wasFocus ? `${FOCUS_MIN} minutes on “${active.name}”. Take a 5-minute break.` : "Ready for another focus?", true);
    toast(wasFocus ? `${FOCUS_MIN} minutes of focus done — take a break` : "Break over");
  }, [active, left]);

  const begin = async () => {
    tap();
    if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission().catch(() => undefined);
    start(name || "Study");
    void lockScreen(`Focusing: ${name || "Study"}`, `Ends at ${clock(Date.now() + FOCUS_MIN * 60_000)}`);
  };
  const minutes = todayMinutes(done);
  const sessions = todaySessions(done);

  return (
    <div className="focus-retro mx-auto flex w-full max-w-md flex-col gap-6 py-6">
      <header className="text-center">
        <p className="text-[12px] font-semibold tracking-[0.22em] text-fg-3 uppercase">Focus timer</p>
        <h1 className="mt-1 font-mono text-[15px] text-fg-2">{active ? (active.phase === "focus" ? `On: ${active.name}` : "Break") : "What are you working on?"}</h1>
      </header>

      {!active && (
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="e.g. Pharmacology — antibiotics" className="h-12 rounded-2xl border border-line bg-surface px-4 text-center text-[16px] outline-none focus:border-accent-line" aria-label="Session name" />
      )}

      {/* The dial */}
      <div className="relative mx-auto aspect-square w-[78vw] max-w-[320px]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle cx="50" cy="50" r="45" fill="none" stroke={active?.phase === "break" ? "var(--success)" : "var(--accent)"} strokeWidth="3.4" strokeLinecap="round" strokeDasharray={`${pct * 282.7} 282.7`} className="transition-[stroke-dasharray] duration-1000 ease-linear" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[64px] leading-none font-semibold tracking-tight tabular sm:text-[72px]" role="timer" aria-live="off">{mmss(left)}</span>
          <span className="mt-2 text-[12.5px] text-fg-3">{active ? (running ? (active.phase === "focus" ? `ends at ${clock(active.endsAt!)}` : "break") : "paused") : `${FOCUS_MIN} min focus`}</span>
        </div>
      </div>

      {/* One obvious action */}
      <div className="flex flex-col items-center gap-3">
        {!active ? (
          <button type="button" onClick={() => void begin()} className="h-14 w-full rounded-full bg-accent text-[17px] font-semibold text-on-accent shadow-lg transition-transform active:scale-[0.98]">Start focus</button>
        ) : active.phase === "break" && !running && left === total ? (
          <button type="button" onClick={() => { tap(); start(active.name, "break"); }} className="h-14 w-full rounded-full bg-success text-[17px] font-semibold text-white shadow-lg transition-transform active:scale-[0.98]">Start {BREAK_MIN}-minute break</button>
        ) : running ? (
          <button type="button" onClick={() => { tap(); pause(); void clearLockScreen(); }} className="h-14 w-full rounded-full bg-fg text-[17px] font-semibold text-bg shadow-lg transition-transform active:scale-[0.98]">Pause</button>
        ) : (
          <button type="button" onClick={() => { tap(); resume(); void lockScreen(`Focusing: ${active.name}`, `Ends at ${clock(Date.now() + left)}`); }} className="h-14 w-full rounded-full bg-accent text-[17px] font-semibold text-on-accent shadow-lg transition-transform active:scale-[0.98]">Resume</button>
        )}
        {active && (
          <button type="button" onClick={() => { tap(); cancel(); void clearLockScreen(); toast(active.phase === "focus" ? "Cancelled — not recorded" : "Break skipped", { tone: "info" }); }} className="text-[14px] font-medium text-fg-2 hover:text-fg">
            {active.phase === "focus" ? "Cancel (not recorded)" : "Skip break"}
          </button>
        )}
      </div>

      {/* Today */}
      <section className="panel flex flex-col gap-3 p-5" aria-label="Today">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">Today</h2>
          <span className="font-mono text-[22px] font-semibold tabular">{minutes}<span className="text-[13px] font-normal text-fg-2"> min focused</span></span>
        </div>
        {sessions.length === 0 ? (
          <p className="text-[13.5px] text-fg-2">No focus sessions yet today. Breaks don&apos;t count — only full 25-minute sessions.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2">
            {[...sessions].reverse().map((d) => (
              <li key={d.at} className="flex items-center justify-between py-2 text-[14px]">
                <span className="truncate">{d.name}</span>
                <span className={cn("shrink-0 font-mono text-[13px] text-fg-2 tabular")}>{clock(d.at)} · {d.minutes} min</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-center text-[11.5px] text-fg-3">Kept on this phone only. With notifications allowed, the timer shows on your lock screen.</p>
    </div>
  );
}
