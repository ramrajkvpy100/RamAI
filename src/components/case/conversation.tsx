"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { FamilyFigure, NurseFigure, PatientFigure } from "@/components/game/caricature";
import { MediaFigure } from "@/components/media/media-figure";
import { Icon, type IconName } from "@/components/ui/icon";
import type { CaseState, EncounterMessage } from "@/engine/types";
import { cn } from "@/lib/cn";
import { clockAt } from "@/lib/format";

import { ResultCard } from "./result-card";
import { figureSeed, statusAt } from "./scene/figures";

interface Block {
  key: string;
  role: EncounterMessage["role"];
  kind: EncounterMessage["kind"];
  messages: EncounterMessage[];
  day: number;
}

function toBlocks(messages: EncounterMessage[], arrival: number): Block[] {
  const blocks: Block[] = [];
  for (const m of messages) {
    const day = Math.floor((arrival + m.at) / 1440);
    const last = blocks[blocks.length - 1];
    const person = m.role === "patient" || m.role === "attendant";
    const groupable = (person && m.kind === "speech") || m.role === "doctor";
    if (last && groupable && last.role === m.role && (m.role === "doctor" || last.kind === m.kind) && last.day === day) {
      last.messages.push(m);
    } else {
      blocks.push({ key: m.id, role: m.role, kind: m.kind, messages: [m], day });
    }
  }
  return blocks;
}

/** The speaker's caricature, as they looked at that moment. */
function SpeakerFigure({ state, role, at }: { state: CaseState; role: "patient" | "attendant"; at: number }) {
  const status = statusAt(state, at);
  return role === "patient" ? (
    <PatientFigure patient={state.patient} status={status} seed={figureSeed(state)} size={34} className="ring-1 ring-line rounded-full" />
  ) : (
    <FamilyFigure seed={figureSeed(state)} patientStatus={status} onPhone={state.track === "phone"} size={34} className="ring-1 ring-line rounded-full" />
  );
}

/** Patient or family: left-aligned bubbles. */
function PersonSpeech({ block, state, isNew, phone }: { block: Block; state: CaseState; isNew: boolean; phone: boolean }) {
  const first = block.messages[0]!;
  const caller = block.role === "attendant";
  const label = caller ? (phone ? "Caller" : "Attendant") : "Patient";
  return (
    <div className={cn("flex items-end gap-2.5 pr-6 sm:pr-14", isNew && "animate-enter")}>
      <SpeakerFigure state={state} role={caller ? "attendant" : "patient"} at={first.at} />
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="pl-1 text-[11.5px] text-fg-3">
          <span className="font-medium text-fg-2">{label}</span> · <span className="tabular">{clockAt(state.arrivalMinuteOfDay, first.at)}</span>
        </span>
        {block.messages.map((m) => (
          <p key={m.id} className="max-w-full rounded-[18px] rounded-bl-[6px] border border-line bg-surface px-4 py-2.5 text-body whitespace-pre-wrap text-fg shadow-sm">
            {m.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The doctor — you: right-aligned bubbles. */
function DoctorSpeech({ texts, isNew, pending = false }: { texts: string[]; isNew: boolean; pending?: boolean }) {
  return (
    <div className={cn("flex flex-col items-end gap-1 pl-10 sm:pl-20", isNew && "animate-enter")}>
      {texts.map((t, i) => (
        <p key={i} className={cn("max-w-full rounded-[18px] rounded-br-[6px] bg-accent px-4 py-2.5 text-[14.5px] leading-6 whitespace-pre-wrap text-on-accent shadow-sm", pending && "opacity-75")}>
          {t}
        </p>
      ))}
    </div>
  );
}

function NurseLine({ m, isNew }: { m: EncounterMessage; isNew: boolean }) {
  if (m.kind === "status") {
    return (
      <div role="alert" className={cn("flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warning)_35%,var(--line))] bg-warning-soft px-3.5 py-2.5", isNew && "animate-enter")}>
        <NurseFigure alert size={30} className="mt-0.5" />
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold tracking-[0.08em] text-warning uppercase">Nurse</div>
          <p className="text-[14.5px] leading-6 text-fg">{m.text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-2.5", isNew && "animate-enter")}>
      <NurseFigure size={22} className="mt-px" />
      <p className="text-[14px] leading-6 text-fg-2">
        <span className="mr-1.5 text-[10.5px] font-semibold tracking-[0.06em] text-fg-3 uppercase">Nurse</span>
        {m.text}
      </p>
    </div>
  );
}

function Finding({ m, state, isNew, highlightIds }: { m: EncounterMessage; state: CaseState; isNew: boolean; highlightIds: Set<string> }) {
  const results = (m.attachmentIds ?? []).map((id) => state.investigations.find((i) => i.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
  const [head, ...rest] = m.text.split(" — ");
  const isExam = rest.length > 0 && !results.length;
  const isObservation = !results.length && !isExam && /\s·\s|mmHg|\/min|mg\/dL|°F|%/.test(m.text) && m.text.length < 160;

  if (results.length > 0) {
    return (
      <div className={cn("flex flex-col gap-2.5", isNew && "animate-enter")}>
        <div className="flex items-center gap-2 text-[12px] font-medium text-fg-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-accent-text">
            <Icon name="flask" size={13} />
          </span>
          {results.length === 1 ? "Result available" : `${results.length} results available`}
        </div>
        {results.map((r) => (
          <ResultCard key={r.id} inv={r} arrivalMinuteOfDay={state.arrivalMinuteOfDay} now={state.clock} highlight={highlightIds.has(r.id)} className="max-w-[600px]" />
        ))}
      </div>
    );
  }

  const icon: IconName = isExam ? "hand" : isObservation ? "pulse" : m.media ? "image" : "eye";
  const label = isExam ? "Examination" : isObservation ? "Observation" : m.media ? "Image" : "Finding";
  return (
    <div className={cn("max-w-[600px] overflow-hidden rounded-xl border border-line bg-surface shadow-sm", isNew && "animate-enter")}>
      <div className="flex items-center gap-2 border-b border-line-2 bg-surface-2 px-3.5 py-2 text-[11.5px] text-fg-2">
        <Icon name={icon} size={13} className="text-fg-3" />
        <span className="font-medium">{label}</span>
        {isExam && <span className="truncate text-fg">· {head}</span>}
      </div>
      <p className={cn("px-3.5 py-2.5 text-[14.5px] leading-6", isObservation && "font-medium tabular")}>{isExam ? rest.join(" — ") : m.text}</p>
      {m.media && (
        <div className="px-3 pb-3">
          <MediaFigure media={m.media} viewerKey={m.id} title={isExam ? head : label} />
        </div>
      )}
    </div>
  );
}

function SystemLine({ m, isNew }: { m: EncounterMessage; isNew: boolean }) {
  if (m.kind === "status" && /status changed/i.test(m.text)) {
    return (
      <div className={cn("flex items-center gap-3 py-1", isNew && "animate-enter")} role="alert">
        <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--danger)_45%,transparent)]" />
        <span className="flex items-center gap-2 rounded-full bg-danger-soft px-3 py-1 text-[12.5px] font-semibold text-danger">
          <span className="pulse-ring h-1.5 w-1.5 rounded-full bg-danger" />
          {m.text}
        </span>
        <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--danger)_45%,transparent)]" />
      </div>
    );
  }
  if (m.kind === "status" && /has died|no return of spontaneous/i.test(m.text)) {
    return (
      <div className={cn("rounded-xl border border-[color-mix(in_srgb,var(--danger)_30%,var(--line))] bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger", isNew && "animate-enter")} role="alert">
        {m.text}
      </div>
    );
  }
  if (m.kind === "status") {
    const later = /later$/.test(m.text);
    return (
      <div className={cn("flex items-center gap-3 py-0.5", isNew && "animate-enter")} role="note">
        <span className="h-px flex-1 bg-line-2" />
        <span className="flex max-w-[80%] items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1 text-center text-[12px] text-fg-2">
          {later && <Icon name="clock" size={12} className="shrink-0 text-fg-3" />}
          {m.text}
        </span>
        <span className="h-px flex-1 bg-line-2" />
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-2 pl-1 text-[12.5px] leading-5 text-fg-2", isNew && "animate-enter")}>
      <Icon name="check" size={13} className="mt-[3px] shrink-0 text-success" />
      <span>{m.text}</span>
    </div>
  );
}

export function Conversation({
  state,
  sendingInput,
  newIds,
  highlightIds,
}: {
  state: CaseState;
  sendingInput: string | null;
  newIds: Set<string>;
  highlightIds: Set<string>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [unseen, setUnseen] = useState(false);
  const blocks = useMemo(() => toBlocks(state.messages, state.arrivalMinuteOfDay), [state.messages, state.arrivalMinuteOfDay]);
  const phone = state.track === "phone";
  const asking = !!sendingInput && /\?\s*$|^(any|do|does|did|how|what|when|where|why|are|is|have|has|tell)\b/i.test(sendingInput.trim());

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (pinned) {
      el.scrollTo({ top: el.scrollHeight, behavior: newIds.size ? "smooth" : "auto" });
    } else {
      setUnseen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages.length, sendingInput]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      setPinned(near);
      if (near) setUnseen(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  let lastDay = 0;
  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} className="scroll-area h-full">
        <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Encounter transcript" className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 pt-6 pb-10 sm:px-6">
          {blocks.map((block) => {
            const sep = block.day !== lastDay;
            lastDay = block.day;
            const first = block.messages[0]!;
            const isNew = block.messages.some((m) => newIds.has(m.id));
            return (
              <div key={block.key} className="flex flex-col gap-4">
                {sep && (
                  <div className="flex items-center gap-3 pt-2" role="separator">
                    <span className="h-px flex-1 bg-line" />
                    <span className="micro text-fg-3">Day {block.day + 1}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                {block.role === "doctor" ? (
                  <DoctorSpeech texts={block.messages.map((m) => m.text)} isNew={isNew} />
                ) : (block.role === "patient" || block.role === "attendant") && block.kind === "speech" ? (
                  <PersonSpeech block={block} state={state} isNew={isNew} phone={phone} />
                ) : block.role === "nurse" ? (
                  <NurseLine m={first} isNew={isNew} />
                ) : first.kind === "finding" ? (
                  <Finding m={first} state={state} isNew={isNew} highlightIds={highlightIds} />
                ) : (
                  <SystemLine m={first} isNew={isNew} />
                )}
              </div>
            );
          })}

          {sendingInput && (
            <>
              <DoctorSpeech texts={[sendingInput]} isNew pending />
              <div className="flex animate-enter items-end gap-2.5" aria-live="polite">
                {asking ? <SpeakerFigure state={state} role={phone ? "attendant" : "patient"} at={state.clock} /> : <NurseFigure size={34} className="rounded-full ring-1 ring-line" />}
                <span className="flex items-center gap-1.5 rounded-[18px] rounded-bl-[6px] border border-line bg-surface px-4 py-3 shadow-sm">
                  <span className="sr-only">{asking ? "Waiting for the reply" : "Carrying out your orders"}</span>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-[typing_1.2s_ease-in-out_infinite] rounded-full bg-fg-3" style={{ animationDelay: `${i * 0.18}s` }} />
                  ))}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      {unseen && !pinned && (
        <button
          type="button"
          onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })}
          className="absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 animate-enter items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-ui text-fg shadow-md"
        >
          <Icon name="chevron-down" size={14} /> New activity
        </button>
      )}
    </div>
  );
}
