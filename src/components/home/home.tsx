"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DOCTOR_NEXT, DoctorFigure } from "@/components/game/caricature";
import { GoalRing } from "@/components/game/goal-ring";
import { RankBadge } from "@/components/game/rank-badge";
import { Flame } from "@/components/game/streak";
import { HeartScene } from "@/components/three/heart-scene";
import { Icon } from "@/components/ui/icon";
import { levelMeta } from "@/engine/levels";
import { nextRank, rankFor, rankProgress } from "@/engine/progression";
import type { CareLevel } from "@/engine/types";
import { hydrate, useCase } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { prepareCase, type LibraryInfo } from "@/lib/engine-client";
import { caseLabel, xp } from "@/lib/format";
import { useInAndroidApp } from "@/lib/in-app";
import { useMe, type Me } from "@/lib/me-store";
import { planFor } from "@/lib/plans";
import { useStartingMessage } from "@/lib/use-starting-message";

import { CasePicker } from "./case-picker";
import { GuidedCard } from "./guided-card";
import { HomeTour, TOUR_EVENT, tourSeen, type TourStop } from "./home-tour";
import { LevelPath } from "./level-path";
import { SPECIALTY_EVENT, SpecialtySheet } from "./specialty-sheet";
import { UpgradeSheet } from "./upgrade-sheet";
import { DailyCard } from "./daily-card";
import { ReviewCard } from "./review-card";
import { useLauncher } from "./use-launcher";
import { LeagueCard } from "./week-board";

/** By the player's own clock — they may be in Delhi, Dallas or Dundee. */
function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 5 ? "Late shift" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const firstName = (name: string) => name.replace(/^dr\.?\s+/i, "").split(/\s+/)[0] ?? name;

const GUIDE_SKIP_KEY = "ramai.guided.skip";

export function Home({ initial, library }: { initial: Me; library: LibraryInfo }) {
  const me = useMe(initial) ?? initial;
  const inApp = useInAndroidApp();
  const snap = useCase();
  const { launch, starting, gate, setGate, closeGate, error } = useLauncher();
  const [showMore, setShowMore] = useState(false);
  const startingLabel = useStartingMessage(starting);
  const [picker, setPicker] = useState(false);
  const [hello, setHello] = useState("Welcome");
  const [guideSkipped, setGuideSkipped] = useState(true);
  useEffect(() => hydrate(me.user.id), [me.user.id]);
  useEffect(() => setHello(greeting()), []);
  useEffect(() => {
    try {
      setGuideSkipped(localStorage.getItem(GUIDE_SKIP_KEY) === "1");
    } catch {
      setGuideSkipped(false);
    }
  }, []);

  const p = me.progress;
  const plan = planFor(me.user);
  const rank = rankFor(p.percent);
  const next = nextRank(p.percent);
  const toNext = rankProgress(p.percent);
  const limit = me.usage.dailyLimit;
  const left = limit === null ? null : Math.max(0, limit - me.usage.casesToday);
  const active = snap.hydrated && snap.session && !snap.session.debrief ? snap.session : null;
  const goalMet = p.dailyXp >= p.dailyGoal;
  const showGuide = p.history.length === 0 && snap.hydrated && !active && !guideSkipped;
  const skipGuide = () => {
    setGuideSkipped(true);
    try {
      localStorage.setItem(GUIDE_SKIP_KEY, "1");
    } catch {}
  };
  const streakAtRisk = p.streakDays > 0 && p.dailyXp === 0;

  // A returning doctor's next patient is written while they look around, so starting it is instant (the server skips it if one is ready).
  const returning = p.history.length > 0 && !!me.user.specialty;
  useEffect(() => {
    if (!snap.hydrated || active || !returning) return;
    const t = window.setTimeout(() => void prepareCase().catch(() => undefined), 1500);
    return () => window.clearTimeout(t);
  }, [snap.hydrated, active, returning]);

  // The doctor's specialty: asked once, at the start (skipping it means mixed cases) — and changeable from the menu.
  const [askSpecialty, setAskSpecialty] = useState(false);
  const unasked = me.user.specialty === null;
  useEffect(() => {
    if (snap.hydrated && unasked && !active) setAskSpecialty(true);
  }, [snap.hydrated, unasked, active]);

  // The tour: once, after the first case (usually the demo) — and whenever asked for, from here or the account menu.
  const [tour, setTour] = useState(false);
  useEffect(() => {
    const ask = () => setTour(true);
    const specialty = () => setAskSpecialty(true);
    window.addEventListener(TOUR_EVENT, ask);
    window.addEventListener(SPECIALTY_EVENT, specialty);
    const url = new URL(window.location.href);
    for (const [param, open] of [["tour", ask], ["specialty", specialty]] as const) {
      if (url.searchParams.get(param) !== "1") continue;
      url.searchParams.delete(param);
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      open();
    }
    return () => {
      window.removeEventListener(TOUR_EVENT, ask);
      window.removeEventListener(SPECIALTY_EVENT, specialty);
    };
  }, []);
  const played = p.history.length > 0;
  useEffect(() => {
    if (!snap.hydrated || active || !played || unasked || tourSeen()) return;
    const t = window.setTimeout(() => setTour(true), 900);
    return () => window.clearTimeout(t);
  }, [snap.hydrated, active, played, unasked]);
  const stops: TourStop[] = [
    { target: "start", title: "Start a case", body: "New case lets you pick the specialty, the mode (learning or real life, OPD, emergency or phone) and the hospital level. Any case starts a random patient in one tap." },
    { target: "daily", title: "Today's case", body: "One patient for every doctor today. Play it, see where you rank, and share your result." },
    { target: "levels", title: "Your path", body: "Climb from a primary health centre to grand rounds. Score 70 or more to clear a level and unlock harder hospitals." },
    {
      target: "today",
      title: "Your day",
      body: `Each case earns XP towards your daily goal and keeps your streak alive. ${limit === null ? "Your cases are unlimited." : limit === 0 ? "Go Pro to play real cases — the demo and the daily case are free." : `You get ${limit} free cases a day — no account needed. More with Pro.`}`,
    },
    { target: "league", title: "Weekly league", body: "Your XP counts towards a weekly league. Finish near the top to move up a league." },
    { target: "install", title: "Get the app", body: "Add RamAI to your home screen — it opens full-screen, like an app, with a daily reminder if you want one." },
    { target: "menu", title: "Your menu", body: "Your profile, the language patients speak (English, Hindi or Hinglish), where you practise, light or dark mode, the demo case again — and a box to send us suggestions." },
  ];

  const locked = (level: CareLevel) => {
    setPicker(false);
    setGate({ code: "PRO_REQUIRED", message: `${levelMeta(level, me.user.country).label} cases are part of RamAI Pro — along with unlimited cases every day.` });
  };
  const start = async (choice: Parameters<typeof launch>[0]) => {
    if (left === 0) {
      setPicker(false);
      setGate(
        me.user.isGuest
          ? { code: "SIGNUP_REQUIRED", message: `That's your ${limit} free cases for today. Log in and go Pro for unlimited cases — or come back after midnight.` }
          : { code: "DAILY_LIMIT", message: "Go Pro for unlimited cases at every level." },
      );
      return;
    }
    await launch(choice);
    setPicker(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Hero ------------------------------------------------------------ */}
        <section className="ink relative isolate overflow-hidden rounded-[22px] p-6 sm:p-8" aria-label="Your rank">
          {/* Whole on phones, in the space beside the buttons; beside the text on wider screens. */}
          <HeartScene className="pointer-events-none absolute right-0 bottom-0 -z-10 h-[210px] w-[46%] max-w-[190px] sm:top-0 sm:h-auto sm:w-[44%] sm:max-w-none" density="compact" tone="dark" />
          <p className="text-[13.5px] text-white/60">
            {hello}, Dr. {firstName(me.user.name)}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <span className="relative shrink-0">
              <Link href="/profile" prefetch aria-label="Your profile" className="shrink-0 rounded-full transition-transform active:scale-95">
                <DoctorFigure tier={rank.tier} size={84} className="rounded-full ring-2 ring-white/15" />
              </Link>
              <RankBadge tier={rank.tier} size={26} className="absolute -right-1.5 -bottom-1" />
            </span>
            <div className="min-w-0">
              <div className="text-[24px] leading-tight font-semibold tracking-[-0.02em] sm:text-[28px]">{rank.label}</div>
              <div className="mt-0.5 text-[13px] text-white/60">{next ? `${Math.round(toNext * 100)}% of the way to ${next.label}` : "The highest rank in RamAI"}</div>
              {next && DOCTOR_NEXT[rank.tier] && <div className="mt-1 text-[12.5px] text-cyan-300/90">Next unlock: {DOCTOR_NEXT[rank.tier]}</div>}
            </div>
          </div>
          <div className="mt-4 h-2 w-full max-w-[360px] overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progress to next rank" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(toNext * 100)}>
            <div className="bg-ai h-full rounded-full transition-[width] duration-1000" style={{ width: `${Math.max(3, toNext * 100)}%` }} />
          </div>

          {/* Until the saved case is known, hold the space — the buttons appear once, without shifting. */}
          {!snap.hydrated ? (
            <div className="mt-7 h-12" aria-hidden />
          ) : (
            <div className="mt-7 flex w-full max-w-[360px] animate-fade flex-col gap-2.5" data-tour="start">
              {active && (
                <Link href="/case" className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 text-[15px] font-semibold text-white backdrop-blur">
                  Resume {caseLabel(active.state.caseNumber)} <Icon name="arrow-right" size={16} />
                </Link>
              )}
              {/* New case first — choose the patient you want — then any case, one tap. */}
              <button type="button" onClick={() => setPicker(true)} className="shine inline-flex h-13 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[16px] font-bold text-white shadow-glow">
                <Icon name="plus" size={17} /> New case
              </button>
              {!active && (
                <button type="button" onClick={() => void start({})} disabled={starting} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-[14.5px] font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/10 disabled:opacity-70">
                  {starting ? startingLabel : "Any case"}
                  {!starting && <Icon name="shuffle" size={15} />}
                </button>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-amber-300">
              {error}
            </p>
          )}
        </section>

        {showGuide && <GuidedCard onStart={() => void launch({ tutorial: true })} onSkip={skipGuide} starting={starting} />}

        <ReviewCard onPractise={(disease) => void start({ disease })} starting={starting} />

        {/* Kept simple: the path of levels and the league are one tap away, not in the way. */}
        <div data-tour="levels">
          {showMore ? (
            <LevelPath progress={p} plan={plan} library={library} starting={starting} onStart={(level) => void start({ level })} onLocked={locked} />
          ) : (
            <button type="button" onClick={() => setShowMore(true)} className="panel flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-surface-2">
              <span>
                <span className="block text-[15px] font-semibold">Your path & weekly league</span>
                <span className="block text-[12.5px] text-fg-2">Six hospital levels, from PHC to rare & complex cases</span>
              </span>
              <Icon name="chevron-down" size={16} className="text-fg-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Today ----------------------------------------------------------- */}
        <section className="panel p-5" aria-labelledby="today-heading" data-tour="today">
          <h2 id="today-heading" className="sr-only">
            Today
          </h2>
          <div className="flex items-center gap-4">
            <GoalRing value={p.dailyXp} goal={p.dailyGoal} size={72} stroke={7}>
              {goalMet ? (
                <Icon name="check" size={24} strokeWidth={2.4} className="text-success" />
              ) : (
                <span className="text-center leading-none">
                  <span className="block text-[15px] font-semibold tabular">{p.dailyXp}</span>
                  <span className="block pt-0.5 text-[10px] text-fg-3 tabular">/{p.dailyGoal}</span>
                </span>
              )}
            </GoalRing>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">{goalMet ? "Daily goal met" : "Daily goal"}</div>
              <div className="mt-0.5 text-[13px] leading-5 text-fg-2">{goalMet ? "Brilliant. See you tomorrow." : `${p.dailyGoal - p.dailyXp} XP to go today`}</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-surface-2 px-3.5 py-3">
              <div className="flex items-center gap-1.5">
                <Flame active={p.streakDays > 0} size={18} />
                <span className="text-[18px] leading-none font-semibold tabular">{p.streakDays}</span>
              </div>
              <div className="mt-1.5 text-[12px] text-fg-2">day streak</div>
            </div>
            <div className="rounded-xl bg-surface-2 px-3.5 py-3">
              <div className="flex items-center gap-1.5">
                <Icon name="bolt" size={17} className="text-violet" />
                <span className="text-[18px] leading-none font-semibold tabular">{xp(p.xp)}</span>
              </div>
              <div className="mt-1.5 text-[12px] text-fg-2">total XP</div>
            </div>
          </div>

          {streakAtRisk && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--flame)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] font-medium text-flame">
              <Icon name="clock" size={14} /> One case today keeps your {p.streakDays}-day streak.
            </p>
          )}

          {left !== null && limit !== null && (
            <div className="mt-4 border-t border-line-2 pt-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium">Free cases today</span>
                <span className="text-fg-2 tabular">
                  {left} of {limit} left
                </span>
              </div>
              <div className="mt-2 flex gap-1.5" aria-hidden>
                {Array.from({ length: limit }, (_, i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < limit - left ? "bg-surface-3" : "bg-ai")} />
                ))}
              </div>
              {(me.user.isGuest || !inApp) && <Link href={me.user.isGuest ? "/signup" : "/pricing"} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text hover:underline">
                {me.user.isGuest ? "Sign up free — keep your progress" : "Unlimited cases with Pro"} <Icon name="arrow-right" size={13} />
              </Link>}
            </div>
          )}
        </section>

        <div data-tour="league">{showMore && <LeagueCard meId={me.user.id} />}</div>

        {/* The daily case — last on the page. */}
        <div data-tour="daily">
          <DailyCard onPlay={() => void launch({ daily: true })} starting={starting} />
        </div>

        <Link href="/suggestions" className="panel flex items-center gap-3 p-4 hover:bg-surface-2">
          <span aria-hidden className="text-[22px]">✨</span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold">New features are on the way</span>
            <span className="block text-[12.5px] text-fg-2">We add something new every week. Tell us what you&apos;d like next →</span>
          </span>
        </Link>
      </div>

      <CasePicker
        open={picker}
        onClose={() => setPicker(false)}
        onStart={(choice) => void start(choice)}
        onLocked={locked}
        library={library}
        plan={plan}
        starting={starting}
        activeCase={active?.state.caseNumber}
      />
      <UpgradeSheet gate={gate} onClose={closeGate} />
      <HomeTour stops={stops} open={tour} onClose={() => setTour(false)} />
      <SpecialtySheet open={askSpecialty} current={me.user.specialty} onClose={() => setAskSpecialty(false)} />
    </div>
  );
}
