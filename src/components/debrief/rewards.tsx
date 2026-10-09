"use client";

import { DoctorFigure } from "@/components/game/caricature";
import { GoalRing } from "@/components/game/goal-ring";
import { RankBadge } from "@/components/game/rank-badge";
import { Flame } from "@/components/game/streak";
import { Icon } from "@/components/ui/icon";
import { RANKS } from "@/engine/progression";
import type { CaseRewards, PlayerProgress } from "@/engine/types";
import { league } from "@/lib/leagues";
import { useCountUp } from "@/lib/use-count-up";

import { Confetti } from "./confetti";

function Tile({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <div className="panel flex animate-pop flex-col items-start gap-3 p-4 sm:p-5" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const rankIndex = (label: string) => RANKS.findIndex((r) => r.label === label);

/**
 * What this case earned: XP, streak, daily goal, weekly position, badges and
 * promotions. Rewards come from the server's record of the case; a debrief
 * reopened later falls back to current progress.
 */
export function RewardsPanel({ xpEarned, score, rewards, progress, seed }: { xpEarned: number; score: number; rewards?: CaseRewards; progress: PlayerProgress; seed: number }) {
  const shown = useCountUp(xpEarned, 1400, 450);
  const streak = rewards?.streakDays ?? progress.streakDays;
  const dailyXp = rewards?.dailyXp ?? progress.dailyXp;
  const dailyGoal = rewards?.dailyGoal ?? progress.dailyGoal;
  const goalMet = dailyXp >= dailyGoal;
  const goalJustMet = !!rewards && goalMet && dailyXp - xpEarned < dailyGoal;
  const promoted = !!rewards && rankIndex(rewards.rankAfter) > rankIndex(rewards.rankBefore);
  const position = rewards?.weeklyPosition;
  const before = rewards?.weeklyPositionBefore;
  const climbed = position !== undefined && before !== undefined ? before - position : 0;
  const leagueName = league(rewards?.leagueTier ?? 0).label;
  const celebrate = !!rewards && (score >= 80 || promoted || goalJustMet || rewards.newBadges.length > 0);

  return (
    <section className="relative" aria-label="Rewards">
      {celebrate && <Confetti seed={seed} />}

      {promoted && rewards && (
        <div className="ink mb-3 flex animate-pop items-center gap-4 rounded-2xl px-5 py-4">
          <span className="relative shrink-0">
            <DoctorFigure tier={RANKS[rankIndex(rewards.rankAfter)]?.tier ?? 1} size={64} className="rounded-full ring-2 ring-white/20" />
            <RankBadge tier={RANKS[rankIndex(rewards.rankAfter)]?.tier ?? 1} size={22} className="absolute -right-1 -bottom-0.5" />
          </span>
          <div>
            <div className="text-[12px] font-medium tracking-[0.08em] text-cyan-300 uppercase">Promoted</div>
            <div className="text-[19px] font-semibold tracking-[-0.01em]">You&apos;re now {/^[AEIOU]/.test(rewards.rankAfter) ? "an" : "a"} {rewards.rankAfter}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile delay={80}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--violet)_14%,transparent)] text-violet">
            <Icon name="bolt" size={18} />
          </span>
          <div>
            <div className="text-gradient text-[30px] leading-none font-semibold tracking-[-0.03em] tabular">+{Math.round(shown)}</div>
            <div className="mt-1.5 text-[12.5px] text-fg-2">XP earned</div>
          </div>
        </Tile>

        <Tile delay={160}>
          <Flame active={streak > 0} size={34} />
          <div>
            <div className="text-[22px] leading-none font-semibold tracking-[-0.02em] tabular">
              {streak} day{streak === 1 ? "" : "s"}
            </div>
            <div className="mt-1.5 text-[12.5px] text-fg-2">{rewards?.streakExtended ? "Streak extended" : streak > 0 ? "Streak alive" : "Streak"}</div>
          </div>
        </Tile>

        <Tile delay={240}>
          <GoalRing value={dailyXp} goal={dailyGoal} size={40} stroke={5}>
            {goalMet && <Icon name="check" size={16} strokeWidth={2.6} className="text-success" />}
          </GoalRing>
          <div>
            <div className="text-[22px] leading-none font-semibold tracking-[-0.02em] tabular">
              {Math.min(dailyXp, 9999)}
              <span className="text-[14px] font-medium text-fg-3">/{dailyGoal}</span>
            </div>
            <div className="mt-1.5 text-[12.5px] text-fg-2">{goalJustMet ? "Daily goal met!" : goalMet ? "Daily goal met" : "Daily goal"}</div>
          </div>
        </Tile>

        <Tile delay={320}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--flame)_14%,transparent)] text-flame">
            <Icon name="trophy" size={18} />
          </span>
          <div>
            <div className="text-[22px] leading-none font-semibold tracking-[-0.02em] tabular">{position ? `#${position}` : "—"}</div>
            <div className="mt-1.5 flex items-center gap-1 text-[12.5px] text-fg-2">
              {position && climbed > 0 ? (
                <>
                  <Icon name="trending-up" size={13} className="text-success" /> Up {climbed} in {leagueName}
                </>
              ) : position && before === undefined ? (
                `Joined the ${leagueName} League`
              ) : position ? (
                `${leagueName} League`
              ) : (
                "Weekly league"
              )}
            </div>
          </div>
        </Tile>
      </div>

      {rewards && rewards.newBadges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rewards.newBadges.map((b, i) => (
            <span key={b.id} className="flex animate-pop items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-1.5 text-[13px] shadow-sm" style={{ animationDelay: `${420 + i * 90}ms` }}>
              <span className="bg-ai flex h-6 w-6 items-center justify-center rounded-full text-white">
                <Icon name="award" size={13} />
              </span>
              <span>
                <span className="font-semibold">New badge:</span> {b.label}
              </span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
