"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCountdown } from "@/components/leaderboard/league-data";
import { Icon } from "@/components/ui/icon";
import { levelMeta, trackLabel } from "@/engine/levels";
import { useCase } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { shareFromGrid, shareResult } from "@/lib/daily";
import { fetchDaily, type DailyInfo } from "@/lib/engine-client";
import { useMe } from "@/lib/me-store";

/** Today's case for everyone: play it once, ranked, then share the result. */
export function DailyCard({ onPlay, starting }: { onPlay: () => void; starting: boolean }) {
  const me = useMe();
  const snap = useCase();
  const [info, setInfo] = useState<DailyInfo | null | undefined>(undefined);
  const [shared, setShared] = useState<string | null>(null);
  const countdown = useCountdown(info?.endsAt);

  useEffect(() => {
    let live = true;
    const load = () => void fetchDaily().then((d) => live && setInfo(d));
    load();
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  if (info === null) return null;
  const country = me?.user.country ?? "IN";
  const resume = info && snap.session && !snap.session.debrief && snap.session.state.daily === info.dayKey;
  const done = info?.me;

  const share = async () => {
    if (!info?.me?.grid) return;
    const how = await shareResult(shareFromGrid({ number: info.number, score: info.me.score, grid: info.me.grid, minutes: info.me.minutes, url: window.location.origin }));
    setShared(how === "copied" ? "Copied — paste it anywhere" : how === "shared" ? "Shared" : null);
  };

  return (
    <section className="panel overflow-hidden p-5" aria-labelledby="daily-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="daily-heading" className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="bg-flame flex h-7 w-7 items-center justify-center rounded-lg text-white">
            <Icon name="calendar" size={15} />
          </span>
          {info ? `Daily case #${info.number}` : "Daily case"}
        </h2>
        {info && (
          <span className="flex items-center gap-1 text-[12px] text-fg-3 tabular" title="A new case unlocks at midnight IST">
            <Icon name="clock" size={12} /> New in {countdown}
          </span>
        )}
      </div>

      {info === undefined ? (
        <div className="mt-4 h-20 animate-breathe rounded-xl bg-surface-3" aria-busy="true" />
      ) : done ? (
        <div className="mt-3 animate-enter">
          <p className="text-[14px] leading-6">
            You scored <b className="tabular">{done.score}</b> — <b className="tabular">#{done.position}</b> of {info.total} today.
          </p>
          {done.grid && <pre className="mt-2 font-sans text-[18px] leading-6 tracking-[2px]">{done.grid}</pre>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void share()} className="bg-ai inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white shadow-glow">
              <Icon name="send" size={14} /> Share result
            </button>
            {shared && <span className="text-[12.5px] font-medium text-success">{shared}</span>}
          </div>
        </div>
      ) : (
        <div className="mt-3 animate-enter">
          <p className="text-[13.5px] leading-6 text-fg-2">Everyone gets the same patient today. Your first attempt is ranked — free, whatever your plan.</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
            <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-fg-2">{trackLabel(info.track, country)}</span>
            <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-fg-2">{levelMeta(info.level, country).label}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {resume ? (
              <Link href="/case" className="shine inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white shadow-glow">
                Resume today&apos;s case <Icon name="arrow-right" size={15} />
              </Link>
            ) : (
              <button type="button" onClick={onPlay} disabled={starting || me?.user.isGuest} className="shine inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white shadow-glow disabled:opacity-60">
                {starting ? "Preparing…" : info.started ? "Play again (practice)" : "Play today's case"}
                {!starting && <Icon name="arrow-right" size={15} />}
              </button>
            )}
            <span className="text-[12.5px] text-fg-3">
              {me?.user.isGuest ? "Create a free account to play" : info.total ? `${info.total} played so far` : "Be the first today"}
            </span>
          </div>
          {info.started && !resume && <p className="mt-2 text-[12px] text-fg-3">Only your first attempt counts for today&apos;s ranking.</p>}
        </div>
      )}

      {info && info.top.length > 0 && (
        <ol className="mt-4 flex flex-col gap-0.5 border-t border-line-2 pt-3">
          {info.top.slice(0, 3).map((r) => (
            <li key={r.userId} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1 text-[13px]", r.userId === me?.user.id && "bg-accent-soft")}>
              <span className={cn("w-5 text-center font-semibold tabular", r.position === 1 ? "text-flame" : "text-fg-3")}>{r.position}</span>
              <span className="min-w-0 flex-1 truncate">{r.userId === me?.user.id ? "You" : r.name}</span>
              <span className="text-fg-2 tabular">{r.score}</span>
              <span className="w-12 text-right text-[11.5px] text-fg-3 tabular">{r.minutes} min</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
