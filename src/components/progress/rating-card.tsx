"use client";

import { useEffect, useState } from "react";

import { useMe } from "@/lib/me-store";

/** The rating's path as a small line, with no chart library. */
export function RatingLine({ points, className }: { points: readonly number[]; className?: string }) {
  if (points.length < 2) return null;
  const lo = Math.min(...points), hi = Math.max(...points);
  const span = Math.max(20, hi - lo);
  const tipY = 26 - ((points.at(-1)! - lo) / span) * 24;
  const line = points.map((p, i) => `${((i / (points.length - 1)) * 100).toFixed(2)},${(26 - ((p - lo) / span) * 24).toFixed(2)}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={className} role="img" aria-label={`Rating over the last ${points.length} rated cases, from ${points[0]} to ${points.at(-1)}`}>
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="draw-in text-sky-500" />
      <circle cx={100} cy={tipY} r="1.6" fill="currentColor" className="animate-fade" style={{ animationDelay: "0.85s" }} />
    </svg>
  );
}

/** Rating, its path, the doctor's place among others, and where they're strongest and weakest. */
export function RatingCard() {
  const me = useMe();
  const [standing, setStanding] = useState<{ top: number | null; doctors: number } | null>(null);
  useEffect(() => {
    fetch("/api/progress/rating", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setStanding).catch(() => undefined);
  }, []);
  const p = me?.progress;
  if (!p) return null;
  const played = p.mastery.filter((m) => m.cases > 0).sort((a, b) => b.percent - a.percent);
  const strongest = played.slice(0, 3);
  const weakest = played.length > 3 ? played.at(-1) : undefined;
  // A percentile among a handful of doctors would mean nothing.
  const top = standing?.top !== null && standing && standing.doctors >= 10 ? `Top ${standing.top}%` : "—";
  return (
    <section className="panel p-4 sm:p-5" aria-label="Clinical rating">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Clinical rating</h2>
        {p.provisional && <span className="text-[12px] text-fg-2">Provisional · {p.ratedCases ?? 0} of 5 placement cases</span>}
      </div>
      <div className="mt-2 text-[30px] leading-none font-semibold tabular">{p.rating}</div>
      {(p.ratingPoints?.length ?? 0) > 1 ? <RatingLine points={p.ratingPoints!} className="mt-3 h-16 w-full" /> : <p className="mt-3 text-[12.5px] text-fg-2">Your graph starts with your first rated case.</p>}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
        <div><dt className="text-fg-2">Peak</dt><dd className="font-semibold tabular">{p.peakRating ?? p.rating}</dd></div>
        <div><dt className="text-fg-2">Standing</dt><dd className="font-semibold tabular">{top}</dd></div>
        <div><dt className="text-fg-2">Streak</dt><dd className="font-semibold tabular">{p.streakDays} day{p.streakDays === 1 ? "" : "s"}</dd></div>
        <div><dt className="text-fg-2">Recent form</dt><dd className="font-semibold tabular">{Math.round(p.percent)}%</dd></div>
      </dl>
      {strongest.length > 0 && (
        <p className="mt-3 text-[13px] text-fg-2">
          <span className="font-semibold text-fg">Strongest:</span> {strongest.map((m) => `${m.specialty} ${m.percent}%`).join(", ")}
          {weakest && <><br /><span className="font-semibold text-fg">Needs practice:</span> {weakest.specialty} {weakest.percent}%</>}
        </p>
      )}
    </section>
  );
}
