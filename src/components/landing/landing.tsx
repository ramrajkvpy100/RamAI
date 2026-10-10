"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { CountryPicker } from "@/components/app/country-picker";
import { Wordmark } from "@/components/brand/wordmark";
import { Avatar } from "@/components/game/avatar";
import { GoalRing } from "@/components/game/goal-ring";
import { LEVEL_STYLE, levelGradient, TRACK_ICON } from "@/components/game/level-style";
import { RankBadge } from "@/components/game/rank-badge";
import { Flame } from "@/components/game/streak";
import { PeriodToggle, PlanCards } from "@/components/pricing/plan-cards";
import { Footer } from "@/components/shell/footer";
import { HeartScene } from "@/components/three/heart-scene";
import { Icon } from "@/components/ui/icon";
import { countryFromLocale, type Country } from "@/engine/countries";
import { levelMeta, trackLabel } from "@/engine/levels";
import { RANKS } from "@/engine/progression";
import { CARE_LEVELS, CASE_TRACKS } from "@/engine/types";
import { cn } from "@/lib/cn";
import { PLANS, type BillingPeriod } from "@/lib/plans";

import { DemoButton } from "./demo-button";
import { Tilt } from "./tilt";

const CTA = "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-glow transition-transform active:scale-[0.98]";

export function LandingNav() {
  return (
    <header className="material-bar sticky top-0 z-30 border-b border-[var(--material-stroke)]">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="RamAI — home" className="rounded-lg">
          <Wordmark size="md" />
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <Link href="/pricing" className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-fg-2 hover:text-fg sm:block">
            Pricing
          </Link>
          <Link href="/login" className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-fg-2 hover:text-fg">
            Log in
          </Link>
          <Link href="/signup" className="bg-ai ml-1 rounded-full px-4 py-2 text-[13.5px] font-semibold text-white shadow-glow">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Soft colour field + fading grid behind the hero. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[980px] overflow-hidden">
      <div className="absolute -top-40 -left-40 h-[620px] w-[620px] animate-[drift_18s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,var(--mesh-1),transparent_65%)]" />
      <div className="absolute top-20 -right-48 h-[680px] w-[680px] animate-[drift_22s_ease-in-out_infinite_reverse] rounded-full bg-[radial-gradient(circle,var(--mesh-3),transparent_65%)]" />
      <div className="absolute top-[420px] left-1/3 h-[520px] w-[520px] animate-[drift_26s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,var(--mesh-2),transparent_65%)]" />
      <div className="grid-fade absolute inset-0" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function Floating({ z, className, delay, children }: { z: number; className: string; delay: string; children: ReactNode }) {
  return (
    <div className={cn("absolute", className)} style={{ transform: `translateZ(${z}px)` }}>
      <div className="animate-bob" style={{ animationDelay: delay }}>
        {children}
      </div>
    </div>
  );
}

function MiniTrace() {
  return (
    <svg viewBox="0 0 120 28" className="h-7 w-[120px]" aria-hidden>
      <path
        d="M0 16h14l3-5 3 5h6l2 3 4-17 4 23 3-9h12l4-6 4 6h10l3-5 3 5h6l2 3 4-17 4 23 3-9h12"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="300"
        className="animate-trace"
        style={{ "--len": 300 } as CSSProperties}
      />
    </svg>
  );
}

function HeroStage() {
  return (
    <Tilt className="relative mx-auto w-full max-w-[560px]" max={9}>
      <div className="relative aspect-square transition-transform duration-500 ease-out [transform-style:preserve-3d] [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]">
        <div aria-hidden className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle,var(--mesh-1),transparent_68%)] blur-2xl" />
        <HeartScene className="absolute inset-0" />
        <Floating z={90} className="top-[9%] left-0 xl:-left-[4%]" delay="0s">
          <div className="glass-lite rounded-2xl px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="micro text-fg-3">HR</span>
              <span className="text-[26px] leading-none font-semibold tracking-[-0.02em] text-warning tabular">118</span>
              <span className="text-[12px] text-fg-3">/min</span>
            </div>
            <MiniTrace />
          </div>
        </Floating>
        <Floating z={60} className="top-[40%] right-0 xl:-right-[5%]" delay="-2.2s">
          <div className="glass-lite flex flex-col gap-2 rounded-2xl px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="micro w-9 text-fg-3">BP</span>
              <span className="text-[20px] leading-none font-semibold tracking-[-0.02em] tabular">88/56</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="micro w-9 text-fg-3">SpO₂</span>
              <span className="text-[20px] leading-none font-semibold tracking-[-0.02em] tabular">91%</span>
            </div>
          </div>
        </Floating>
        <Floating z={120} className="bottom-[9%] left-[6%]" delay="-4s">
          <div className="glass-lite flex items-center gap-2.5 rounded-full py-2 pr-4 pl-3 text-[13px] font-medium">
            <span className="pulse-ring h-2 w-2 rounded-full bg-danger" />
            Patient status changed.
          </div>
        </Floating>
      </div>
    </Tilt>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto grid w-full max-w-6xl items-center gap-4 px-4 pt-8 pb-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12 lg:pb-24">
      <div className="relative z-10 animate-rise">
        <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-fg-2">
          <span className="bg-ai h-1.5 w-1.5 rounded-full" />
          Clinical simulation for doctors · India, USA &amp; UK
        </span>
        <h1 className="mt-6 text-[44px] leading-[1.02] font-semibold tracking-[-0.04em] text-balance sm:text-[58px] lg:text-[66px]">
          Think like a doctor.
          <br />
          <span className="text-gradient">Every single day.</span>
        </h1>
        <p className="mt-6 max-w-[34rem] text-[16.5px] leading-7 text-fg-2 text-pretty">
          Real patients with hidden diagnoses. Take the history, examine, order tests and treat — nothing is suggested. Then see exactly what you missed, scored out of 100.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Link href="/signup" className={cn("shine", CTA)}>
            Start free <Icon name="arrow-right" size={16} />
          </Link>
          <DemoButton />
        </div>
        <p className="mt-4 text-[12.5px] text-fg-3">
          Try a guided case in 3 minutes — no sign-up · 3 free cases a day ·{" "}
          <Link href="/login" className="font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline">
            Log in
          </Link>
        </p>
      </div>
      <HeroStage />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <div className="micro text-accent-text">{eyebrow}</div>
      <h2 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[38px]">{title}</h2>
      {body && <p className="mt-4 text-[15.5px] leading-7 text-fg-2 text-pretty">{body}</p>}
    </div>
  );
}

/** A guess at where the visitor practises, from the browser's language — India until the page knows. */
function useVisitorCountry(): [Country, (country: Country) => void] {
  const [country, setCountry] = useState<Country>("IN");
  useEffect(() => setCountry(countryFromLocale(navigator.language)), []);
  return [country, setCountry];
}

function Ladder() {
  const [country, setCountry] = useVisitorCountry();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <SectionHead eyebrow="Six care levels" title="From first contact to the world's hardest cases." body="The facility decides what you can order. The level decides how hard the patient is. Climb from first-contact care to the rarest diagnoses in medicine — in India, the USA or the UK." />
      <div className="mt-6 flex justify-center">
        <CountryPicker value={country} onChange={setCountry} />
      </div>
      <ol className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        {CARE_LEVELS.map((id, i) => {
          const pro = !PLANS.free.levels.includes(id);
          return (
            <li key={id} className="group">
              <div className="panel relative flex h-full flex-col p-4 transition-transform duration-300 group-hover:-translate-y-1.5 lg:h-auto" style={{ minHeight: `${150 + i * 22}px` }}>
                <span className="press flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: levelGradient(id), "--press": LEVEL_STYLE[id].press } as CSSProperties}>
                  <Icon name={LEVEL_STYLE[id].icon} size={20} strokeWidth={1.9} />
                </span>
                <span className={cn("absolute top-3.5 right-3.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", pro ? "bg-ai text-white" : "bg-success-soft text-success")}>{pro ? "Pro" : "Free"}</span>
                <div className="mt-auto pt-6">
                  <div className="micro text-fg-3">Level {i + 1}</div>
                  <div className="mt-1 text-[15px] leading-tight font-semibold">{levelMeta(id, country).label}</div>
                  <div className="mt-1 text-[12.5px] leading-5 text-fg-2">{levelMeta(id, country).tagline}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const MODE_COPY: Record<(typeof CASE_TRACKS)[number], string> = {
  opd: "Walk-in patients. History, examination, the right test and the right prescription — at local prices.",
  phone: "A worried caller and no examination. Triage, advise, and know when to send them in.",
  emergency: "Unstable patients and a ticking clock. Wrong orders have consequences — and a window to rescue.",
};

function Modes() {
  const [country] = useVisitorCountry();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <SectionHead eyebrow="Three modes" title="Every way patients reach you." />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {CASE_TRACKS.map((t) => (
          <Tilt key={t} max={7}>
            <div className="panel h-full p-6 transition-transform duration-300 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <Icon name={TRACK_ICON[t]} size={20} />
              </span>
              <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">{trackLabel(t, country)}</h3>
              <p className="mt-2 text-[14px] leading-6 text-fg-2">{MODE_COPY[t]}</p>
            </div>
          </Tilt>
        ))}
      </div>
    </section>
  );
}

const SAMPLE_BOARD = [
  { name: "Dr. Aditi Rao", xp: 1240 },
  { name: "Dr. Kabir Shah", xp: 1115 },
  { name: "Dr. Neha Iyer", xp: 980 },
];

function Habit() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <SectionHead eyebrow="Built like a habit" title="Ten minutes a day. A sharper doctor every week." />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="panel p-6 md:col-span-2">
          <h3 className="text-[17px] font-semibold">Climb the ranks</h3>
          <p className="mt-1.5 text-[14px] leading-6 text-fg-2">Earned on your average across recent cases — not on grinding.</p>
          <div className="mt-6 flex items-end justify-between gap-1 overflow-x-auto pb-1">
            {RANKS.map((r) => (
              <RankBadge key={r.id} tier={r.tier} size={22 + r.tier * 2.6} />
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[12px] font-medium text-fg-3">
            <span>Medical Student</span>
            <span>Master Clinician</span>
          </div>
        </div>
        <div className="panel flex flex-col p-6">
          <Flame size={40} />
          <div className="mt-4 text-[26px] leading-none font-semibold tracking-[-0.02em] tabular">12-day streak</div>
          <p className="mt-2 text-[14px] leading-6 text-fg-2">One case a day keeps it alive.</p>
        </div>
        <div className="panel flex items-center gap-5 p-6">
          <GoalRing value={105} goal={150} size={76} stroke={8}>
            <span className="text-[13px] font-semibold tabular">70%</span>
          </GoalRing>
          <div>
            <h3 className="text-[17px] font-semibold">Daily goal</h3>
            <p className="mt-1 text-[14px] leading-6 text-fg-2">150 XP — usually two good cases.</p>
          </div>
        </div>
        <div className="panel p-6 md:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[17px] font-semibold">Weekly leaderboards</h3>
            <span className="text-[11.5px] text-fg-3">Example</span>
          </div>
          <p className="mt-1.5 text-[14px] leading-6 text-fg-2">Overall, OPD, Emergency, Phone and Hard cases. Resets every Monday.</p>
          <ol className="mt-4 flex flex-col gap-1.5">
            {SAMPLE_BOARD.map((r, i) => (
              <li key={r.name} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <span className="w-5 text-center text-[13px] font-semibold text-fg-3 tabular">{i + 1}</span>
                <Avatar name={r.name} size={28} />
                <span className="flex-1 text-[13.5px] font-medium">{r.name}</span>
                <span className="text-[13px] text-fg-2 tabular">{r.xp.toLocaleString("en-IN")} XP</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6" id="pricing">
      <div className="flex flex-col items-center text-center">
        <div className="micro text-accent-text">Pricing</div>
        <h2 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[38px]">Start free. Go Pro when you&apos;re hooked.</h2>
        <div className="mt-7">
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
      </div>
      <div className="mt-8">
        <PlanCards
          period={period}
          free={
            <Link href="/signup" className="flex h-11 items-center justify-center rounded-full border border-line bg-surface text-[14px] font-semibold shadow-sm hover:bg-surface-3">
              Start free
            </Link>
          }
          pro={
            <Link href="/signup?next=/pricing" className="flex h-11 items-center justify-center rounded-full bg-white text-[14px] font-semibold text-[#0b1220] hover:bg-white/90">
              Get Pro
            </Link>
          }
        />
      </div>
    </section>
  );
}

export function Landing() {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <Backdrop />
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <Ladder />
        <Modes />
        <Habit />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
