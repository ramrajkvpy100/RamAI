"use client";

import { ReportProblem } from "./report-problem";
import Link from "next/link";

import { LogoTile } from "@/components/brand/wordmark";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { levelMeta, trackLabel } from "@/engine/levels";
import type { CaseState } from "@/engine/types";
import { caseLabel, clockAt } from "@/lib/format";

import { callDuration } from "./scene/call-screen";
import { cn } from "@/lib/cn";
import { useSpeaking } from "@/lib/voices";

const since = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min` : `${Math.round(minutes)} min`);

/** Case and scene on the left; the clock in the middle; sound and End case on the right. The patient's condition lives in the Condition card. */
export function CaseTopBar({
  state,
  onClose,
  complete,
  sound,
  voices,
  realtime,
  onSkip,
}: {
  state: CaseState;
  /** The guided demo: leave it for a real case. */
  onSkip?: () => void;
  onClose?: () => void;
  complete?: boolean;
  /** Monitor sound toggle — only offered where there is a monitor. */
  sound?: { on: boolean; toggle: () => void } | null;
  /** Patients and families speak aloud. */
  voices?: { on: boolean; toggle: () => void } | null;
  /** Real-time mode (emergency cases): the clock runs on its own. */
  realtime?: { on: boolean; running: boolean; toggle: () => void } | null;
}) {
  const day = Math.floor((state.arrivalMinuteOfDay + state.clock) / 1440);
  const phone = state.track === "phone";
  return (
    <header className="material-bar sticky top-0 z-30 border-b border-[var(--material-stroke)]">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <Link href="/" aria-label="RamAI — home" className="shrink-0 rounded-lg">
          <LogoTile size={28} />
        </Link>
        {/* Who the patient is and why they came — large enough to read at a glance. (The case number is in the tooltip.) */}
        <div className="flex min-w-0 flex-1 flex-col leading-tight" title={`${caseLabel(state.caseNumber)} · ${trackLabel(state.track, state.country)} · ${levelMeta(state.level, state.country).short}`}>
          <span className="line-clamp-2 text-[15px] leading-snug font-semibold text-fg">
            <span className="text-accent-text">{state.patient.age}{state.patient.sex === "Male" ? " M" : state.patient.sex === "Female" ? " F" : ""}</span>
            {" · "}
            {complaintOf(state) || trackLabel(state.track, state.country)}
          </span>
          <span className="truncate text-[11.5px] text-fg-3">
            {trackLabel(state.track, state.country)} · {levelMeta(state.level, state.country).short}
          </span>
        </div>

        <div className={cn("shrink-0 items-center gap-2 text-[12.5px]", complete ? "hidden sm:flex" : "flex")}>
          {complete && (
            <>
              <span className="font-medium text-fg">Complete</span>
              <span className="text-fg-3">·</span>
            </>
          )}
          {realtime?.running && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10.5px] font-bold tracking-[0.08em] text-danger" title="Real-time: one minute passes every 20 seconds">
              <span className="pulse-ring h-1.5 w-1.5 rounded-full bg-danger" /> LIVE
            </span>
          )}
          <span className="truncate text-fg-2 tabular">
            {phone ? (
              <>Call · {callDuration(state.clock)}</>
            ) : (
              <>
                {day > 0 ? `Day ${day + 1}, ` : ""}
                {clockAt(state.arrivalMinuteOfDay, state.clock)}
                {state.track === "emergency" && state.clock > 0 && <span className="hidden text-fg-3 sm:inline"> · {since(state.clock)} since arrival</span>}
              </>
            )}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!complete && <ReportProblem />}
          {onSkip && !complete && (
            <button type="button" onClick={onSkip} className="flex h-8 items-center gap-1 rounded-full bg-surface-3 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
              Skip<span className="hidden sm:inline"> demo</span> <Icon name="arrow-right" size={13} />
            </button>
          )}
          {realtime && !complete && (
            <IconButton
              label={realtime.on ? "Real-time on — the clock runs while you think. Turn off" : "Real-time mode: let the clock run while you think"}
              size="sm"
              onClick={realtime.toggle}
              className={realtime.on ? "text-danger" : "text-fg-3"}
            >
              <Icon name="clock" size={17} />
            </IconButton>
          )}
          {voices && !complete && <VoiceButton on={voices.on} toggle={voices.toggle} />}
          {sound && !complete && (
            <IconButton label={sound.on ? "Monitor sounds on — turn off" : "Turn on monitor sounds"} size="sm" onClick={sound.toggle} className={sound.on ? "text-accent-text" : "text-fg-3"}>
              <Icon name={sound.on ? "volume" : "volume-off"} size={17} />
            </IconButton>
          )}
          {onClose && !complete ? (
            <div className="hidden sm:block">
              <Button size="sm" variant="secondary" onClick={onClose} data-coach-target="end-case">
                End case
              </Button>
            </div>
          ) : (
            <span className="hidden w-[84px] sm:block" aria-hidden />
          )}
        </div>
      </div>
    </header>
  );
}

/** Patient voices: clearly on (filled) or off, with moving bars while someone is speaking. */
function VoiceButton({ on, toggle }: { on: boolean; toggle: () => void }) {
  const speaking = useSpeaking();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Patient voices on — turn off" : "Hear patients speak"}
      title={on ? "Patient voices on — turn off" : "Hear patients speak"}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold transition-all duration-200 active:scale-90",
        on ? "bg-accent text-on-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "text-fg-3 hover:bg-surface-3 hover:text-fg",
      )}
    >
      {on && speaking ? (
        <span aria-hidden className="flex h-4 items-end gap-[2px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="w-[3px] origin-bottom rounded-full bg-current" style={{ height: "100%", animation: `voice 0.9s ease-in-out ${i * 0.12}s infinite` }} />
          ))}
        </span>
      ) : (
        <Icon name={on ? "volume" : "ear"} size={16} />
      )}
      <span className="hidden sm:inline">{on ? "Voices on" : "Voices"}</span>
    </button>
  );
}

/** What the patient came with: the first thing they (or their family, or the caller) said, briefly. */
function complaintOf(state: CaseState): string {
  const clean = (t: string) => t.replace(/\s*\p{Extended_Pictographic}/gu, "").replace(/^(namaste|hello|hi|good (morning|evening|afternoon))[,.!]?\s*(doctor)?[,.!]?\s*/i, "").trim();
  const said = state.messages.filter((m) => (m.role === "patient" || m.role === "attendant") && m.kind === "speech").map((m) => clean(m.text));
  const first = said.find((t) => t.length > 12) ?? "";
  // The sentence with the symptom, not the introduction ("This is my daughter Anaya.").
  const sentences = first.split(/(?<=[.!?])\s+/);
  const SYMPTOM = /\b(had|have|has|having|since|pain|ache|hurt|fever|cough|vomit|bleed|swell|breath|rash|itch|weak|dizz|faint|fit|seiz|burn|loose|diarr|injur|fell|bite|lump|discharge)/i;
  let text = sentences.find((x) => SYMPTOM.test(x)) ?? sentences[0] ?? "";
  // "She's had a fever for three days" → "Fever for three days".
  text = text
    .replace(/^doctor[,!]?\s*/i, "")
    .replace(/^(?:i|she|he|they|my \w+|the baby|baby)(?:'ve|'s| have| has| had)\s+(?:been\s+)?(?:(?:had|having|got|getting)\s+)?(?:a |an |some )?/i, "")
    .replace(/[.!]+$/, "")
    .trim();
  // One clause, whole — never cut mid-word: "A snake bit him in the paddy field, about an hour ago" → "A snake bit him in the paddy field".
  const cuts = [/,/, /;/, / — /, / - /, /\s+about\b/i, /\s+around\b/i, /\s+and\b/i, /\s+but\b/i, /\s+which\b/i]
    .map((re) => text.search(re))
    .filter((i) => i >= 12)
    .sort((a, b) => a - b);
  if (cuts.length && text.length > 34) text = text.slice(0, cuts[0]);
  if (text.length > 48) text = text.slice(0, text.lastIndexOf(" ", 48)).replace(/\s+(of|in|on|at|for|the|a|an|to|with|from|my|his|her|since|after|before|this)$/i, "");
  if (text) text = text[0]!.toUpperCase() + text.slice(1);
  return text;
}
