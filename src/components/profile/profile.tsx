"use client";

import Link from "next/link";

import { Avatar } from "@/components/game/avatar";
import { DoctorFigure } from "@/components/game/caricature";
import { LEVEL_STYLE, levelGradient } from "@/components/game/level-style";
import { RankBadge } from "@/components/game/rank-badge";
import { Flame } from "@/components/game/streak";
import { Icon, type IconName } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/primitives";
import { levelMeta, trackLabel } from "@/engine/levels";
import { BADGE_LIST, nextRank, RANKS, rankFor, rankProgress } from "@/engine/progression";
import { cn } from "@/lib/cn";
import { caseLabel, xp } from "@/lib/format";
import { useMe, type Me } from "@/lib/me-store";
import { PLANS } from "@/lib/plans";

import { YourData } from "./your-data";

const BADGE_ICON: Record<string, IconName> = {
  "first-case": "user",
  "ten-cases": "users",
  "fifty-cases": "award",
  "streak-7": "flame",
  "streak-30": "flame",
  rescuer: "shield",
  sharp: "target",
  phone: "phone",
  "grand-rounds": "crown",
  "full-circuit": "sparkles",
};

const VERDICT_ICON = { correct: { icon: "check", cls: "bg-success-soft text-success" }, implied: { icon: "check", cls: "bg-success-soft text-success" }, partial: { icon: "more", cls: "bg-warning-soft text-warning" }, incorrect: { icon: "x", cls: "bg-danger-soft text-danger" } } as const;

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="panel flex flex-col gap-2 p-4">
      <div className="flex h-8 w-8 items-center justify-center">{icon}</div>
      <div className="text-[22px] leading-none font-semibold tracking-[-0.02em] tabular">{value}</div>
      <div className="text-[12.5px] text-fg-2">{label}</div>
    </div>
  );
}

const joined = (ms: number) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(ms));

export function Profile({ initial }: { initial: Me }) {
  const me = useMe(initial) ?? initial;
  const p = me.progress;
  const rank = rankFor(p.percent);
  const next = nextRank(p.percent);
  const plan = PLANS[me.user.plan];
  const earned = new Set(p.badges.map((b) => b.id));
  const mastery = p.mastery.filter((m) => m.cases > 0).sort((a, b) => b.cases - a.cases);
  const recent = [...p.history].reverse().slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <section className="panel flex flex-col gap-6 p-6 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={me.user.name} size={64} />
          <div className="min-w-0">
            <h1 className="truncate text-[24px] leading-tight font-semibold tracking-[-0.02em]">{me.user.name}</h1>
            <p className="mt-1 text-[13.5px] text-fg-2">
              @{me.user.username} · Joined {joined(me.user.createdAt)}
            </p>
            <p className="mt-2 flex items-center gap-2 text-[12.5px]">
              {me.user.plan === "pro" ? (
                <span className="bg-ai inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-white">
                  <Icon name="crown" size={12} /> Pro{me.user.planExpiresAt ? ` until ${new Date(me.user.planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </span>
              ) : (
                <>
                  <span className="rounded-full bg-surface-3 px-2.5 py-0.5 font-medium text-fg-2">Free plan</span>
                  <Link href="/pricing" className="font-semibold text-accent-text hover:underline">
                    Go Pro
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-2xl bg-surface-2 px-4 py-3.5 md:ml-auto md:w-[340px]">
          <span className="relative shrink-0">
            <DoctorFigure tier={rank.tier} size={60} />
            <RankBadge tier={rank.tier} size={20} className="absolute -right-1 -bottom-0.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{rank.label}</div>
            <ProgressBar value={rankProgress(p.percent)} className="mt-2 h-1.5" label="Progress to next rank" />
            <div className="mt-1.5 text-[12px] text-fg-2 tabular">
              Rank score {p.percent.toFixed(1)}
              {next ? ` · ${next.label} at ${next.minPercent}` : " · highest rank"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Statistics">
        <Stat icon={<Icon name="user" size={20} className="text-accent-text" />} value={p.casesCompleted} label="Cases completed" />
        <Stat icon={<Icon name="bolt" size={20} className="text-violet" />} value={xp(p.xp)} label="Total XP" />
        <Stat icon={<Flame active={p.streakDays > 0} size={22} />} value={p.streakDays} label="Day streak" />
        <Stat icon={<Icon name="trophy" size={20} className="text-flame" />} value={p.bestStreak} label="Best streak" />
      </section>

      <section className="panel p-6" aria-labelledby="doctor-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="doctor-heading" className="text-[16px] font-semibold">
            Your doctor
          </h2>
          <span className="text-[12.5px] text-fg-3">A new outfit with every rank</span>
        </div>
        <ul className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-10">
          {RANKS.map((r) => {
            const unlocked = r.tier <= rank.tier;
            return (
              <li key={r.id} className="flex flex-col items-center text-center" title={unlocked ? r.label : `Unlocks at ${r.label}`}>
                <span className={cn("relative rounded-full", r.tier === rank.tier && "ring-2 ring-accent ring-offset-2 ring-offset-surface")}>
                  <span className={cn("block", !unlocked && "opacity-40 grayscale")}>
                    <DoctorFigure tier={r.tier} size={56} />
                  </span>
                  {!unlocked && (
                    <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-fg-3 ring-2 ring-surface">
                      <Icon name="lock" size={11} />
                    </span>
                  )}
                </span>
                <span className={cn("mt-1.5 text-[10.5px] leading-tight", unlocked ? "font-medium text-fg" : "text-fg-3")}>{r.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel p-6" aria-labelledby="badges-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="badges-heading" className="text-[16px] font-semibold">
            Badges
          </h2>
          <span className="text-[12.5px] text-fg-3 tabular">
            {earned.size} of {BADGE_LIST.length}
          </span>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {BADGE_LIST.map((b) => {
            const has = earned.has(b.id);
            return (
              <li key={b.id} className={cn("flex flex-col items-center rounded-2xl border px-3 py-4 text-center", has ? "border-line bg-surface" : "border-dashed border-line bg-transparent")} title={b.description}>
                <span className={cn("flex h-12 w-12 items-center justify-center rounded-full", has ? "bg-ai text-white shadow-glow" : "bg-surface-3 text-fg-3")}>
                  <Icon name={has ? (BADGE_ICON[b.id] ?? "award") : "lock"} size={20} strokeWidth={1.8} />
                </span>
                <span className={cn("mt-2.5 text-[12.5px] leading-tight font-semibold", !has && "text-fg-2")}>{b.label}</span>
                <span className="mt-1 text-[11px] leading-4 text-fg-3">{b.description}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="panel p-6" aria-labelledby="levels-heading">
          <h2 id="levels-heading" className="text-[16px] font-semibold">
            Care levels
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {p.levels.map((l) => {
              const locked = !plan.levels.includes(l.level);
              return (
                <li key={l.level} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: locked ? "var(--fg-3)" : levelGradient(l.level) }}>
                    <Icon name={locked ? "lock" : LEVEL_STYLE[l.level].icon} size={16} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">{levelMeta(l.level, me.user.country).label}</div>
                    <div className="text-[12px] text-fg-2 tabular">{locked ? "Pro" : l.cases ? `${l.cases} case${l.cases === 1 ? "" : "s"}` : "Not played yet"}</div>
                  </div>
                  {l.cases > 0 && <span className="text-[14px] font-semibold tabular">{l.best}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel p-6" aria-labelledby="specialties-heading">
          <h2 id="specialties-heading" className="text-[16px] font-semibold">
            Specialty mastery
          </h2>
          {mastery.length === 0 ? (
            <p className="mt-4 text-[13.5px] text-fg-2">Your mastery appears here after your first case.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3.5">
              {mastery.map((m) => (
                <li key={m.specialty}>
                  <div className="flex items-baseline justify-between text-[13.5px]">
                    <span className="font-medium">{m.specialty}</span>
                    <span className="text-[12px] text-fg-2 tabular">
                      {m.percent}% · {m.cases} case{m.cases === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ProgressBar value={m.percent / 100} className="mt-1.5 h-1.5" label={`${m.specialty} mastery`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel overflow-hidden" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="px-6 pt-6 text-[16px] font-semibold">
          Recent cases
        </h2>
        {recent.length === 0 ? (
          <p className="px-6 pt-3 pb-6 text-[13.5px] text-fg-2">No cases yet — your history will appear here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line-2">
            {recent.map((h) => {
              const v = h.verdict && h.verdict !== "not-recorded" ? VERDICT_ICON[h.verdict as keyof typeof VERDICT_ICON] : null;
              return (
                <li key={`${h.caseNumber}-${h.completedISO}`} className="flex items-center gap-3 px-6 py-3">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", v?.cls ?? "bg-surface-3 text-fg-3")}>
                    <Icon name={v?.icon ?? "more"} size={13} strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{h.diagnosis}</div>
                    <div className="truncate text-[12px] text-fg-2">
                      {caseLabel(h.caseNumber)} · {trackLabel(h.track, me.user.country)} · {levelMeta(h.level, me.user.country).short} · {h.specialty}
                    </div>
                  </div>
                  <span className="text-[14px] font-semibold tabular">{h.score}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <YourData me={me} />
    </div>
  );
}
