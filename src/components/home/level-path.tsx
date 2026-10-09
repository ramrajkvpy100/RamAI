"use client";

import type { CSSProperties } from "react";

import { LEVEL_STYLE, levelGradient } from "@/components/game/level-style";
import { Icon } from "@/components/ui/icon";
import { levelMeta } from "@/engine/levels";
import { CARE_LEVELS, type CareLevel, type PlayerProgress } from "@/engine/types";
import { cn } from "@/lib/cn";
import type { LibraryInfo } from "@/lib/engine-client";
import { useMe } from "@/lib/me-store";
import type { Plan } from "@/lib/plans";

/** Best score that clears a level on the path. */
export const CLEAR_SCORE = 70;

const RING = 84;
const STROKE = 5;

function Node({
  level,
  index,
  cases,
  best,
  locked,
  available,
  current,
  disabled,
  onClick,
}: {
  level: CareLevel;
  index: number;
  cases: number;
  best: number;
  locked: boolean;
  available: boolean;
  current: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const meta = levelMeta(level, useMe()?.user.country);
  const s = LEVEL_STYLE[level];
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const cleared = best >= CLEAR_SCORE;
  const sub = locked ? "Pro" : !available ? "Coming soon" : cases ? `Best ${best}` : "New";
  return (
    <li className={cn("flex flex-col items-center text-center", index % 2 === 1 && "translate-y-6")}>
      <div className="relative" style={{ width: RING, height: RING }}>
        {current && (
          <span className="absolute -top-10 left-1/2 z-10 -translate-x-1/2">
            <span className="block animate-bob rounded-lg border border-line bg-surface px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap text-accent-text shadow-md">
              Start here
            </span>
          </span>
        )}
        <svg width={RING} height={RING} className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
          {cases > 0 && !locked && (
            <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={s.to} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, best / CLEAR_SCORE))} className="transition-[stroke-dashoffset] duration-1000" />
          )}
        </svg>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || (!available && !locked)}
          aria-label={`${meta.label} — ${sub}`}
          className="press absolute inset-[10px] flex items-center justify-center rounded-full text-white disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: locked || !available ? "var(--surface-3)" : levelGradient(level), "--press": locked || !available ? "var(--line)" : s.press } as CSSProperties}
        >
          <span aria-hidden className="absolute inset-0 rounded-full bg-[radial-gradient(90%_60%_at_30%_15%,rgb(255_255_255/0.4),transparent_60%)]" />
          <Icon name={locked ? "lock" : s.icon} size={24} strokeWidth={1.9} className={cn("relative", (locked || !available) && "text-fg-3")} />
        </button>
        {cleared && !locked && (
          <span className="absolute right-0.5 bottom-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-success text-white" aria-hidden>
            <Icon name="check" size={12} strokeWidth={2.6} />
          </span>
        )}
      </div>
      <div className="mt-2.5 text-[13px] leading-tight font-semibold">{meta.short}</div>
      <div className={cn("mt-0.5 text-[11.5px] tabular", locked ? "font-semibold text-violet" : "text-fg-3")}>{sub}</div>
    </li>
  );
}

/** First contact → Global Centre of Excellence as a path. Every unlocked level stays playable; the path only recommends. */
export function LevelPath({
  progress,
  plan,
  library,
  starting,
  onStart,
  onLocked,
}: {
  progress: PlayerProgress;
  plan: Plan;
  library: LibraryInfo;
  starting: boolean;
  onStart: (level: CareLevel) => void;
  onLocked: (level: CareLevel) => void;
}) {
  const stats = (l: CareLevel) => progress.levels.find((x) => x.level === l) ?? { level: l, cases: 0, best: 0 };
  const playable = (l: CareLevel) => plan.levels.includes(l) && (library.levels[l] ?? 0) > 0;
  const current = CARE_LEVELS.find((l) => playable(l) && stats(l).best < CLEAR_SCORE) ?? [...CARE_LEVELS].reverse().find(playable);

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="path-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="path-heading" className="text-[17px] font-semibold tracking-[-0.01em]">
          Your path
        </h2>
        <span className="text-[12px] text-fg-3">Score {CLEAR_SCORE}+ to clear a level</span>
      </div>
      <div className="relative mt-12 pb-8">
        <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="absolute inset-x-0 top-0 hidden h-[120px] w-full sm:block" aria-hidden>
          <path d="M50 42 C100 42 100 66 150 66 S200 42 250 42 S300 66 350 66 S400 42 450 42 S500 66 550 66" fill="none" stroke="var(--line)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <ol className="relative grid grid-cols-3 gap-y-10 sm:grid-cols-6 sm:gap-y-0">
          {CARE_LEVELS.map((l, i) => {
            const st = stats(l);
            const locked = !plan.levels.includes(l);
            return (
              <Node
                key={l}
                level={l}
                index={i}
                cases={st.cases}
                best={st.best}
                locked={locked}
                available={(library.levels[l] ?? 0) > 0}
                current={l === current}
                disabled={starting}
                onClick={() => (locked ? onLocked(l) : onStart(l))}
              />
            );
          })}
        </ol>
      </div>
    </section>
  );
}
