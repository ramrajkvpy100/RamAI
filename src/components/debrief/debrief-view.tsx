"use client";

import { Portal } from "@/components/ui/portal";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { CaseTopBar } from "@/components/case/case-top-bar";
import { Timeline } from "@/components/case/timeline";
import { ShareSheet } from "@/components/share/share-sheet";
import { Disclosure } from "@/components/ui/disclosure";
import { CaseFeedback, ReportCase } from "@/components/case/case-feedback";
import { DuelCard } from "@/components/duel/duel-card";
import { Icon, type IconName } from "@/components/ui/icon";
import { Badge, Label } from "@/components/ui/primitives";
import type { CaseDebrief, PlayerProgress } from "@/engine/types";
import type { ActiveSession } from "@/lib/case-store";
import { cn } from "@/lib/cn";
import { money, STATUS_LABEL } from "@/lib/format";
import { useStartingMessage } from "@/lib/use-starting-message";

import { Bullets } from "./flow";
import { DiseaseSection } from "./disease";
import { LearnSection, useCoach } from "./learn";
import { DailyShare } from "./daily-share";
import { RewardsPanel } from "./rewards";
import { ScoreBreakdown, ScoreRing } from "./score";
import {
  AuscultationSection,
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

/** Where the case's subject is practised as exam questions: the country's own exam. */
const EXAM_FOR: Record<string, string> = { IN: "neet-pg", US: "usmle", UK: "ukmla", WW: "usmle" };
const EXAM_LABEL: Record<string, string> = { IN: "NEET PG", US: "USMLE", UK: "UKMLA", WW: "USMLE" };
const SUBJECT_FOR: Record<string, string> = {
  Medicine: "Medicine", Surgery: "Surgery", Pediatrics: "Paediatrics", OBGYN: "Obstetrics & Gynaecology", Emergency: "Medicine", Cardiology: "Medicine", Neurology: "Medicine",
  Respiratory: "Medicine", Gastroenterology: "Medicine", Nephrology: "Medicine", Endocrinology: "Medicine", Psychiatry: "Psychiatry", ENT: "ENT", Ophthalmology: "Ophthalmology",
  Orthopedics: "Orthopaedics", Urology: "Surgery", "Infectious Disease": "Medicine", Dermatology: "Dermatology",
};

/** Each section's own icon and colour, so the list reads at a glance. */
const SECTION_LOOK: Record<string, { icon: IconName; tone: string }> = {
  Diagnosis: { icon: "target", tone: "from-sky-500 to-blue-600" },
  "What you did well": { icon: "check", tone: "from-emerald-400 to-teal-600" },
  "What you missed": { icon: "alert", tone: "from-amber-400 to-orange-500" },
  Auscultation: { icon: "ear", tone: "from-cyan-400 to-sky-600" },
  "Disease decision tree": { icon: "layers", tone: "from-violet-400 to-purple-600" },
  "Severity comparison": { icon: "image", tone: "from-fuchsia-400 to-pink-600" },
  Treatment: { icon: "heart", tone: "from-rose-400 to-red-500" },
  Drugs: { icon: "pill", tone: "from-indigo-400 to-indigo-600" },
  Investigations: { icon: "flask", tone: "from-teal-400 to-emerald-600" },
  "Rescue opportunities": { icon: "siren", tone: "from-red-400 to-rose-600" },
  "Follow-up": { icon: "calendar", tone: "from-blue-400 to-indigo-500" },
  "Clinical pearl": { icon: "bulb", tone: "from-yellow-300 to-amber-500" },
};

function Section({ n, title, summary, children, defaultOpen = false }: { n: number; title: string; summary: string; children: ReactNode; defaultOpen?: boolean }) {
  const look = SECTION_LOOK[title] ?? { icon: "book" as IconName, tone: "from-slate-400 to-slate-600" };
  return (
    <div className="card animate-rise" style={{ animationDelay: `${120 + n * 40}ms` }}>
      <Disclosure
        defaultOpen={defaultOpen}
        headerClassName="px-5 py-4 sm:px-6 rounded-[var(--radius-lg)] hover:bg-surface-2 transition-colors"
        summary={
          <span className="flex items-center gap-3.5">
            <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${look.tone} text-white shadow-sm`}>
              <Icon name={look.icon} size={18} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-baseline gap-2">
                <span className="text-[16px] font-semibold tracking-[-0.01em]">{title}</span>
                <span className="text-[11px] text-fg-3 tabular">{String(n).padStart(2, "0")}</span>
              </span>
              <span className="truncate text-[12.5px] text-fg-2">{summary}</span>
            </span>
          </span>
        }
      >
        <div className="border-t border-line-2 px-5 py-5 sm:px-6 sm:pl-[78px]">{children}</div>
      </Disclosure>
    </div>
  );
}

/** Feedback in words, written by the AI model from the encounter. The score above is the marking rules' alone. */
function CoachFeedback({ coach }: { coach: NonNullable<CaseDebrief["coach"]> }) {
  return (
    <section className="card mt-4 p-5 sm:p-6" aria-labelledby="coach-heading">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-ai flex h-7 w-7 items-center justify-center rounded-lg text-white">
          <Icon name="sparkles" size={14} />
        </span>
        <h2 id="coach-heading" className="text-[15px] font-semibold">
          Feedback on your reasoning
        </h2>
        <span className="ml-auto rounded-full bg-surface-3 px-2.5 py-0.5 text-[11.5px] text-fg-2">Written by AI</span>
      </div>
      <p className="mt-3 text-[14px] leading-6">{coach.summary}</p>
      <p className="mt-2 text-[14px] leading-6 text-fg-2">{coach.reasoning}</p>
      <div className="micro mt-4 text-fg-3">Next time</div>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {coach.nextTime.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-[13.5px] leading-6">
            <Icon name="arrow-right" size={13} className="mt-1.5 shrink-0 text-accent-text" />
            {tip}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] leading-5 text-fg-3">Your score comes from RamAI&apos;s marking rules. This feedback is written by AI ({coach.model}) and can make mistakes.</p>
    </section>
  );
}

/** After the guided demo: what just happened, and what real cases are like. */
function DemoDone({ name, won }: { name: string; won: boolean }) {
  return (
    <section className="panel mt-8 flex animate-rise items-start gap-3.5 p-4 sm:p-5" aria-label="Demo complete">
      <span className="bg-ai flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-glow">
        <Icon name={won ? "check" : "sparkles"} size={19} strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold">{won ? `You saved ${name}. Demo complete!` : "Demo complete."}</h2>
        <p className="mt-1 text-[13.5px] leading-6 text-fg-2">
          That&apos;s every case: talk, examine, test, treat and decide — then see your score and what to do next time. Real cases are new patients with hidden diagnoses, and no tips.
        </p>
      </div>
    </section>
  );
}

const SEVERITY_RANK = { major: 3, moderate: 2, minor: 1 } as const;

export function DebriefView({
  session,
  progress,
  onNext,
  onRetry,
  onHome,
  guest = false,
  starting,
}: {
  session: ActiveSession;
  progress: PlayerProgress;
  onNext: () => void;
  /** The same patient again. */
  onRetry?: () => void;
  onHome: () => void;
  /** Played the demo without an account: the next step is signing up. */
  guest?: boolean;
  starting: boolean;
}) {
  const d = session.debrief as CaseDebrief;
  const startingLabel = useStartingMessage(starting);
  const state = session.state;
  const [tab, setTab] = useState<"happened" | "treat" | "practise" | "more">("happened");
  const [sharing, setSharing] = useState(false);
  const { coach, writing: writingCoach } = useCoach(session.token, d.coach);
  const [discussing, setDiscussing] = useState(false);
  // A community post about this case, its result card attached — the daily case's marked as a spoiler.
  const discuss = async () => {
    setDiscussing(true);
    const res = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "result", sessionId: state.sessionId }) }).catch(() => null);
    const shared = res?.ok ? ((await res.json()) as { id: string }) : null;
    const daily = !!state.daily;
    const params = new URLSearchParams({
      compose: "1",
      topic: "cases",
      title: daily ? "Today's daily case — how did you approach it?" : `${d.specialty}: ${d.diagnosis}`.slice(0, 140),
      body: `I scored ${d.score.total}/100 on this ${d.specialty.toLowerCase()} case.\n\nWhat I found tricky:\n\nWhat would you have done differently?`,
      ...(shared ? { share: shared.id } : {}),
      ...(daily ? { spoiler: "1" } : {}),
    });
    window.location.assign(`/community?${params}`);
  };

  const verdict = VERDICT[d.verdict];
  const won = d.score.total >= 70 && (d.finalStatus === "improving" || d.finalStatus === "recovered" || d.finalStatus === "stable");
  const majors = d.missed.filter((m) => m.severity === "major").length;
  const hasImages = d.severityBands.some((b) => b.media);

  type Tab = "happened" | "treat" | "practise" | "more";
  const sections: { tab: Tab; title: string; summary: string; body: ReactNode; open?: boolean }[] = [
    { tab: "happened", title: "Diagnosis", summary: "History → examination → investigation → diagnosis", body: <DiagnosisSection d={d} />, open: true },
    { tab: "happened", title: "What you did well", summary: d.didWell.length ? `${d.didWell.length} strengths` : "—", body: d.didWell.length ? <Bullets items={d.didWell} marker="check" /> : <p className="text-[14px] text-fg-2">Little went to plan this time — How to treat shows the approach for next time.</p> },
    { tab: "happened", title: "What you missed", summary: d.missed.length ? `${d.missed.length} item${d.missed.length === 1 ? "" : "s"}${majors ? ` · ${majors} major` : ""}` : "Nothing significant", body: <MissesSection d={d} />, open: d.missed.length > 0 },
    { tab: "happened", title: "Score breakdown", summary: `${d.score.total}/100 · ${d.score.penalties.length} penalt${d.score.penalties.length === 1 ? "y" : "ies"}`, body: <ScoreBreakdown score={d.score} /> },
    { tab: "happened", title: "Your encounter", summary: `${state.timeline.length} events`, body: <Timeline events={state.timeline} /> },
    { tab: "treat", title: "Treatment", summary: "The plan for this patient, with its source", body: <TreatmentSection d={d} />, open: true },
    { tab: "treat", title: "Drugs", summary: [...new Set(d.drugs.map((x) => x.generic.split(" (")[0]!.trim()))].join(" · ") || "—", body: <DrugsSection d={d} /> },
    { tab: "treat", title: "Investigations", summary: `What to order, when, and what it costs`, body: <InvestigationsSection d={d} /> },
    { tab: "treat", title: "Follow-up", summary: d.followUp.interval, body: <FollowUpSection d={d} /> },
    { tab: "treat", title: "Disease decision tree", summary: `${d.severityBands.length} severity bands · if treatment fails`, body: <DecisionTreeSection d={d} /> },
    ...(d.auscultation?.length ? [{ tab: "more" as Tab, title: "Auscultation", summary: `${d.auscultation.filter((a) => a.listened).length} of ${d.auscultation.length} listened to`, body: <AuscultationSection d={d} /> }] : []),
    ...(hasImages ? [{ tab: "more" as Tab, title: "Severity comparison", summary: "Clinical images by severity", body: <SeveritySection d={d} /> }] : []),
    { tab: "more", title: "Rescue opportunities", summary: d.rescue.occurred ? `${d.rescue.episodes.length} deterioration${d.rescue.episodes.length === 1 ? "" : "s"}` : "No deterioration", body: <RescueSection d={d} /> },
  ];
  // The three things to take away: the biggest misses first.
  const takeaways = [...d.missed].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]).slice(0, 3);

  return (
    <div className="min-h-dvh animate-fade">
      <CaseTopBar state={state} complete />
      <main className="selectable mx-auto w-full max-w-5xl px-4 pt-10 pb-32 sm:px-6 sm:pt-14">
        {state.duel && <DuelCard id={state.duel} className="mb-6" />}
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
            <div className="flex flex-col items-start gap-3 lg:items-center">
              <ScoreRing score={d.score.total} />
            </div>
          </div>
        </section>
        <ShareSheet open={sharing} onClose={() => setSharing(false)} target={{ kind: "result", sessionId: state.sessionId }} title="Share your result" />

        {state.guided && <DemoDone name={state.patient.name ?? "your patient"} won={won} />}
        {/* Three things to take away, and the pearl — the debrief at a glance. */}
        <section className="card mt-4 p-5 sm:p-6" aria-labelledby="takeaways">
          <h2 id="takeaways" className="text-[16px] font-semibold">{takeaways.length ? `${takeaways.length === 1 ? "One thing" : `${takeaways.length} things`} to take away` : "Well managed — one thing to remember"}</h2>
          {takeaways.length > 0 && (
            <ol className="mt-3 flex flex-col gap-3">
              {takeaways.map((m, i) => (
                <li key={m.what} className="flex gap-3">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white", m.severity === "major" ? "bg-danger" : m.severity === "moderate" ? "bg-warning" : "bg-fg-3")}>{i + 1}</span>
                  <span className="min-w-0 text-[14.5px] leading-6">
                    <span className="font-semibold">{m.what}</span>
                    {m.better && <span className="block text-fg-2">→ {m.better}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <blockquote className="mt-4 border-l-2 border-accent pl-4 text-[15px] leading-7 text-pretty">💡 {d.pearl}</blockquote>
        </section>
        {coach ? (
          <CoachFeedback coach={coach} />
        ) : (
          writingCoach && (
            <section className="card mt-4 flex items-center gap-3 p-5 text-[14px] text-fg-2 sm:p-6" role="status">
              <span className="bg-ai flex h-7 w-7 animate-pulse items-center justify-center rounded-lg text-white">
                <Icon name="sparkles" size={14} />
              </span>
              The AI is writing feedback on your reasoning…
            </section>
          )
        )}

        {/* Rewards ------------------------------------------------------------ */}
        <div className="mt-10 animate-rise [animation-delay:120ms]">
          <RewardsPanel xpEarned={d.score.xp} score={d.score.total} rewards={session.rewards} progress={progress} seed={d.caseNumber * 7919 + d.score.total} boxKey={`ramai.box.${state.sessionId}`} />
          {state.daily && <DailyShare dayKey={state.daily} score={d.score} minutes={d.elapsedMin} place={session.rewards?.daily} />}
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

        {/* The debrief, in four tabs ----------------------------------------- */}
        <section className="mt-8" aria-label="Debrief">
          <div role="tablist" className="sticky top-14 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-2xl bg-surface-3/80 p-1 backdrop-blur">
            {([["happened", "What happened"], ["treat", "How to treat"], ["practise", "Practise"], ["more", "More"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("h-10 flex-1 rounded-xl px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors", tab === id ? "bg-surface text-fg shadow-sm" : "text-fg-2 hover:text-fg")}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {sections
              .filter((x) => x.tab === tab)
              .map((x, i) => (
                <Section key={x.title} n={i + 1} title={x.title} summary={x.summary} defaultOpen={x.open}>
                  {x.body}
                </Section>
              ))}
            {tab === "practise" && (
              <>
                <LearnSection token={session.token} />
                <DiseaseSection token={session.token} />
                {!state.guided && (
                  <Link href={`/exams/${EXAM_FOR[state.country ?? "IN"]}?subject=${encodeURIComponent(SUBJECT_FOR[d.specialty] ?? "Medicine")}`} className="card flex items-center justify-between gap-3 p-4 hover:bg-surface-2">
                    <span>
                      <span className="block text-[14.5px] font-semibold">📝 Exam questions on this topic</span>
                      <span className="block text-[12.5px] text-fg-2">{EXAM_LABEL[state.country ?? "IN"]}-style MCQs in {SUBJECT_FOR[d.specialty] ?? "Medicine"}</span>
                    </span>
                    <Icon name="arrow-right" size={16} className="text-fg-3" />
                  </Link>
                )}
                {!state.guided && onRetry && (
                  <button type="button" onClick={onRetry} disabled={starting} className="h-11 self-center rounded-full border border-line bg-surface px-5 text-[14px] font-semibold hover:bg-surface-2 disabled:opacity-60">
                    ↻ Retry this patient — try another approach
                  </button>
                )}
              </>
            )}
            {tab === "more" && (
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button type="button" onClick={() => setSharing(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-[13.5px] font-semibold text-fg ring-1 ring-line hover:bg-surface-3">
                  <Icon name="share-ios" size={15} /> Share result
                </button>
                <button type="button" onClick={() => void discuss()} disabled={discussing} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-[13.5px] font-semibold text-fg ring-1 ring-line hover:bg-surface-3 disabled:opacity-60">
                  <Icon name="chat" size={15} /> {discussing ? "Opening…" : "Discuss this case"}
                </button>
              </div>
            )}
          </div>
          {!state.guided && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <CaseFeedback />
              <ReportCase />
            </div>
          )}
        </section>
      </main>

      {/* Next case -------------------------------------------------------- */}
      <Portal>
      <div className="material-bar fixed inset-x-0 bottom-0 z-20 border-t border-[var(--material-stroke)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6">
          <Link href="/cases" onClick={onHome} aria-label="Cases" className="flex shrink-0 items-center gap-1.5 text-[13.5px] font-medium text-fg-2 hover:text-fg">
            <Icon name="home" size={16} /> <span className="hidden sm:inline">Home</span>
          </Link>
          {guest ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <Link href="/signup" title="Keep your cases, start a streak, join the league" className="text-[13.5px] font-semibold whitespace-nowrap text-accent-text hover:underline">
                Sign up free
              </Link>
              <button type="button" onClick={onNext} disabled={starting} className="shine inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold text-white shadow-glow disabled:opacity-70 sm:px-6">
                {starting ? startingLabel : state.guided ? "Play a real case" : "Next case"}
                {!starting && <Icon name="arrow-right" size={16} />}
              </button>
            </div>
          ) : (
            <button type="button" onClick={onNext} disabled={starting} className="shine inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white shadow-glow disabled:opacity-70">
              {starting ? startingLabel : state.guided ? "Start your first real case" : "Next case"}
              {!starting && <Icon name="arrow-right" size={16} />}
            </button>
          )}
        </div>
      </div>
      </Portal>
    </div>
  );
}
