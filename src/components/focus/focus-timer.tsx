"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Portal } from "@/components/ui/portal";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { breakEarned, complete, getPrefs, leftOf, pause, resume, running, setPrefs, SIZES, start, startBreak, stop, todayMinutes, todaySessions, totalOf, useFocus, type Drink, type Scene, type Size } from "@/lib/focus";
import { success, tap } from "@/lib/haptics";
import { playSfx } from "@/lib/sfx";
import { toast } from "@/lib/toast";

import { LoopVideo } from "@/components/ui/loop-video";
import { CafeScene, STREET_VIEWS, StreetScene, type StreetView } from "./cafe-scene";
import { Cup, DRINKS } from "./cup";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${sec}` : `${m}:${sec}`;
};
/** Calm time: whole minutes ("24 min"; counting up, "12 min"), a gentle "< 1 min" at the very end. */
const calmTime = (ms: number, up: boolean) => {
  const m = up ? Math.floor(ms / 60_000) : Math.ceil(ms / 60_000);
  return !up && ms < 60_000 ? "< 1 min" : `${m} min`;
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

/** What each scene is called. */
const SCENE_NAME: Record<Scene, string> = { focus: "🌿 Quiet", social: "☕ Café", window: "🏙️ Street" };

/** Paper card on a wooden café table. */
function Table({ children }: { children: React.ReactNode }) {
  return (
    <Portal>
      <div className="focus-table fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto p-4">
        <div className="focus-paper relative w-full max-w-xl animate-pop px-6 py-9 text-[#24332c] sm:px-10">
          <Link href="/" aria-label="Back to RamAI" className="absolute top-4 left-4 text-[14px] font-medium text-[#56655d]">← Home</Link>
          {children}
        </div>
      </div>
    </Portal>
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
  const [street, setStreet] = useState<StreetView>(() => getPrefs().street ?? "cafe");
  /** Seconds ticking away can distract: minutes only, unless tapped. */
  const [secs, setSecs] = useState(false);
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
      toast(active.size === "flow" ? "Break over — back to studying. Every 5 minutes earns another minute." : "Break over — ready for another?");
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
          <p className="text-center text-[13px] font-semibold tracking-[0.18em] text-[#3f7d63] uppercase">Focus</p>
          <p className="mt-1 text-center text-[22px] font-medium">What are you sipping today?</p>
          <div className="mt-7 grid grid-cols-3 gap-x-3 gap-y-6">
            {(Object.keys(DRINKS) as Drink[]).map((d) => (
              <button key={d} type="button" onClick={() => { tap(); setDrink(d); }} aria-pressed={drink === d} className={cn("flex flex-col items-center gap-2 rounded-2xl p-2 transition-transform active:scale-95", drink === d && "bg-white shadow-md ring-2 ring-[#3f7d63]")}>
                <Cup drink={d} size={86} />
                <span className="text-[14px]">{DRINKS[d].label}</span>
              </button>
            ))}
          </div>
          <button type="button" disabled={!drink} onClick={() => { tap(); setStep("size"); }} className="focus-btn mx-auto mt-8 block disabled:bg-[#c9d3cd] disabled:text-[#56655d] disabled:shadow-none">
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
              <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => { tap(); setSize(s); }} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors", size === s ? "bg-white shadow-sm ring-2 ring-[#3f7d63]" : "bg-white/40 hover:bg-white/70")}>
                <span className="text-[17px]">{SIZES[s].label}</span>
                <span className="mx-1 h-px flex-1 border-t border-dotted border-[#24332c60]" />
                <span className="text-right text-[13.5px] text-[#56655d]">{SIZES[s].note}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { tap(); setStep("note"); }} className="focus-btn mx-auto mt-7 block">next</button>
          <button type="button" onClick={() => setStep("drink")} className="mx-auto mt-3 block text-[14px] text-[#56655d] underline">← back</button>
        </Table>
      );
    return (
      <Table>
        <div className="mx-auto max-w-sm -rotate-1 bg-[#fff6c2] px-6 py-8 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.35)]">
          <p className="text-center text-[13px] tracking-[0.14em] text-[#56655d] uppercase">I will…</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 80))} rows={3} placeholder="revise antibiotics…" className="focus-hand mt-3 w-full resize-none bg-transparent text-center text-[26px] leading-tight text-[#2a2621] outline-none placeholder:text-[#8a857c]" autoFocus />
        </div>
        <button type="button" onClick={() => { tap(); success(); start(drink!, size, note); setNote(""); setStep("drink"); if (SIZES[size].focus) void lockScreen(`Focusing${note ? `: ${note}` : ""}`, `Until ${clock(Date.now() + SIZES[size].focus * 60_000)}`); }} className="focus-btn mx-auto mt-7 block">start</button>
        <button type="button" onClick={() => setStep("size")} className="mx-auto mt-3 block text-[14px] text-[#56655d] underline">← back</button>
      </Table>
    );
  }

  /* ---------- At the table ---------- */
  const unlimited = active.size === "unlimited" || (active.size === "flow" && active.phase === "focus");
  const earned = active.size === "flow" ? breakEarned(active, now) : 0;
  const left = leftOf(active, now);
  const total = totalOf(active);
  const pct = unlimited ? 0 : 1 - left / Math.max(1, total);
  const waitingBreak = active.phase === "break" && !active.endsAt && left === total;
  const scenes: Scene[] = ["focus", "social", "window"];
  return (
    <Portal>
    <div className={cn("fixed inset-0 z-[85] flex flex-col overflow-hidden", scene === "focus" ? "focus-table" : scene === "social" ? "bg-[radial-gradient(80%_60%_at_30%_20%,#f7dcc0,transparent_60%),radial-gradient(70%_60%_at_80%_40%,#f1e2c9,transparent_60%),#efe6d8]" : "bg-black")}>
      {scene === "focus" && <LoopVideo name="calm" className="absolute inset-0 h-full w-full" />}
      {scene === "window" && <StreetScene view={street} />}
      {scene === "window" && (
        <div className="absolute top-[max(62px,calc(env(safe-area-inset-top)+50px))] right-4 z-20 flex gap-1 rounded-full bg-black/35 p-0.5 backdrop-blur" role="radiogroup" aria-label="Street view">
          {(Object.keys(STREET_VIEWS) as StreetView[]).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={street === v} onClick={() => { tap(); setStreet(v); setPrefs({ street: v }); }} className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", street === v ? "bg-white text-[#24332c]" : "text-white/90")}>
              {STREET_VIEWS[v]}
            </button>
          ))}
        </div>
      )}
      {scene === "social" && <CafeScene />}
      <audio ref={audio} loop preload="none">
        <source src="/focus/cafe.ogg" type="audio/ogg" />
        <source src="/focus/cafe.mp3" type="audio/mpeg" />
      </audio>

      <div className="relative z-10 flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <Link href="/" className="focus-sign" aria-label="Back to RamAI — the timer keeps running">← Home</Link>
        <div role="tablist" aria-label="Scene" className="focus-sign flex gap-0.5 !p-0.5">
          {scenes.map((sc) => (
            <button key={sc} type="button" role="tab" aria-selected={scene === sc} onClick={() => chooseScene(sc)} className={cn("rounded-full px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap transition-colors", scene === sc ? "bg-[#3f7d63] text-white" : "text-[#33443c]")}>
              {SCENE_NAME[sc]}
            </button>
          ))}
        </div>
        <span className="focus-sign tabular hidden min-[420px]:inline">{todayMinutes(done)} min today</span>
      </div>


      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        {scene === "focus" && (
          <button type="button" onClick={() => setSecs((v) => !v)} title={secs ? "Hide seconds" : "Show seconds"} className="text-[88px] leading-none font-extralight tracking-tight text-[#24332c] tabular sm:text-[120px]" role="timer">
            {secs ? mmss(left) : calmTime(left, unlimited)}
          </button>
        )}
      </div>

      {/* The wooden table, and your drink emptying on it */}
      {/* Café and Street: the scene gets most of the screen (about 75%) — a slim table along the bottom. */}
      <div className={cn("focus-tabletop relative z-10 flex pb-[max(10px,env(safe-area-inset-bottom))]", scene === "focus" ? "flex-col items-center pt-2" : "focus-tabletop-slim flex-row items-center gap-3 px-4 pt-3")}>
        <div className={cn("transition-transform duration-1000", scene === "focus" ? "mt-3" : "mt-1")} style={{ transform: `rotate(${pct * 40 - 20}deg)` }}>
          <div className="relative">
            {isRunning && (
              <>
                {/* Soothing: soft steam puffs drifting up and swaying, ripples spreading slowly across the drink. */}
                <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-28 w-28 -translate-x-1/2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="steam-puff absolute bottom-0 rounded-full bg-white" style={{ left: `${22 + ((i * 13) % 50)}%`, width: 18 + (i % 3) * 8, height: 18 + (i % 3) * 8, animationDelay: `${i * 0.9}s`, animationDuration: `${5 + (i % 3)}s` }} />
                  ))}
                </div>
                {[0, 1, 2].map((i) => <span key={i} aria-hidden className="focus-ripple absolute inset-[26%] rounded-full border border-white/80" style={{ animationDelay: `${i * 2.2}s` }} />)}
                <span aria-hidden className="liquid-shine absolute inset-[24%] rounded-full" />
              </>
            )}
            {/* The cup's shadow on the table. */}
            <span aria-hidden className="absolute bottom-[-4%] left-1/2 h-[22%] w-[86%] -translate-x-1/2 rounded-[50%] bg-[#2a1606]/45 blur-[10px]" />
            {isRunning && <span aria-hidden className="focus-glow absolute inset-[-12%] rounded-full" />}
            <div className={isRunning ? "focus-breathe-cup" : undefined}>
              <div className={isRunning ? "focus-stir" : undefined}>
              <Cup drink={active.drink} left={unlimited ? 1 : active.phase === "break" ? 1 : 1 - pct} size={scene === "focus" ? 170 : 86} />
              </div>
            </div>
          </div>
        </div>
        <div className={cn("flex flex-col", scene === "focus" ? "items-center" : "min-w-0 flex-1 items-start overflow-hidden")}>
        {/* Your target, under the drink. */}
        <p className={cn("on-wood mt-1 max-w-xs font-semibold", scene === "focus" ? "px-3 text-center text-[15.5px]" : "truncate text-[14px]")}>
          {active.phase === "break" ? (waitingBreak ? "focus done — take a break?" : "break") : active.name ? `I will ${active.name}` : unlimited ? "focusing" : "focus"}
          {active.size === "flow" && active.phase === "focus" && ` · ${earned} min break earned`}
        </p>
        {scene !== "focus" && <button type="button" onClick={() => setSecs((v) => !v)} className="on-wood text-[26px] leading-tight font-light tabular">{secs ? mmss(left) : calmTime(left, unlimited)}</button>}
        {scene !== "focus" && (
          <label className="on-wood mt-1 flex items-center gap-1.5">
            <Icon name="volume-off" size={13} />
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => { const v = Number(e.target.value); setVolume(v); setPrefs({ volume: v }); }} aria-label="Café sound volume" className="w-24 accent-[#4a3a2c]" />
            <Icon name="volume" size={13} />
          </label>
        )}
        </div>
        <div className={cn("flex items-center", scene === "focus" ? "mt-3 gap-3" : "shrink-0 gap-2")}>
          {active.size === "flow" && active.phase === "focus" && (
            <button type="button" disabled={earned < 1} onClick={() => { tap(); startBreak(); toast(`Enjoy your ${earned}-minute break`); }} className={cn("focus-btn disabled:opacity-50", scene !== "focus" && "!px-3 !text-[13px]")}>
              {earned < 1 ? "break in 5 min" : `take my break · ${earned} min`}
            </button>
          )}
          {waitingBreak ? (
            <button type="button" onClick={() => { tap(); startBreak(); }} className={cn("focus-btn", scene !== "focus" && "!px-3 !text-[13px]")}>{scene === "focus" ? "start " : ""}{SIZES[active.size].brk}-min break</button>
          ) : (
            <button type="button" aria-label={isRunning ? "Pause" : "Resume"} onClick={() => { tap(); if (isRunning) pause(); else resume(); }} className={cn("flex items-center justify-center rounded-full bg-[#3f7d63] text-[20px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(63,125,99,0.8)]", scene === "focus" ? "h-16 w-16" : "h-12 w-12")}>
              {isRunning ? "❚❚" : "▶"}
            </button>
          )}
          <button type="button" aria-label="Stop" onClick={() => { tap(); stop(); toast(unlimited ? `${Math.floor(left / 60_000)} min saved` : active.phase === "focus" ? "Stopped — not recorded" : "Break skipped", { tone: "info" }); }} className={cn("flex items-center justify-center rounded-full bg-white/70 text-[18px] text-[#24332c] shadow-sm backdrop-blur", scene === "focus" ? "h-14 w-14" : "h-11 w-11")}>■</button>
        </div>
        {!unlimited && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[#00000010]"><div className="h-full bg-[#24332c]/60 transition-[width] duration-1000 ease-linear" style={{ width: `${pct * 100}%` }} /></div>}
      </div>

    </div>
    </Portal>
  );
}

function TodayLine({ minutes, sessions }: { minutes: number; sessions: number }) {
  return <p className="mt-6 text-center text-[13px] text-[#56655d]">{minutes ? `Today: ${minutes} min focused · ${sessions} session${sessions === 1 ? "" : "s"}` : "Kept on this phone. Breaks don't count — only focus."}</p>;
}
