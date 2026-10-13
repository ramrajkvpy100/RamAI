"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { RankBadge } from "@/components/game/rank-badge";
import { useLauncher } from "@/components/home/use-launcher";
import { ShareSheet } from "@/components/share/share-sheet";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { REPORT_MIN_CASES, type PersonalReport, type ProgressDetail } from "@/lib/progress-types";

import { ActivityGrid, ScoreTrend, SkillBars } from "./charts";

/** "Start a surgery emergency case", "Start an emergency case" — grammatical, never "Emergency emergency". */
function startLabel(specialty?: string, track?: string) {
  const mode = track === "emergency" ? "emergency" : track === "phone" ? "phone" : track === "opd" ? "clinic" : "";
  const words = [specialty, specialty?.toLowerCase() === mode ? "" : mode].filter(Boolean).join(" ");
  return `Start ${/^[aeiou]/i.test(words) ? "an" : "a"} ${words} case`;
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="panel flex flex-col gap-1 p-4">
      <span className="text-[12px] text-fg-2">{label}</span>
      <span className="text-[24px] leading-none font-semibold tracking-[-0.02em] tabular">{value}</span>
      {sub && <span className={cn("text-[12px]", tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-fg-3")}>{sub}</span>}
    </div>
  );
}

function Panel({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("panel p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The AI's report on your cases: what you keep missing, what you're good at, and what to do next. */
function ReportPanel({ detail, initial }: { detail: ProgressDetail; initial: PersonalReport | null }) {
  const [report, setReport] = useState(initial);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { launch, starting } = useLauncher();
  const enough = detail.cases >= REPORT_MIN_CASES;
  const stale = enough && (!report || report.cases < detail.cases);

  const write = async () => {
    setWriting(true);
    setError(null);
    try {
      const res = await fetch("/api/progress/report", { method: "POST" });
      const json = (await res.json().catch(() => null)) as { report?: PersonalReport | null; error?: { message?: string } } | null;
      if (!res.ok) throw new Error(json?.error?.message ?? "The report couldn't be written just now.");
      if (json?.report) setReport(json.report);
      else setError("The report couldn't be written just now. Please try again in a minute.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The report couldn't be written just now.");
    } finally {
      setWriting(false);
    }
  };
  // A new case since the last report: rewrite it as the page opens.
  useEffect(() => {
    if (stale) void write();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, []);

  if (!enough) {
    return (
      <section className="ink relative isolate overflow-hidden rounded-[22px] p-6 sm:p-7">
        <p className="text-[12.5px] font-medium tracking-[0.08em] text-cyan-300/90 uppercase">Your personal report</p>
        <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Unlocks after {REPORT_MIN_CASES} cases</h2>
        <p className="mt-2 max-w-lg text-[14px] leading-6 text-white/65">The AI reads your cases and tells you what you keep missing, what you&apos;re good at, and exactly what to practise next.</p>
        <div className="mt-4 flex gap-1.5" aria-label={`${detail.cases} of ${REPORT_MIN_CASES} cases`}>
          {Array.from({ length: REPORT_MIN_CASES }, (_, i) => (
            <span key={i} className={cn("h-1.5 w-10 rounded-full", i < detail.cases ? "bg-ai" : "bg-white/15")} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="ink relative isolate overflow-hidden rounded-[22px] p-6 sm:p-7" aria-labelledby="report-heading">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgb(124_58_237/0.45),transparent_65%)] blur-2xl" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium tracking-[0.08em] text-cyan-300/90 uppercase">Your personal report</p>
        <span className="text-[11.5px] text-white/50">
          {writing ? "Writing…" : report ? `Written by AI from ${report.cases} cases` : ""}
          {report && !writing && (
            <button type="button" onClick={() => void write()} className="ml-2 font-semibold text-white/80 underline-offset-2 hover:underline">
              Refresh
            </button>
          )}
        </span>
      </div>
      {writing && !report ? (
        <div className="mt-4 flex items-center gap-3 text-[14.5px] text-white/75" role="status">
          <span className="bg-ai flex h-8 w-8 animate-pulse items-center justify-center rounded-lg text-white">
            <Icon name="sparkles" size={15} />
          </span>
          Reading your cases and writing your report…
        </div>
      ) : report ? (
        <div className={cn("transition-opacity", writing && "opacity-60")}>
          <h2 id="report-heading" className="mt-2 text-[22px] leading-snug font-semibold tracking-[-0.02em] text-balance sm:text-[26px]">
            {report.headline}
          </h2>
          <p className="mt-3 max-w-3xl text-[14.5px] leading-7 text-white/70">{report.progress}</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {report.repeatedMistakes.length > 0 && (
              <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <h3 className="flex items-center gap-2 text-[14px] font-semibold text-rose-300">
                  <Icon name="refresh" size={14} /> Mistakes you keep making
                </h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {report.repeatedMistakes.map((m) => (
                    <li key={m.pattern} className="text-[14px] leading-6">
                      <div className="font-medium text-white">{m.pattern}</div>
                      <div className="text-[12.5px] text-white/50">{m.evidence}</div>
                      <div className="mt-1 flex items-start gap-1.5 text-white/80">
                        <Icon name="arrow-right" size={13} className="mt-1.5 shrink-0 text-cyan-300" />
                        {m.fix}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-4">
              {report.strengths.length > 0 && (
                <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-emerald-300">
                    <Icon name="check" size={14} /> What you&apos;re good at
                  </h3>
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {report.strengths.map((s) => (
                      <li key={s} className="text-[14px] leading-6 text-white/80">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.weakAreas.length > 0 && (
                <div className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-amber-300">
                    <Icon name="target" size={14} /> Weak areas
                  </h3>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {report.weakAreas.map((w) => (
                      <li key={w.area} className="text-[14px] leading-6">
                        <span className="font-medium text-white">{w.area}</span> <span className="text-white/65">— {w.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {report.recommendations.length > 0 && (
            <div className="mt-5">
              <h3 className="text-[14px] font-semibold text-white">What to do next</h3>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {report.recommendations.map((r) => (
                  <li key={r.action} className="flex flex-col gap-2 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                    <span className="text-[14px] leading-6 font-medium text-white">{r.action}</span>
                    <span className="text-[13px] leading-5 text-white/60">{r.why}</span>
                    {(r.specialty || r.track) && (
                      <button
                        type="button"
                        disabled={starting}
                        onClick={() => void launch({ ...(r.specialty ? { specialty: r.specialty } : {}), ...(r.track ? { track: r.track } : {}) })}
                        className="mt-1 inline-flex h-9 items-center gap-1.5 self-start rounded-full bg-white px-4 text-[13px] font-semibold text-[#0b1220] hover:bg-white/90 disabled:opacity-60"
                      >
                        {starting ? "Starting…" : startLabel(r.specialty, r.track)}
                        <Icon name="arrow-right" size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-[11.5px] text-white/40">Written by AI ({report.model}) from your recorded cases. It can make mistakes; your scores come from RamAI&apos;s marking rules.</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-3">
          <p className="text-[14px] text-white/70">{error ?? "Your report is ready to be written."}</p>
          <button type="button" onClick={() => void write()} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-[#0b1220]">
            <Icon name="sparkles" size={14} /> Write my report
          </button>
        </div>
      )}
      {error && report && <p className="mt-3 text-[12.5px] text-amber-300">{error}</p>}
    </section>
  );
}

export function ProgressView({ detail, report }: { detail: ProgressDetail; report: PersonalReport | null }) {
  const [sharing, setSharing] = useState(false);
  const delta = detail.average.recent !== null && detail.average.earlier !== null ? detail.average.recent - detail.average.earlier : null;
  const accuracy = detail.mcq.answered ? Math.round((detail.mcq.correct / detail.mcq.answered) * 100) : null;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <RankBadge tier={detail.rankTier} size={40} />
          <div>
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">Your progress</h1>
            <p className="text-[13.5px] text-fg-2">
              {detail.rank} · {detail.cases} {detail.cases === 1 ? "case" : "cases"}
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setSharing(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-[13.5px] font-semibold ring-1 ring-line hover:bg-surface-3">
          <Icon name="share-ios" size={15} /> Share my progress
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Average score" value={detail.average.recent !== null ? `${detail.average.recent}` : "—"} sub={delta !== null ? `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} on the ten before` : "last 10 cases"} tone={delta === null ? undefined : delta >= 0 ? "up" : "down"} />
        <Tile label="Cases" value={`${detail.cases}`} sub={`${detail.xp.toLocaleString("en-IN")} XP`} />
        <Tile label="Streak" value={`${detail.streak} ${detail.streak === 1 ? "day" : "days"}`} sub={`best ${detail.bestStreak}`} />
        <Tile label="Practice questions" value={accuracy !== null ? `${accuracy}%` : "—"} sub={detail.mcq.answered ? `${detail.mcq.correct} of ${detail.mcq.answered} right` : "answer them after each case"} />
      </div>

      <ReportPanel detail={detail} initial={report} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Score trend" aside={<span className="text-[12px] text-fg-3">last {detail.trend.length} cases</span>}>
          <ScoreTrend trend={detail.trend} />
        </Panel>
        <Panel title="Skills" aside={<span className="text-[12px] text-fg-3">weakest first</span>}>
          <SkillBars skills={detail.skills} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Specialties">
          {detail.specialties.length ? (
            <ul className="flex flex-col gap-2.5">
              {detail.specialties.slice(0, 8).map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="text-fg-2 tabular">
                    {s.cases} · avg {s.average}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-fg-2">Play a case to see your specialties.</p>
          )}
        </Panel>
        <Panel title="Practice">
          <ActivityGrid activity={detail.activity} />
        </Panel>
        <Panel title="Question topics to revise">
          {detail.mcq.weakTopics.length ? (
            <ul className="flex flex-col gap-2.5">
              {detail.mcq.weakTopics.map((t) => (
                <li key={t.topic} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="truncate">{t.topic}</span>
                  <span className={cn("tabular", t.correct / t.answered < 0.5 ? "text-danger" : "text-fg-2")}>
                    {t.correct}/{t.answered}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] leading-6 text-fg-2">
              Answer the exam questions after your cases — topics you get wrong show up here. <Link href="/" className="font-medium text-accent-text hover:underline">Play a case</Link>
            </p>
          )}
        </Panel>
      </div>
      <ShareSheet open={sharing} onClose={() => setSharing(false)} target={{ kind: "progress" }} title="Share your progress" />
    </div>
  );
}
