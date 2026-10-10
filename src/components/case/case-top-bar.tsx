"use client";

import Link from "next/link";

import { LogoTile } from "@/components/brand/wordmark";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { levelMeta, trackLabel } from "@/engine/levels";
import type { CaseState } from "@/engine/types";
import { caseLabel, clockAt } from "@/lib/format";

import { callDuration } from "./scene/call-screen";

const since = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min` : `${Math.round(minutes)} min`);

/** Case and scene on the left; the clock in the middle; sound and End case on the right. The patient's condition lives in the Condition card. */
export function CaseTopBar({
  state,
  onClose,
  complete,
  sound,
  voices,
  realtime,
}: {
  state: CaseState;
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
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-[0.02em] tabular">{caseLabel(state.caseNumber)}</span>
          <span className="truncate text-[11.5px] text-fg-2">
            {trackLabel(state.track, state.country)} · {levelMeta(state.level, state.country).short}
          </span>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2 text-[12.5px] sm:mx-auto">
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
          {voices && !complete && (
            <IconButton label={voices.on ? "Patient voices on — turn off" : "Hear patients speak"} size="sm" onClick={voices.toggle} className={voices.on ? "text-accent-text" : "text-fg-3"}>
              <Icon name="ear" size={17} />
            </IconButton>
          )}
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
