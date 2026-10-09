"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { CaseTopBar } from "@/components/case/case-top-bar";
import { Timeline } from "@/components/case/timeline";
import { Disclosure } from "@/components/ui/disclosure";
import { Icon } from "@/components/ui/icon";
import { Badge, Label } from "@/components/ui/primitives";
import type { CaseDebrief, PlayerProgress } from "@/engine/types";
import type { ActiveSession } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { money, STATUS_LABEL } from "@/lib/format";

import { Bullets } from "./flow";
import { RewardsPanel } from "./rewards";
import { ScoreBreakdown, ScoreRing } from "./score";
import {
  DecisionTreeSection,
  DiagnosisSection,
  DrugsSection,
  FollowUpSection,
  InvestigationsSection,
  MissesSection,
  RescueSection,
  SeveritySection,
  TreatmentSection,
} from "./sections";

const VERDICT = {
  correct: { label: "Correct", tone: "success" },
  partial: { label: "Partially correct", tone: "warning" },
  implied: { label: "Recognised from your management", tone: "success" },
  incorrect: { label: "Incorrect", tone: "danger" },
  "not-recorded": { label: "Not identified", tone: "neutral" },
} as const;

function duration(min: number) {
  if (min >= 1440) return `${Math.round(min / 1440)} days`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

function Section({ n, title, summary, children, defaultOpen = false }: { n: number; title: string; summary: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <div className="card animate-rise" style={{ animationDelay: `${120 + n * 40}ms` }}>
      <Disclosure
        defaultOpen={defaultOpen}
        headerClassName="px-5 py-4 sm:px-6 rounded-[var(--radius-lg)] hover:bg-surface-2 transition-colors"
        summary={
          <span className="flex items-baseline gap-4">
            <span className="w-6 shrink-0 text-[12px] text-fg-3 tabular">{String(n).padStart(2, "0")}</span>
            <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
              <span className="text-[15px] font-medium tracking-[-0.005em]">{title}</span>
              <span className="truncate text-[12.5px] text-fg-2">{summary}</span>
            </span>
          </span>
        }
      >
        <div className="border-t border-line-2 px-5 py-5 sm:px-6 sm:pl-[64px]">{children}</div>
      </Disclosure>
    </div>
  );
}

export function DebriefView({
  session,
  progress,
  onNext,
  onHome,
  guest = false,
  starting,
}: {
  session: ActiveSession;
  progress: PlayerProgress;
  onNext: () => void;
  onHome: () => void;
  /** Played the demo without an account: the next step is signing up. */
  guest?: boolean;
  starting: boolean;
}) {
  const d = session.debrief as CaseDebrief;
  const state = session.state;
  const [showScore, setShowScore] = useState(false);

  const verdict = VERDICT[d.verdict];
  const majors = d.missed.filter((m) => m.severity === "major").length;
  const hasImages = d.severityBands.some((b) => b.media);

  const sections: { title: string; summary: string; body: ReactNode; open?: boolean }[] = [
    { title: "Diagnosis", summary: "History → examination → investigation → diagnosis", body: <DiagnosisSection d={d} />, open: true },
    { title: "What you did well", summary: d.didWell.length ? `${d.didWell.length} strengths` : "—", body: d.didWell.length ? <Bullets items={d.didWell} marker="check" /> : <p className="text-[14px] text-fg-2">Little went to plan this time — the sections below show how to approach it next time.</p> },
    { title: "What you missed", summary: d.missed.length ? `${d.missed.length} item${d.missed.length === 1 ? "" : "s"}${majors ? ` · ${majors} major` : ""}` : "Nothing significant", body: <MissesSection d={d} /> },
    { title: "Disease decision tree", summary: `${d.severityBands.length} severity bands · treatment failure pathway`, body: <DecisionTreeSection d={d} /> },
    ...(hasImages ? [{ title: "Severity comparison", summary: "Clinical images by severity", body: <SeveritySection d={d} /> }] : []),
    { title: "Treatment", summary: d.routines.length ? `Plan and ${d.routines.length} practical routine${d.routines.length === 1 ? "" : "s"}` : "The plan for this patient", body: <TreatmentSection d={d} /> },
    { title: "Drugs", summary: d.drugs.map((x) => x.generic.split(/[ (]/)[0]).join(" · "), body: <DrugsSection d={d} /> },
    { title: "Investigations", summary: `What to order, when, and what it costs`, body: <InvestigationsSection d={d} /> },
    { title: "Rescue opportunities", summary: d.rescue.occurred ? `${d.rescue.episodes.length} deterioration${d.rescue.episodes.length === 1 ? "" : "s"}` : "No deterioration", body: <RescueSection d={d} /> },
    { title: "Follow-up", summary: d.followUp.interval, body: <FollowUpSection d={d} /> },
    { title: "Clinical pearl", summary: "One thing to remember", body: <blockquote className="border-l-2 border-accent pl-4 text-[16px] leading-[1.7] text-pretty">{d.pearl}</blockquote> },
  ];

  return (
    <div className="min-h-dvh animate-fade">
      <CaseTopBar state={state} complete />
      <main className="mx-auto w-full max-w-5xl px-4 pt-10 pb-32 sm:px-6 sm:pt-14">
        {/* Header ------------------------------------------------------- */}
        <section className="animate-rise">
          <Label>Case complete</Label>
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="micro text-fg-3">Final diagnosis</div>
              <h1 className="mt-2 text-[30px] leading-[1.15] font-medium tracking-[-0.025em] text-balance sm:text-[40px]">{d.diagnosis}</h1>
              {d.qualifier && <p className="mt-3 text-[14.5px] leading-6 text-fg-2 text-pretty">{d.qualifier}</p>}
              <div className="mt-5 flex flex-wrap items-center gap-2.5 text-[13px]">
                <span className="text-fg-2">Your diagnosis</span>
                {d.userDiagnosis ? <span className="font-medium">“{d.userDiagnosis}”</span> : <span className="text-fg-3">Not stated</span>}
                <Badge tone={verdict.tone}>{verdict.label}</Badge>
              </div>
            </div>
            <ScoreRing score={d.score.total} />
          </div>
        </section>

        {/* Rewards ------------------------------------------------------------ */}
        <div className="mt-10 animate-rise [animation-delay:120ms]">
          <RewardsPanel xpEarned={d.score.xp} score={d.score.total} rewards={session.rewards} progress={progress} seed={d.caseNumber * 7919 + d.score.total} />
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[12.5px] text-fg-2">
            <span>
              Outcome <span className="font-medium text-fg">{STATUS_LABEL[d.finalStatus]}</span>
            </span>
            <span className="text-fg-3">·</span>
            <span>{d.rescue.occurred ? `${d.rescue.episodes.length} deterioration${d.rescue.episodes.length === 1 ? "" : "s"}` : "No deterioration"}</span>
            <span className="text-fg-3">·</span>
            <span className="tabular">{duration(d.elapsedMin)}</span>
            <span className="text-fg-3">·</span>
            <span className="tabular">{money(d.spend, d.country)} on investigations</span>
          </p>
        </div>

        {/* Score breakdown -------------------------------------------------- */}
        <section className="mt-4 animate-rise [animation-delay:180ms]">
          <div className="card">
            <button
              type="button"
              onClick={() => setShowScore((s) => !s)}
              aria-expanded={showScore}
              className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] px-5 py-4 text-left transition-colors hover:bg-surface-2 sm:px-6"
            >
              <span className="flex items-baseline gap-3">
                <span className="text-[15px] font-medium">Score breakdown</span>
                <span className="text-[12.5px] text-fg-2 tabular">
                  {d.score.total}/100 · {d.score.penalties.length} penalt{d.score.penalties.length === 1 ? "y" : "ies"} · {d.score.bonuses.length} bonus{d.score.bonuses.length === 1 ? "" : "es"}
                </span>
              </span>
              <Icon name="chevron-down" className={cn("text-fg-3 transition-transform", showScore && "rotate-180")} />
            </button>
            {showScore && (
              <div className="animate-enter border-t border-line-2 px-5 py-5 sm:px-6">
                <ScoreBreakdown score={d.score} />
              </div>
            )}
          </div>
        </section>

        {/* Debrief ---------------------------------------------------------- */}
        <section className="mt-10" aria-labelledby="debrief-heading">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="debrief-heading" className="micro text-fg-2">
              Debrief
            </h2>
            <span className="text-[12px] text-fg-3">How to manage the next patient with this condition</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {sections.map((s, i) => (
              <Section key={s.title} n={i + 1} title={s.title} summary={s.summary} defaultOpen={s.open}>
                {s.body}
              </Section>
            ))}
            <div className="card">
              <Disclosure
                headerClassName="px-5 py-4 sm:px-6 rounded-[var(--radius-lg)] hover:bg-surface-2 transition-colors"
                summary={
                  <span className="flex items-baseline gap-4">
                    <Icon name="timeline" size={14} className="w-6 shrink-0 text-fg-3" />
                    <span className="text-[15px] font-medium">Your encounter</span>
                    <span className="text-[12.5px] text-fg-2">{state.timeline.length} events</span>
                  </span>
                }
              >
                <div className="border-t border-line-2 px-5 py-5 sm:px-6 sm:pl-[64px]">
                  <Timeline events={state.timeline} />
                </div>
              </Disclosure>
            </div>
          </div>
        </section>
      </main>

      {/* Next case -------------------------------------------------------- */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
          <Link href="/" onClick={onHome} className="text-[13.5px] font-medium text-fg-2 hover:text-fg">
            Home
          </Link>
          {guest ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-[13px] text-fg-2 sm:block">Keep this case, start a streak, join the league.</span>
              <Link href="/signup" className="shine inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-glow">
                Create free account <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          ) : (
            <button type="button" onClick={onNext} disabled={starting} className="shine inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-glow disabled:opacity-70">
              {starting ? "Preparing case…" : state.guided ? "Start your first real case" : "Next case"}
              {!starting && <Icon name="arrow-right" size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
