"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { complete, getPrefs, leftOf, pause, resume, running, setPrefs, SIZES, start, startBreak, stop, todayMinutes, todaySessions, totalOf, useFocus, type Drink, type Scene, type Size } from "@/lib/focus";
import { success, tap } from "@/lib/haptics";
import { playSfx } from "@/lib/sfx";
import { toast } from "@/lib/toast";

import { Cup, DRINKS } from "./cup";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Only if notifications are already allowed: a quiet lock-screen line. Never asked for, never waited on. */
async function lockScreen(title: string, body: string, loud = false) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(title, { body, tag: "ramai-focus", silent: !loud, icon: "/icon-192.png", badge: "/icon-badge.png" });
  } catch {}
}

/** Keeps the screen on while the timer runs. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const get = () => (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen").then((l) => (lock = l)).catch(() => undefined);
    void get();
    const back = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
      void lock?.release().catch(() => undefined);
    };
  }, [on]);
}

/** Paper card on a wooden café table. */
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="focus-table fixed inset-0 z-[40] flex items-center justify-center overflow-y-auto p-4">
      <div className="focus-paper relative w-full max-w-xl animate-pop px-6 py-9 text-[#1d1b19] sm:px-10">{children}</div>
    </div>
  );
}

/** Focus: a café pomodoro. Order a drink, pick a size, say what you'll do — then sit and work while it empties. */
export function FocusTimer() {
  const { active, done, now } = useFocus();
  const [step, setStep] = useState<"drink" | "size" | "note">("drink");
  const [drink, setDrink] = useState<Drink | null>(null);
  const [size, setSize] = useState<Size>("tall");
  const [note, setNote] = useState("");
  const [scene, setScene] = useState<Scene>("focus");
  const [volume, setVolume] = useState(0.5);
  const handled = useRef<number | null>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const p = getPrefs();
    if (p.drink) setDrink(p.drink);
    if (p.size) setSize(p.size);
    if (p.scene) setScene(p.scene);
    if (typeof p.volume === "number") setVolume(p.volume);
  }, []);

  const isRunning = running(active);
  useWakeLock(isRunning);

  // Time's up (also after reopening the app).
  useEffect(() => {
    if (!active?.endsAt || leftOf(active, now) > 0 || handled.current === active.endsAt) return;
    handled.current = active.endsAt;
    const what = complete();
    success();
    playSfx(what === "focus-done" ? "win" : "reveal");
    if (what === "focus-done") {
      toast(active.size === "flow" ? "5 minutes done — a 1-minute stretch" : `${SIZES[active.size].focus} minutes of focus — well done. Take your break.`);
      void lockScreen("Focus complete ☕", active.size === "flow" ? "1-minute break — then the next 5." : `${SIZES[active.size].focus} minutes on “${active.name || "your focus"}”. Time for a break.`, true);
    } else {
      toast(active.size === "flow" ? "Back to it — 5 minutes" : "Break over — ready for another?");
      void lockScreen(active.size === "flow" ? "Back to it" : "Break over", active.size === "flow" ? "5 minutes of focus." : "Order another when you're ready.");
    }
  }, [active, now]);

  // Social: the café's murmur; window: the street outside. Only while running.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.volume = volume;
    if (isRunning && scene !== "focus") void a.play().catch(() => undefined);
    else a.pause();
  }, [isRunning, scene, volume]);

  const chooseScene = (s: Scene) => {
    tap();
    setScene(s);
    setPrefs({ scene: s });
  };

  /* ---------- Ordering ---------- */
  if (!active) {
    if (step === "drink")
      return (
        <Table>
          <p className="text-center text-[22px] font-medium">what would you like to drink?</p>
          <div className="mt-7 grid grid-cols-3 gap-x-3 gap-y-6">
            {(Object.keys(DRINKS) as Drink[]).map((d) => (
              <button key={d} type="button" onClick={() => { tap(); setDrink(d); }} aria-pressed={drink === d} className={cn("flex flex-col items-center gap-2 rounded-2xl p-2 transition-transform active:scale-95", drink === d && "bg-[#f3eee6] ring-2 ring-[#1d1b19]")}>
                <Cup drink={d} size={86} />
                <span className="text-[14px]">{DRINKS[d].label}</span>
              </button>
            ))}
          </div>
          <button type="button" disabled={!drink} onClick={() => { tap(); setStep("size"); }} className="focus-btn mx-auto mt-8 block disabled:bg-[#d7d9de] disabled:text-[#6b7280]">
            {drink ? "next" : "choose a drink first"}
          </button>
          <TodayLine minutes={todayMinutes(done)} sessions={todaySessions(done).length} />
        </Table>
      );
    if (step === "size")
      return (
        <Table>
          <div className="flex justify-center"><Cup drink={drink!} size={96} steam /></div>
          <div role="radiogroup" aria-label="Size" className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
            {(Object.keys(SIZES) as Size[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => { tap(); setSize(s); }} className={cn("flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors", size === s ? "border-[#1d1b19]" : "border-transparent hover:border-[#1d1b1930]")}>
                <span className="text-[17px]">{SIZES[s].label}</span>
                <span className="mx-1 h-px flex-1 border-t border-dotted border-[#1d1b1960]" />
                <span className="text-right text-[13.5px] text-[#4b4845]">{SIZES[s].note}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { tap(); setStep("note"); }} className="focus-btn mx-auto mt-7 block">next</button>
          <button type="button" onClick={() => setStep("drink")} className="mx-auto mt-3 block text-[14px] text-[#4b4845] underline">← back</button>
        </Table>
      );
    return (
      <Table>
        <div className="mx-auto max-w-sm -rotate-1 bg-[#fff6c2] px-6 py-8 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.35)]">
          <p className="text-center text-[13px] tracking-[0.14em] text-[#4b4845] uppercase">I will…</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 80))} rows={3} placeholder="revise antibiotics…" className="focus-hand mt-3 w-full resize-none bg-transparent text-center text-[26px] leading-tight text-[#2a2621] outline-none placeholder:text-[#8a857c]" autoFocus />
        </div>
        <button type="button" onClick={() => { tap(); success(); start(drink!, size, note); setNote(""); setStep("drink"); if (SIZES[size].focus) void lockScreen(`Focusing${note ? `: ${note}` : ""}`, `Until ${clock(Date.now() + SIZES[size].focus * 60_000)}`); }} className="focus-btn mx-auto mt-7 block">start</button>
        <button type="button" onClick={() => setStep("size")} className="mx-auto mt-3 block text-[14px] text-[#4b4845] underline">← back</button>
      </Table>
    );
  }

  /* ---------- At the table ---------- */
  const unlimited = active.size === "unlimited";
  const left = leftOf(active, now);
  const total = totalOf(active);
  const pct = unlimited ? 0 : 1 - left / Math.max(1, total);
  const waitingBreak = active.phase === "break" && !active.endsAt && left === total;
  const scenes: Scene[] = ["focus", "social", "window"];
  const si = scenes.indexOf(scene);
  return (
    <div className={cn("fixed inset-0 z-[40] flex flex-col overflow-hidden", scene === "focus" ? "bg-[#efeee9]" : scene === "social" ? "bg-[#f6efdf]" : "bg-black")}>
      {scene === "window" && <video src="/focus/window-delhi.webm" autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />}
      {scene === "social" && <SocialScene />}
      <audio ref={audio} src="/focus/cafe.ogg" loop preload="none" />

      <div className="relative z-10 flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <button type="button" onClick={() => { tap(); stop(); toast(unlimited ? "Saved to today" : active.phase === "focus" ? "Stopped — not recorded" : "Break skipped", { tone: "info" }); }} className="focus-sign" aria-label="Leave the table">☕ menu</button>
        <span className="focus-sign">{scene}</span>
        <span className="focus-sign tabular">{todayMinutes(done)} min today</span>
      </div>

      <button type="button" aria-label="Previous scene" onClick={() => chooseScene(scenes[(si + 2) % 3]!)} className="focus-arrow absolute top-1/2 left-3 z-10"><Icon name="arrow-left" size={20} /></button>
      <button type="button" aria-label="Next scene" onClick={() => chooseScene(scenes[(si + 1) % 3]!)} className="focus-arrow absolute top-1/2 right-3 z-10"><Icon name="arrow-right" size={20} /></button>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        {scene === "focus" && <div className="font-mono text-[84px] leading-none font-medium tracking-tight text-[#1d1b19] tabular sm:text-[120px]" role="timer">{mmss(left)}</div>}
        <p className={cn("mt-2 max-w-xs text-center text-[15px]", scene === "window" ? "rounded-full bg-black/40 px-3 py-1 text-white" : "text-[#4b4845]")}>
          {active.phase === "break" ? (waitingBreak ? "focus done — take a break?" : "break") : active.name ? `I will ${active.name}` : unlimited ? "focusing" : "focus"}
          {active.size === "flow" && ` · round ${active.rounds + (active.phase === "focus" ? 1 : 0)}`}
        </p>
      </div>

      {/* The table, and your drink emptying on it */}
      <div className="focus-tabletop relative z-10 flex flex-col items-center pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="-mt-24 transition-transform duration-1000" style={{ transform: `rotate(${pct * 40 - 20}deg)` }}>
          <Cup drink={active.drink} left={unlimited ? 1 : active.phase === "break" ? 1 : 1 - pct} size={170} steam={isRunning && active.phase === "focus"} />
        </div>
        {scene !== "focus" && <div className="mt-1 font-mono text-[28px] font-medium text-[#1d1b19] tabular">{mmss(left)}</div>}
        <div className="mt-3 flex items-center gap-3">
          {waitingBreak ? (
            <button type="button" onClick={() => { tap(); startBreak(); }} className="focus-btn">start {SIZES[active.size].brk}-min break</button>
          ) : (
            <button type="button" aria-label={isRunning ? "Pause" : "Resume"} onClick={() => { tap(); if (isRunning) pause(); else resume(); }} className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-[#1d1b19] bg-white text-[20px] font-bold">
              {isRunning ? "❚❚" : "▶"}
            </button>
          )}
          <button type="button" aria-label="Stop" onClick={() => { tap(); stop(); toast(unlimited ? `${Math.floor(left / 60_000)} min saved` : active.phase === "focus" ? "Stopped — not recorded" : "Break skipped", { tone: "info" }); }} className="h-14 w-14 rounded-lg bg-[#1d1b19]" />
        </div>
        {scene !== "focus" && (
          <label className="mt-3 flex items-center gap-2 text-[#1d1b19]">
            <Icon name="volume-off" size={14} />
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); setPrefs({ volume: v }); }} aria-label="Café sound volume" className="w-40 accent-[#1d1b19]" />
            <Icon name="volume" size={14} />
          </label>
        )}
        {!unlimited && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[#00000010]"><div className="h-full bg-[#1d1b19]/60 transition-[width] duration-1000 ease-linear" style={{ width: `${pct * 100}%` }} /></div>}
      </div>
      {scene === "window" && <p className="absolute right-2 bottom-1 z-10 text-[9px] text-black/40">Video: Yann Forget, CC BY 3.0 · Wikimedia Commons</p>}
    </div>
  );
}

function TodayLine({ minutes, sessions }: { minutes: number; sessions: number }) {
  return <p className="mt-6 text-center text-[13px] text-[#4b4845]">{minutes ? `Today: ${minutes} min focused · ${sessions} session${sessions === 1 ? "" : "s"}` : "Kept on this phone. Breaks don't count — only focus."}</p>;
}

/** Social: other people working quietly in the café (drawn, gently bobbing). */
function SocialScene() {
  const people = [
    { x: 8, c: "#e9edb0" },
    { x: 30, c: "#b7e3ab" },
    { x: 56, c: "#a9cfee" },
    { x: 80, c: "#f6c3c6" },
  ];
  return (
    <div aria-hidden className="absolute inset-x-0 top-[12%] h-[40%]">
      {people.map((p, i) => (
        <svg key={i} viewBox="0 0 120 120" className="focus-bob absolute h-[70%] w-auto" style={{ left: `${p.x}%`, animationDelay: `${i * 0.7}s` }}>
          <ellipse cx="60" cy="62" rx="42" ry="40" fill={p.c} stroke="#1d1b19" strokeWidth="3" />
          <path d="M22 52 q38 -44 76 0" fill="none" stroke="#1d1b19" strokeWidth="5" />
          <rect x="14" y="48" width="14" height="24" rx="6" fill={p.c} stroke="#1d1b19" strokeWidth="3" />
          <rect x="92" y="48" width="14" height="24" rx="6" fill={p.c} stroke="#1d1b19" strokeWidth="3" />
          <circle cx="50" cy="62" r="2.6" fill="#1d1b19" /><circle cx="68" cy="62" r="2.6" fill="#1d1b19" />
          <path d="M54 72 q5 4 10 0" stroke="#1d1b19" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <rect x="30" y="92" width="60" height="22" rx="3" fill={p.c} stroke="#1d1b19" strokeWidth="3" />
        </svg>
      ))}
    </div>
  );
}
