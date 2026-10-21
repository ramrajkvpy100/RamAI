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
import { dailyKeyFor, dailyNumber } from "@/lib/daily";
import { useMe, type Me } from "@/lib/me-store";

const greeting = (h = new Date().getHours()) => (h < 5 ? "Late shift" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
const firstName = (name: string) => name.replace(/^dr\.?\s+/i, "").split(/\s+/)[0] ?? name;

/** Where each place goes, what it's for, and its colour — big, plain tiles anyone can find their way with. */
const PLACES = [
  { href: "/cases", icon: "pulse", title: "Cases", line: "See a patient — history, exam, tests, treatment", tint: "from-blue-500 to-cyan-400", soft: "from-blue-500/10 to-cyan-400/5" },
  { href: "/practice", icon: "target", title: "Skills Lab", line: "ECGs, X-rays, sounds, drugs and calculations", tint: "from-violet-500 to-fuchsia-400", soft: "from-violet-500/10 to-fuchsia-400/5" },
  { href: "/exams", icon: "file", title: "Exam MCQs", line: "NEET PG, USMLE and PLAB-style questions", tint: "from-amber-500 to-orange-400", soft: "from-amber-500/10 to-orange-400/5" },
  { href: "/leaderboard", icon: "trophy", title: "Leaderboard", line: "Your weekly league and rank", tint: "from-emerald-500 to-teal-400", soft: "from-emerald-500/10 to-teal-400/5" },
  { href: "/community", icon: "users", title: "Community", line: "Ask, share and discuss cases", tint: "from-rose-500 to-pink-400", soft: "from-rose-500/10 to-pink-400/5" },
  { href: "/progress", icon: "award", title: "Progress", line: "Your strengths, gaps and report", tint: "from-sky-500 to-indigo-400", soft: "from-sky-500/10 to-indigo-400/5" },
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

  const day = dailyKeyFor();
  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* You — a bright welcome card */}
      <section className="bg-ai relative overflow-hidden rounded-[26px] p-5 text-white shadow-glow sm:p-7" aria-labelledby="hub-hello">
        <svg aria-hidden viewBox="0 0 400 80" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full opacity-25">
          <polyline fill="none" stroke="white" strokeWidth="2.5" strokeLinejoin="round" points="0,55 120,55 140,55 152,20 166,72 178,40 190,55 400,55" />
        </svg>
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <DoctorFigure tier={rank.tier} size={76} className="shrink-0 rounded-full bg-white/15 ring-2 ring-white/40" />
          <div className="min-w-0">
            <p className="text-[13.5px] text-white/85">{hello},</p>
            <h1 id="hub-hello" className="truncate text-[26px] leading-tight font-bold tracking-[-0.02em] sm:text-[30px]">
              Dr. {firstName(me.user.name)}
            </h1>
            <p className="text-[13.5px] text-white/85">{rank.label}</p>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="flex justify-between text-[12px] text-white/80">
            <span>{next ? `Next: ${next.label}` : "Top rank"}</span>
            <span>{Math.round(toNext * 100)}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/25" aria-hidden>
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(3, Math.round(toNext * 100))}%` }} />
          </div>
        </div>
        <Link
          href={active ? "/case" : "/cases"}
          className="relative mt-5 flex h-13 items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[16px] font-bold text-[#3b3fd8] shadow-lg transition-transform active:scale-[0.98]"
        >
          <Icon name="pulse" size={18} /> {active ? "Continue your case" : "Start a case"}
        </Link>
        {left !== null && <p className="relative mt-2.5 text-center text-[12.5px] text-white/85">{left} of {limit} free cases left today</p>}
      </section>

      {/* Today */}
      <section className="grid grid-cols-2 gap-3" aria-label="Today">
        <div className="panel flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/12">
            <Flame active={p.streakDays > 0} size={24} />
          </span>
          <div className="min-w-0">
            <div className="text-[20px] leading-6 font-bold">{p.streakDays}</div>
            <div className="text-[12.5px] text-fg-2">day streak</div>
          </div>
        </div>
        <Link href="/profile" className="panel flex items-center gap-3 p-4">
          <GoalRing value={p.dailyXp} goal={p.dailyGoal} size={44} stroke={5} />
          <div className="min-w-0">
            <div className="text-[20px] leading-6 font-bold">
              {p.dailyXp}
              <span className="text-[13px] font-normal text-fg-2">/{p.dailyGoal}</span>
            </div>
            <div className="text-[12.5px] text-fg-2">{goalMet ? "goal met 🎉" : "XP today"}</div>
          </div>
        </Link>
      </section>

      {/* The daily case */}
      <Link href="/cases" className="panel group relative flex items-center gap-4 overflow-hidden p-4 sm:p-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-orange-400 to-rose-500" />
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-sm">
          <Icon name="calendar" size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold">Daily case #{dailyNumber(day)}</span>
          <span className="block text-[13px] leading-5 text-fg-2">The same patient for every doctor today — see where you rank.</span>
        </span>
        <Icon name="arrow-right" size={18} className="shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5" />
      </Link>

      {/* Everything, as tiles */}
      <section aria-labelledby="hub-places">
        <h2 id="hub-places" className="mb-3 px-1 text-[17px] font-semibold">
          What would you like to do?
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {PLACES.map((pl) => (
            <Link
              key={pl.href}
              href={pl.href}
              prefetch
              className={cn("group relative flex min-h-[140px] flex-col gap-2 overflow-hidden rounded-[22px] border border-line bg-gradient-to-br p-4 transition-transform active:scale-[0.98] sm:p-5", pl.soft)}
            >
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md", pl.tint)}>
                <Icon name={pl.icon} size={22} />
              </span>
              <span className="mt-1 flex items-center gap-1 text-[16px] font-semibold">
                {pl.title}
                <Icon name="arrow-right" size={14} className="text-fg-3 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-[12.5px] leading-5 text-fg-2">{pl.line}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
