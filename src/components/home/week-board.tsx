"use client";

import Link from "next/link";

import { DoctorFigure } from "@/components/game/caricature";
import { LeagueBadge } from "@/components/leaderboard/league-badge";
import { nudgeFor, useCountdown, useLeague, type LeagueRow } from "@/components/leaderboard/league-data";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { xp } from "@/lib/format";
import { league } from "@/lib/leagues";

export interface LeaderRow {
  position: number;
  userId: string;
  name: string;
  username: string;
  xp: number;
  cases: number;
  rankTier: number;
  rankLabel: string;
  demo: boolean;
}

export interface Board {
  board: string;
  period: "week" | "all";
  rows: LeaderRow[];
  me?: LeaderRow;
  total: number;
}

export async function fetchBoard(board: string, period: "week" | "all"): Promise<Board | null> {
  const res = await fetch(`/api/leaderboard?board=${board}&period=${period}`, { cache: "no-store" }).catch(() => null);
  return res?.ok ? ((await res.json()) as Board) : null;
}

const NUDGE_CLS = { lead: "text-amber-600 dark:text-amber-400", safe: "text-success", up: "text-accent-text", danger: "text-danger" } as const;

function MiniRow({ r, me }: { r: LeagueRow; me: boolean }) {
  return (
    <li className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-1.5", me && "bg-accent-soft")}>
      <span className={cn("w-5 text-center text-[13px] font-semibold tabular", r.position <= 3 ? "text-flame" : "text-fg-3")}>{r.position}</span>
      <DoctorFigure tier={r.rankTier} seed={r.userId} size={28} title={r.name} className="rounded-full" />
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{me ? "You" : r.name}</span>
      <span className="text-[12.5px] text-fg-2 tabular">{xp(r.xp)} XP</span>
    </li>
  );
}

/** This week's league at a glance: where you stand, who's next, how long is left. */
export function LeagueCard({ meId }: { meId: string }) {
  const { view } = useLeague();
  const countdown = useCountdown(view?.weekEnd);
  const l = league(view?.tier ?? 0);
  const nudge = view ? nudgeFor(view, meId) : null;
  const rows = view?.rows ?? [];
  const top = rows.slice(0, 3);
  const mine = rows.find((r) => r.userId === meId);

  return (
    <section className="panel p-5" aria-labelledby="league-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="league-heading" className="flex items-center gap-2 text-[15px] font-semibold">
          <LeagueBadge tier={view?.tier ?? 0} size={22} locked={!view} /> {view ? `${l.label} League` : "League"}
        </h2>
        {view && (
          <span className="flex items-center gap-1 text-[12px] text-fg-3 tabular" title="Leagues reset every Monday at 00:00 IST">
            <Icon name="clock" size={12} /> {countdown}
          </span>
        )}
      </div>

      {view === undefined ? (
        <div className="mt-4 flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-breathe rounded-xl bg-surface-3" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : view === null ? (
        <p className="mt-3 text-[13px] text-fg-2">The league couldn&apos;t load right now.</p>
      ) : view.status !== "joined" ? (
        <p className="mt-3 animate-enter text-[13.5px] leading-6 text-fg-2">
          {view.status === "waiting"
            ? `Finish a case to join this week's ${l.label} League — up to 30 doctors, top 5 move up.`
            : view.status === "unverified"
              ? "Verify your email to join a weekly league. Cases you play this week will count."
              : "Create a free account to compete in weekly leagues."}
        </p>
      ) : (
        <div className="animate-enter">
          {nudge && (
            <p className={cn("mt-2 text-[13px] leading-5 font-medium", NUDGE_CLS[nudge.tone])}>
              {nudge.headline}
              {nudge.detail && <span className="block font-normal text-fg-2">{nudge.detail}</span>}
            </p>
          )}
          <ol className="mt-3 flex flex-col gap-0.5">
            {top.map((r) => (
              <MiniRow key={r.userId} r={r} me={r.userId === meId} />
            ))}
            {mine && mine.position > 3 && (
              <>
                <li aria-hidden className="py-0.5 text-center text-[11px] leading-none text-fg-3">
                  ···
                </li>
                <MiniRow r={mine} me />
              </>
            )}
          </ol>
        </div>
      )}

      <Link href="/leaderboard" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text hover:underline">
        {view?.status === "joined" ? "Open your league" : "See the leaderboard"} <Icon name="arrow-right" size={13} />
      </Link>
    </section>
  );
}
