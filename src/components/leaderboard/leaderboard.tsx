"use client";

import Link from "next/link";
import { useEffect, useRef, useState, ViewTransition } from "react";

import { ResendVerification } from "@/components/auth/verify-banner";
import { DoctorFigure } from "@/components/game/caricature";
import { Confetti } from "@/components/debrief/confetti";
import { Flame } from "@/components/game/streak";
import { fetchBoard, type Board, type LeaderRow } from "@/components/home/week-board";
import { UpgradeSheet } from "@/components/home/upgrade-sheet";
import { useLauncher } from "@/components/home/use-launcher";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { xp } from "@/lib/format";
import { league, LEAGUES, TOP_TIER } from "@/lib/leagues";
import type { Me } from "@/lib/me-store";

import { LeagueBadge } from "./league-badge";
import { nudgeFor, useCountdown, useLeague, type LeagueRow as LRow, type LeagueView } from "./league-data";

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                 */
/* -------------------------------------------------------------------------- */

function DemoChip() {
  return <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px] font-medium tracking-[0.04em] text-fg-3 uppercase">Demo</span>;
}

function Movement({ value }: { value: number | null }) {
  if (value === null) return <span className="w-7 text-center text-[9.5px] font-bold tracking-[0.06em] text-accent-text">NEW</span>;
  if (value === 0) return <span className="w-7 text-center text-[12px] text-fg-3">–</span>;
  const up = value > 0;
  return (
    <span className={cn("flex w-7 items-center justify-center gap-px text-[11.5px] font-semibold tabular", up ? "text-success" : "text-danger")} title={`${up ? "Up" : "Down"} ${Math.abs(value)} in the last 24 hours`}>
      <Icon name={up ? "chevron-up" : "chevron-down"} size={12} strokeWidth={2.6} />
      {Math.abs(value)}
    </span>
  );
}

const PODIUM = [
  { place: 2, height: "h-[88px]", tone: "from-slate-300 to-slate-500", ring: "ring-slate-300", size: 60 },
  { place: 1, height: "h-[120px]", tone: "from-amber-300 to-amber-600", ring: "ring-amber-300", size: 76 },
  { place: 3, height: "h-[68px]", tone: "from-orange-300 to-orange-700", ring: "ring-orange-300", size: 56 },
];

interface PodiumEntry {
  userId: string;
  name: string;
  xp: number;
  rankTier: number;
  demo: boolean;
}

function Podium({ rows, meId }: { rows: PodiumEntry[]; meId: string }) {
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Top three">
      {PODIUM.map((slot, i) => {
        const r = rows[slot.place - 1];
        return (
          <div key={slot.place} className="flex min-w-0 animate-rise flex-col items-center" style={{ animationDelay: `${80 + i * 90}ms` }}>
            {r ? (
              <ViewTransition name={`podium-${r.userId}`} default="none" update="lb-move">
                <div className="flex min-w-0 flex-col items-center">
                  <div className="relative">
                    <DoctorFigure tier={r.rankTier} seed={r.userId} size={slot.size} title={r.name} className={cn("rounded-full ring-4", slot.ring)} />
                    {slot.place === 1 && <Icon name="crown" size={24} className="absolute -top-5 left-1/2 -translate-x-1/2 animate-[bob_3s_ease-in-out_infinite] text-amber-400" />}
                  </div>
                  <div className="mt-2 flex max-w-full items-center gap-1 px-1">
                    <span className="truncate text-[13.5px] font-semibold">{r.userId === meId ? "You" : r.name}</span>
                    {r.demo && <DemoChip />}
                  </div>
                  <div className="text-[12px] text-fg-2 tabular">{xp(r.xp)} XP</div>
                </div>
              </ViewTransition>
            ) : (
              <div className="h-[96px]" />
            )}
            <div className={cn("relative mt-3 flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-3 text-[22px] font-bold text-white shadow-md", slot.height, slot.tone)}>
              <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-gradient-to-b from-white/30 to-transparent" />
              <span className="relative">{slot.place}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* League                                                                      */
/* -------------------------------------------------------------------------- */

function Ladder({ tier }: { tier: number }) {
  return (
    <ol className="flex items-center" aria-label="Leagues">
      {LEAGUES.map((l, i) => (
        <li key={l.id} className="flex min-w-0 flex-1 items-center last:flex-none">
          <span className={cn("flex flex-col items-center gap-1", i === tier && "scale-110")} title={`${l.label} League`}>
            <LeagueBadge tier={i} size={i === tier ? 30 : 22} locked={i > tier} className={cn("transition-transform", i === tier && "drop-shadow-[0_4px_12px_rgb(255_255_255/0.25)]")} />
            <span className={cn("hidden text-[10.5px] sm:block", i === tier ? "font-semibold text-white" : i < tier ? "text-white/70" : "text-white/35")}>{l.label}</span>
          </span>
          {i < LEAGUES.length - 1 && <span aria-hidden className={cn("mx-1 h-px flex-1 sm:mx-2", i < tier ? "bg-white/50" : "bg-white/15")} />}
        </li>
      ))}
    </ol>
  );
}

const NUDGE_TONE = {
  lead: { icon: "crown", cls: "text-amber-300" },
  safe: { icon: "trending-up", cls: "text-emerald-300" },
  up: { icon: "target", cls: "text-cyan-300" },
  danger: { icon: "alert", cls: "text-rose-300" },
} as const;

function LeagueHero({ view, meId, me, onPlay, starting }: { view: LeagueView; meId: string; me: Me; onPlay: () => void; starting: boolean }) {
  const countdown = useCountdown(view.weekEnd);
  const l = league(view.tier);
  const mine = view.rows.find((r) => r.userId === meId);
  const nudge = nudgeFor(view, meId);
  const rules = view.status === "joined" ? zoneRule(view) : `Top players move up to ${view.tier >= TOP_TIER ? "stay in Diamond" : league(view.tier + 1).label} each week`;

  return (
    <section className="ink relative isolate animate-rise overflow-hidden rounded-[22px] p-5 sm:p-7" aria-label={`${l.label} League`}>
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 -z-10 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: `radial-gradient(circle, ${l.accent}, transparent 70%)` }} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <LeagueBadge tier={view.tier} size={68} className="animate-pop drop-shadow-[0_10px_24px_rgb(0_0_0/0.35)]" />
          <div>
            <div className="text-[12px] font-medium tracking-[0.12em] text-white/55 uppercase">This week</div>
            <div className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">{l.label} League</div>
            <div className="mt-0.5 text-[13px] text-white/60">{rules}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-[12.5px] font-medium text-white/80 ring-1 ring-white/10" title="Leagues reset every Monday at 00:00 IST">
          <Icon name="clock" size={14} /> {countdown} left
        </div>
      </div>

      {view.status === "joined" && mine && (
        <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="text-[12px] text-white/55">Your place</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[40px] leading-none font-semibold tracking-[-0.03em] tabular">#{mine.position}</span>
              <span className="text-[13px] text-white/55 tabular">of {view.rows.length}</span>
            </div>
          </div>
          <div>
            <div className="text-[12px] text-white/55">XP this week</div>
            <div className="text-[24px] leading-none font-semibold tracking-[-0.02em] tabular">{xp(mine.xp)}</div>
          </div>
          {mine.movement !== null && mine.movement !== 0 && (
            <div className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-semibold", mine.movement > 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300")}>
              <Icon name={mine.movement > 0 ? "chevron-up" : "chevron-down"} size={13} strokeWidth={2.6} />
              {Math.abs(mine.movement)} today
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {nudge ? (
            <>
              <Icon name={NUDGE_TONE[nudge.tone].icon} size={18} className={cn("mt-0.5 shrink-0", NUDGE_TONE[nudge.tone].cls)} />
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold">{nudge.headline}</div>
                {nudge.detail && <div className="mt-0.5 text-[13px] leading-5 text-white/65">{nudge.detail}</div>}
              </div>
            </>
          ) : view.status === "waiting" ? (
            <>
              <Icon name="target" size={18} className="mt-0.5 shrink-0 text-cyan-300" />
              <div>
                <div className="text-[14.5px] font-semibold">Finish a case to join this week&apos;s {l.label} League</div>
                <div className="mt-0.5 text-[13px] leading-5 text-white/65">You&apos;ll be grouped with up to 30 doctors. Every case&apos;s XP counts.</div>
              </div>
            </>
          ) : view.status === "unverified" ? (
            <>
              <Icon name="mail" size={18} className="mt-0.5 shrink-0 text-cyan-300" />
              <div>
                <div className="text-[14.5px] font-semibold">Verify your email to join a league</div>
                <div className="mt-0.5 text-[13px] leading-5 text-white/65">We sent a link to {me.user.email}. Cases you&apos;ve already played this week will count.</div>
              </div>
            </>
          ) : (
            <>
              <Icon name="user" size={18} className="mt-0.5 shrink-0 text-cyan-300" />
              <div>
                <div className="text-[14.5px] font-semibold">Create a free account to compete</div>
                <div className="mt-0.5 text-[13px] leading-5 text-white/65">Leagues, streaks and ranks are for signed-up doctors. It takes 30 seconds.</div>
              </div>
            </>
          )}
        </div>
        {view.status === "unverified" ? (
          <ResendVerification compact />
        ) : view.status === "guest" ? (
          <Link href="/signup" className="bg-ai inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold text-white shadow-glow">
            Create account <Icon name="arrow-right" size={14} />
          </Link>
        ) : (
          <button type="button" onClick={onPlay} disabled={starting} className="shine inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold text-white shadow-glow disabled:opacity-70">
            {starting ? "Preparing…" : "Play a case"} {!starting && <Icon name="arrow-right" size={14} />}
          </button>
        )}
      </div>

      <div className="mt-6">
        <Ladder tier={view.tier} />
      </div>
    </section>
  );
}

function zoneRule(view: LeagueView): string {
  const up = view.promote > 0 ? `Top ${view.promote} move up to ${league(view.tier + 1).label}` : view.tier >= TOP_TIER ? "The top league" : "";
  const down = view.demote > 0 ? `bottom ${view.demote} move down` : "";
  return [up, down].filter(Boolean).join(" · ") || "Play cases to climb";
}

const SEEN_KEY = "ramai.league.seen";

function LastWeek({ result }: { result: NonNullable<LeagueView["lastWeek"]> }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(SEEN_KEY) !== String(result.week));
    } catch {
      setOpen(true);
    }
  }, [result.week]);
  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, String(result.week));
    } catch {}
  };
  const from = league(result.tier).label;
  const to = league(result.nextTier).label;
  const promoted = result.outcome === "promoted";
  return (
    <section className={cn("relative flex animate-pop items-center gap-4 overflow-hidden rounded-2xl border px-5 py-4", promoted ? "border-emerald-400/30 bg-success-soft" : result.outcome === "demoted" ? "border-amber-400/30 bg-warning-soft" : "border-line bg-surface")} role="status">
      {promoted && <Confetti seed={result.week % 997} />}
      <LeagueBadge tier={result.nextTier} size={44} className={promoted ? "animate-[bob_3s_ease-in-out_infinite]" : undefined} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">{promoted ? `Promoted to ${to}!` : result.outcome === "demoted" ? `Moved down to ${to}` : `Staying in ${to}`}</div>
        <div className="text-[13px] text-fg-2">
          You finished #{result.rank} in {from} last week.{result.outcome === "demoted" ? " Climb back this week." : promoted ? " New rivals await." : ""}
        </div>
      </div>
      <button type="button" onClick={close} aria-label="Dismiss" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg">
        <Icon name="x" size={14} />
      </button>
    </section>
  );
}

function ZoneDivider({ kind, label }: { kind: "up" | "down"; label: string }) {
  return (
    <li aria-hidden className={cn("flex items-center gap-2 px-4 py-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase sm:px-5", kind === "up" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
      <Icon name={kind === "up" ? "chevron-up" : "chevron-down"} size={13} strokeWidth={2.6} />
      {label}
    </li>
  );
}

function LeagueRowItem({ r, me, zone, index }: { r: LRow; me: boolean; zone: "up" | "down" | null; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (!me || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [me]);
  return (
    <ViewTransition name={`lb-${r.userId}`} default="none" update="lb-move">
      <li
        ref={ref}
        className={cn("flex animate-enter items-center gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-5", me ? "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]" : zone === "up" ? "bg-[color-mix(in_srgb,var(--success)_5%,transparent)]" : zone === "down" ? "bg-[color-mix(in_srgb,var(--danger)_5%,transparent)]" : "")}
        style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
      >
        <span className={cn("w-6 text-center text-[14px] font-semibold tabular", zone === "up" ? "text-success" : zone === "down" ? "text-danger" : "text-fg-3")}>{r.position}</span>
        <Movement value={r.movement} />
        <DoctorFigure tier={r.rankTier} seed={r.userId} size={38} title={r.name} className="rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold">{me ? `${r.name} (you)` : r.name}</span>
            {r.demo && <DemoChip />}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
            <span className="truncate">{r.rankLabel}</span>
            <span className="text-fg-3">·</span>
            <span className="tabular">
              {r.cases} case{r.cases === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {r.streak >= 2 && (
          <span className="hidden items-center gap-0.5 text-[12px] font-semibold text-flame tabular sm:flex" title={`${r.streak}-day streak`}>
            <Flame active size={15} /> {r.streak}
          </span>
        )}
        <span className="w-16 text-right text-[14px] font-semibold tabular">
          {xp(r.xp)} <span className="text-[11px] font-medium text-fg-3">XP</span>
        </span>
      </li>
    </ViewTransition>
  );
}

function LeagueTable({ view, meId }: { view: LeagueView; meId: string }) {
  const rows = view.rows;
  const size = rows.length;
  const zoneOf = (position: number): "up" | "down" | null => (position <= view.promote ? "up" : view.demote > 0 && position > size - view.demote ? "down" : null);
  const rest = rows.slice(3);
  const next = league(view.tier + 1).label;
  const items: React.ReactNode[] = [];
  rest.forEach((r, i) => {
    if (view.demote > 0 && r.position === size - view.demote + 1) items.push(<ZoneDivider key="down" kind="down" label={`Demotion zone · bottom ${view.demote} move down`} />);
    items.push(<LeagueRowItem key={r.userId} r={r} me={r.userId === meId} zone={zoneOf(r.position)} index={i} />);
    if (view.promote > 3 && r.position === view.promote && r.position < size) items.push(<ZoneDivider key="up" kind="up" label={`Promotion zone · top ${view.promote} move up to ${next}`} />);
  });
  return (
    <section className="panel overflow-hidden" aria-label="League table">
      <div className="border-b border-line-2 bg-surface-2 px-4 pt-9 sm:px-10">
        <Podium rows={rows.slice(0, 3)} meId={meId} />
      </div>
      {view.promote > 0 && view.promote <= 3 && rest.length > 0 && (
        <ol>
          <ZoneDivider kind="up" label={`Top ${view.promote} move up to ${next}`} />
        </ol>
      )}
      {items.length > 0 && <ol className="divide-y divide-line-2">{items}</ol>}
    </section>
  );
}

function LeagueSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="ink h-[300px] animate-breathe rounded-[22px]" />
      <div className="panel flex flex-col gap-2 p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 animate-breathe rounded-xl bg-surface-3" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
}

function LeagueTab({ me }: { me: Me }) {
  const { view } = useLeague();
  const { launch, starting, gate, closeGate, error } = useLauncher();
  if (view === undefined) return <LeagueSkeleton />;
  if (view === null) {
    return <p className="panel px-5 py-8 text-center text-[14px] text-fg-2">The league couldn&apos;t load. Check your connection and try again.</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {view.lastWeek && <LastWeek result={view.lastWeek} />}
      <LeagueHero view={view} meId={me.user.id} me={me} onPlay={() => void launch({})} starting={starting} />
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      {view.status === "joined" && <LeagueTable view={view} meId={me.user.id} />}
      <UpgradeSheet gate={gate} onClose={closeGate} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* All time                                                                    */
/* -------------------------------------------------------------------------- */

const BOARDS = [
  { id: "overall", label: "Overall" },
  { id: "opd", label: "OPD" },
  { id: "emergency", label: "Emergency" },
  { id: "phone", label: "Phone" },
  { id: "hard", label: "Hard cases" },
] as const;

type BoardId = (typeof BOARDS)[number]["id"];

function GlobalRow({ r, me, index }: { r: LeaderRow; me: boolean; index: number }) {
  return (
    <li className={cn("flex animate-enter items-center gap-3 px-4 py-3 sm:px-5", me && "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]")} style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
      <span className="w-7 text-center text-[14px] font-semibold text-fg-3 tabular">{r.position}</span>
      <DoctorFigure tier={r.rankTier} seed={r.userId} size={38} title={r.name} className="rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold">{me ? `${r.name} (you)` : r.name}</span>
          {r.demo && <DemoChip />}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <span className="truncate">{r.rankLabel}</span>
          <span className="text-fg-3">·</span>
          <span className="tabular">
            {r.cases} case{r.cases === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <span className="text-[14px] font-semibold tabular">
        {xp(r.xp)} <span className="text-[11px] font-medium text-fg-3">XP</span>
      </span>
    </li>
  );
}

function GlobalTab({ meId, isPro }: { meId: string; isPro: boolean }) {
  const [board, setBoard] = useState<BoardId>("overall");
  const [data, setData] = useState<Board | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setData(undefined);
    void fetchBoard(board, "all").then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [board]);

  const rows = data?.rows ?? [];
  const rest = rows.slice(3);
  const meOutside = data?.me && !rows.some((r) => r.userId === meId);

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Board" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={board === b.id}
            onClick={() => setBoard(b.id)}
            className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-medium transition-colors", board === b.id ? "border-transparent bg-accent text-on-accent shadow-sm" : "border-line bg-surface text-fg-2 hover:text-fg")}
          >
            {b.label}
            {b.id === "hard" && !isPro && <Icon name="lock" size={12} />}
          </button>
        ))}
      </div>

      <section className="panel overflow-hidden" aria-live="polite" aria-busy={data === undefined}>
        {data === undefined ? (
          <div className="flex flex-col gap-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-breathe rounded-xl bg-surface-3" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-fg-3">
              <Icon name="trophy" size={22} />
            </span>
            <p className="mt-4 text-[15px] font-semibold">No scores here yet</p>
            <p className="mt-1 max-w-xs text-[13.5px] text-fg-2">{board === "hard" ? "Hard cases are Medical College, Apex Institute and Grand Rounds." : "Finish a case to take first place."}</p>
          </div>
        ) : (
          <>
            <div className="border-b border-line-2 bg-surface-2 px-4 pt-9 sm:px-10">
              <Podium rows={rows.slice(0, 3)} meId={meId} />
            </div>
            {rest.length > 0 && (
              <ol className="divide-y divide-line-2">
                {rest.map((r, i) => (
                  <GlobalRow key={r.userId} r={r} me={r.userId === meId} index={i} />
                ))}
              </ol>
            )}
          </>
        )}
        {meOutside && data?.me && (
          <ol className="border-t border-line">
            <GlobalRow r={data.me} me index={0} />
          </ol>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Leaderboard({ me }: { me: Me }) {
  const [tab, setTab] = useState<"league" | "all">("league");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.03em]">Leaderboard</h1>
          <p className="mt-1 text-[14px] text-fg-2">{tab === "league" ? "Weekly leagues reset every Monday at 00:00 IST." : "All-time XP across RamAI."}</p>
        </div>
        <div role="radiogroup" aria-label="View" className="inline-flex self-start rounded-full border border-line bg-surface p-1 shadow-sm sm:self-auto">
          {(["league", "all"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tab === t} onClick={() => setTab(t)} className={cn("h-8 rounded-full px-4 text-[13px] font-medium transition-colors", tab === t ? "bg-fg text-bg" : "text-fg-2 hover:text-fg")}>
              {t === "league" ? "My league" : "All time"}
            </button>
          ))}
        </div>
      </div>
      {tab === "league" ? <LeagueTab me={me} /> : <GlobalTab meId={me.user.id} isPro={me.user.plan === "pro"} />}
    </div>
  );
}
