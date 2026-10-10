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
import type { LibraryInfo } from "@/lib/engine-client";
import { caseLabel, xp } from "@/lib/format";
import { useMe, type Me } from "@/lib/me-store";
import { PLANS } from "@/lib/plans";

import { CasePicker } from "./case-picker";
import { GuidedCard } from "./guided-card";
import { LevelPath } from "./level-path";
import { UpgradeSheet } from "./upgrade-sheet";
import { DailyCard } from "./daily-card";
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
  const snap = useCase();
  const { launch, starting, gate, setGate, closeGate, error } = useLauncher();
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
  const plan = PLANS[me.user.plan];
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

  const locked = (level: CareLevel) => {
    setPicker(false);
    setGate({ code: "PRO_REQUIRED", message: `${levelMeta(level, me.user.country).label} cases are part of RamAI Pro — along with unlimited cases every day.` });
  };
  const start = async (choice: Parameters<typeof launch>[0]) => {
    if (left === 0) {
      setPicker(false);
      setGate({ code: "DAILY_LIMIT", message: `You've used today's ${limit} free cases. They refresh at midnight — or go Pro for unlimited cases.` });
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
          <HeartScene className="pointer-events-none absolute -top-12 -right-24 -z-10 h-[340px] w-[340px] opacity-80 sm:-right-6 sm:h-[380px] sm:w-[380px] sm:opacity-100" density="compact" tone="dark" />
          <p className="text-[13.5px] text-white/60">
            {hello}, Dr. {firstName(me.user.name)}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <span className="relative shrink-0">
              <DoctorFigure tier={rank.tier} size={84} className="rounded-full ring-2 ring-white/15" />
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
            <div className="mt-7 flex animate-fade flex-wrap items-center gap-2.5">
              {active ? (
                <Link href="/case" className="shine inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-glow">
                  Resume {caseLabel(active.state.caseNumber)} <Icon name="arrow-right" size={16} />
                </Link>
              ) : (
                <button type="button" onClick={() => void start({})} disabled={starting} className="shine inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-glow disabled:opacity-70">
                  {starting ? "Preparing case…" : "Start case"}
                  {!starting && <Icon name="arrow-right" size={16} />}
                </button>
              )}
              <button type="button" onClick={() => setPicker(true)} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 text-[14.5px] font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/10">
                <Icon name="sliders" size={15} /> {active ? "New case" : "Choose case"}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-amber-300">
              {error}
            </p>
          )}
        </section>

        <DailyCard onPlay={() => void launch({ daily: true })} starting={starting} />

        {showGuide && <GuidedCard onStart={() => void launch({ tutorial: true })} onSkip={skipGuide} starting={starting} />}

        <LevelPath progress={p} plan={plan} library={library} starting={starting} onStart={(level) => void start({ level })} onLocked={locked} />
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Today ----------------------------------------------------------- */}
        <section className="panel p-5" aria-labelledby="today-heading">
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
              <Link href="/pricing" className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text hover:underline">
                Unlimited cases with Pro <Icon name="arrow-right" size={13} />
              </Link>
            </div>
          )}
        </section>

        <LeagueCard meId={me.user.id} />
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
    </div>
  );
}
