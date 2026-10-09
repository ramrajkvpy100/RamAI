"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { league, TOP_TIER, type LeagueOutcome } from "@/lib/leagues";

export interface LeagueRow {
  position: number;
  userId: string;
  name: string;
  username: string;
  xp: number;
  cases: number;
  movement: number | null;
  rankTier: number;
  rankLabel: string;
  streak: number;
  demo: boolean;
}

export interface LeagueView {
  status: "joined" | "waiting" | "unverified" | "guest";
  tier: number;
  weekStart: number;
  weekEnd: number;
  rows: LeagueRow[];
  promote: number;
  demote: number;
  lastWeek?: { week: number; tier: number; rank: number; outcome: LeagueOutcome; nextTier: number };
}

async function fetchLeague(): Promise<LeagueView | null> {
  const res = await fetch("/api/leaderboard?view=league", { cache: "no-store" }).catch(() => null);
  return res?.ok ? ((await res.json()) as LeagueView) : null;
}

/** The player's league, refreshed every 30 s while the page is visible — rivals move in real time. */
export function useLeague(): { view: LeagueView | null | undefined; refresh: () => void } {
  const [view, setView] = useState<LeagueView | null | undefined>(undefined);
  const current = useRef<LeagueView | null | undefined>(undefined);
  const refresh = useCallback(() => {
    void fetchLeague().then((next) => {
      const prev = current.current;
      current.current = next;
      // A changed order animates — rows glide to their new places; anything else updates in place.
      const order = (x: LeagueView | null | undefined) => x?.rows.map((r) => r.userId).join() ?? "";
      if (prev && next && order(prev) !== order(next)) startTransition(() => setView(next));
      else setView(next);
    });
  }, []);
  useEffect(() => {
    refresh();
    const id = window.setInterval(() => !document.hidden && refresh(), 30_000);
    const onVisible = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  return { view, refresh };
}

/** "2d 14h", "5h 12m", "9m" until `end`, updated every minute. */
export function useCountdown(end: number | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (!end) return "";
  const left = Math.max(0, end - now);
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}

const first = (name: string) => name.replace(/^dr\.?\s+/i, "").split(/\s+/)[0] ?? name;
const cases = (xp: number) => (xp <= 140 ? "One case could do it." : xp <= 400 ? "A couple of cases." : "A strong day of cases.");

export interface Nudge {
  tone: "up" | "safe" | "danger" | "lead";
  headline: string;
  detail?: string;
}

/** What to aim for right now: the zone you're in, and the next person to pass. */
export function nudgeFor(view: LeagueView, meId: string): Nudge | null {
  if (view.status !== "joined") return null;
  const me = view.rows.find((r) => r.userId === meId);
  if (!me) return null;
  const next = league(view.tier + 1).label;
  const above = view.rows[me.position - 2];
  const below = view.rows[me.position];
  const passLine = above ? `${above.xp - me.xp + 1} XP to pass ${first(above.name)} for #${above.position}. ${cases(above.xp - me.xp + 1)}` : undefined;
  const size = view.rows.length;

  if (view.demote > 0 && me.position > size - view.demote) {
    const safe = view.rows[size - view.demote - 1];
    return { tone: "danger", headline: "You're in the demotion zone", detail: safe ? `${safe.xp - me.xp + 1} XP gets you to safety. ${cases(safe.xp - me.xp + 1)}` : passLine };
  }
  if (me.position === 1) {
    return { tone: "lead", headline: `You're leading the ${league(view.tier).label} League`, detail: below ? `${me.xp - below.xp} XP clear of ${first(below.name)}. Keep it going.` : "Keep it going." };
  }
  if (me.position <= view.promote) {
    return { tone: "safe", headline: view.tier >= TOP_TIER ? "Top of Diamond — hold your place" : `In the promotion zone for ${next}`, detail: passLine };
  }
  if (view.promote > 0) {
    const edge = view.rows[view.promote - 1]!;
    return { tone: "up", headline: `${edge.xp - me.xp + 1} XP to the promotion zone`, detail: passLine };
  }
  return { tone: "up", headline: passLine ?? "Keep going", detail: undefined };
}
