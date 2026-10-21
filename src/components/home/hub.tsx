"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DoctorFigure } from "@/components/game/caricature";
import { GoalRing } from "@/components/game/goal-ring";
import { Flame } from "@/components/game/streak";
import { Icon } from "@/components/ui/icon";
import { nextRank, rankFor, rankProgress } from "@/engine/progression";
import { hydrate, useCase } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { useMe, type Me } from "@/lib/me-store";

const greeting = (h = new Date().getHours()) => (h < 5 ? "Late shift" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
const firstName = (name: string) => name.replace(/^dr\.?\s+/i, "").split(/\s+/)[0] ?? name;

/** Where each place goes, what it's for, and its colour — big, plain tiles anyone can find their way with. */
const PLACES = [
  { href: "/cases", icon: "pulse", title: "Cases", line: "See a patient — history, exam, tests, treatment", tint: "from-blue-500 to-cyan-400" },
  { href: "/practice", icon: "target", title: "Skills Lab", line: "ECGs, X-rays, sounds, drugs and calculations", tint: "from-violet-500 to-fuchsia-400" },
  { href: "/exams", icon: "file", title: "Exam MCQs", line: "NEET PG, USMLE and PLAB-style questions", tint: "from-amber-500 to-orange-400" },
  { href: "/leaderboard", icon: "trophy", title: "Leaderboard", line: "Your weekly league and rank", tint: "from-emerald-500 to-teal-400" },
  { href: "/community", icon: "users", title: "Community", line: "Ask, share and discuss cases", tint: "from-rose-500 to-pink-400" },
  { href: "/progress", icon: "award", title: "Progress", line: "Your strengths, gaps and report", tint: "from-sky-500 to-indigo-400" },
] as const;

/**
 * Home, for a signed-in doctor: who you are and where you've got to, one clear next step, and every part of
 * RamAI as a big tile — so the first screen explains the app rather than dropping you into the case list.
 */
export function Hub({ initial }: { initial: Me }) {
  const me = useMe(initial) ?? initial;
  const snap = useCase();
  const [hello, setHello] = useState("Welcome");
  useEffect(() => hydrate(me.user.id), [me.user.id]);
  useEffect(() => setHello(greeting()), []);

  const p = me.progress;
  const rank = rankFor(p.percent);
  const next = nextRank(p.percent);
  const toNext = rankProgress(p.percent);
  const active = snap.hydrated && snap.session && !snap.session.debrief ? snap.session : null;
  const limit = me.usage.dailyLimit;
  const left = limit === null ? null : Math.max(0, limit - me.usage.casesToday);
  const goalMet = p.dailyXp >= p.dailyGoal;

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* You */}
      <section className="panel relative overflow-hidden p-5 sm:p-7" aria-labelledby="hub-hello">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--mesh-1),transparent_70%)] opacity-70" />
        <div className="relative flex items-center gap-4">
          <DoctorFigure tier={rank.tier} size={72} className="shrink-0 rounded-full ring-2 ring-white/15" />
          <div className="min-w-0">
            <p className="text-[13.5px] text-fg-2">{hello},</p>
            <h1 id="hub-hello" className="truncate text-[24px] font-semibold tracking-[-0.02em] sm:text-[28px]">
              Dr. {firstName(me.user.name)}
            </h1>
            <p className="text-[13.5px] text-fg-2">
              {rank.label}
              {next ? ` · ${Math.round(toNext * 100)}% of the way to ${next.label}` : ""}
            </p>
          </div>
        </div>
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div className="bg-ai h-full rounded-full" style={{ width: `${Math.max(3, Math.round(toNext * 100))}%` }} />
        </div>

        {/* The one next step */}
        <div className="relative mt-5 flex flex-col gap-2.5 sm:flex-row">
          {active ? (
            <Link href="/case" className="shine flex h-13 flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[16px] font-semibold text-white shadow-glow">
              <Icon name="pulse" size={18} /> Continue your case
            </Link>
          ) : (
            <Link href="/cases" className="shine flex h-13 flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[16px] font-semibold text-white shadow-glow">
              <Icon name="pulse" size={18} /> Start a case
            </Link>
          )}
        </div>
        {left !== null && <p className="relative mt-2.5 text-center text-[12.5px] text-fg-3">{left} of {limit} free cases left today</p>}
      </section>

      {/* Today */}
      <section className="grid grid-cols-2 gap-3" aria-label="Today">
        <div className="panel flex items-center gap-3 p-4">
          <Flame active={p.streakDays > 0} size={26} />
          <div className="min-w-0">
            <div className="text-[20px] leading-6 font-semibold">{p.streakDays}</div>
            <div className="text-[12.5px] text-fg-2">day streak</div>
          </div>
        </div>
        <Link href="/profile" className="panel flex items-center gap-3 p-4">
          <GoalRing value={p.dailyXp} goal={p.dailyGoal} size={36} stroke={4} />
          <div className="min-w-0">
            <div className="text-[20px] leading-6 font-semibold">
              {p.dailyXp}
              <span className="text-[13px] font-normal text-fg-2">/{p.dailyGoal} XP</span>
            </div>
            <div className="text-[12.5px] text-fg-2">{goalMet ? "goal met today" : "today's goal"}</div>
          </div>
        </Link>
      </section>

      {/* Everything, as tiles */}
      <section aria-labelledby="hub-places">
        <h2 id="hub-places" className="mb-3 px-1 text-[15px] font-semibold text-fg-2">
          What would you like to do?
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {PLACES.map((pl) => (
            <Link key={pl.href} href={pl.href} prefetch className="panel group flex min-h-[132px] flex-col gap-2.5 p-4 transition-transform active:scale-[0.98] sm:p-5">
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm", pl.tint)}>
                <Icon name={pl.icon} size={22} />
              </span>
              <span className="text-[16px] font-semibold">{pl.title}</span>
              <span className="text-[12.5px] leading-5 text-fg-2">{pl.line}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
