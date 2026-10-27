"use client";

import { EmptyState } from "@/components/ui/primitives";
import { useState } from "react";

import { AchievementReveal, SharePrize, type Prize } from "@/components/game/achievement-reveal";
import { DoctorFigure } from "@/components/game/caricature";
import { RankBadge } from "@/components/game/rank-badge";
import { Icon } from "@/components/ui/icon";
import { Medal } from "./medal";
import { BADGE_LIST, RANKS, rankFor } from "@/engine/progression";
import { cn } from "@/lib/cn";
import { useMe, type Me } from "@/lib/me-store";

/** Every achievement: those unlocked (open one to see it again, share it), and those still to earn. */
export function Achievements({ initial }: { initial: Me }) {
  const me = useMe(initial) ?? initial;
  const p = me.progress;
  const earned = new Set(p.badges.map((b) => b.id));
  const rank = rankFor(p.percent);
  const [open, setOpen] = useState<Prize | null>(null);
  const [sharing, setSharing] = useState<Prize | null>(null);
  const unlocked = BADGE_LIST.filter((b) => earned.has(b.id));
  const locked = BADGE_LIST.filter((b) => !earned.has(b.id));

  const share = (prize: Prize) => setSharing(prize);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.025em] sm:text-[38px]">Achievements</h1>
        <p className="mt-2 text-[15px] text-fg-2">
          {unlocked.length} of {BADGE_LIST.length} unlocked. Tap one to open it again, or share it.
        </p>
      </div>

      <section className="ink flex flex-col items-center gap-4 rounded-3xl px-6 py-6 text-center sm:flex-row sm:text-left">
        <button type="button" onClick={() => setOpen({ kind: "rank", label: rank.label, tier: rank.tier })} className="relative shrink-0" aria-label={`Open your rank: ${rank.label}`}>
          <DoctorFigure tier={rank.tier} size={88} className="rounded-full ring-2 ring-white/25" />
          <RankBadge tier={rank.tier} size={28} className="absolute -right-1 -bottom-0.5" />
        </button>
        <div className="flex-1">
          <div className="text-[12px] font-medium tracking-[0.08em] text-cyan-300 uppercase">Your rank</div>
          <div className="text-[22px] font-semibold">{rank.label}</div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {RANKS.map((r) => (
              <span key={r.id} title={r.label} className={cn("h-1.5 w-6 rounded-full", r.tier <= rank.tier ? "bg-cyan-300" : "bg-white/15")} />
            ))}
          </div>
        </div>
        <button type="button" onClick={() => share({ kind: "rank", label: rank.label, tier: rank.tier })} className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-semibold text-[#0b1220]">
          <Icon name="share-ios" size={15} /> Share
        </button>
      </section>

      <section aria-labelledby="unlocked">
        <h2 id="unlocked" className="micro mb-3 text-fg-2">
          Unlocked
        </h2>
        {unlocked.length === 0 ? (
          <EmptyState icon="award" title="No achievements yet" body="Finish a case to unlock your first." action={{ label: "Play a case", href: "/cases" }} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {unlocked.map((b) => {
              const prize: Prize = { kind: "badge", id: b.id, label: b.label, description: b.description };
              return (
                <li key={b.id} className="panel flex flex-col items-center gap-2 p-4 text-center">
                  <button type="button" onClick={() => setOpen(prize)} className="flex flex-col items-center gap-2" aria-label={`Open ${b.label}`}>
                    <span className="transition-transform hover:scale-105"><Medal id={b.id} size={76} /></span>
                    <span className="text-[14px] font-semibold">{b.label}</span>
                    <span className="text-[12px] leading-5 text-fg-2">{b.description}</span>
                  </button>
                  <button type="button" onClick={() => share(prize)} className="mt-1 flex h-8 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-[12.5px] font-semibold hover:bg-surface-2">
                    <Icon name="share-ios" size={13} /> Share
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {locked.length > 0 && (
        <section aria-labelledby="locked">
          <h2 id="locked" className="micro mb-3 text-fg-2">
            Still to earn
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {locked.map((b) => (
              <li key={b.id} className="card flex flex-col items-center gap-2 p-4 text-center opacity-80">
                <Medal id={b.id} size={64} locked />
                <span className="text-[13.5px] font-semibold">{b.label}</span>
                <span className="text-[12px] leading-5 text-fg-2">{b.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && <AchievementReveal key={`${open.kind}-${open.label}`} prizes={[open]} storageKey={null} onDone={() => setOpen(null)} />}
      {sharing && <SharePrize prize={sharing} open onClose={() => setSharing(null)} />}
    </div>
  );
}
