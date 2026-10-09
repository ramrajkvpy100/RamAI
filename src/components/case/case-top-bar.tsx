"use client";

import Link from "next/link";

import { LogoTile } from "@/components/brand/wordmark";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusDot } from "@/components/ui/primitives";
import { LEVELS, TRACKS } from "@/engine/levels";
import type { CaseState } from "@/engine/types";
import { caseLabel, clockAt, STATUS_LABEL, STATUS_TONE } from "@/lib/format";

import { callDuration } from "./scene/call-screen";

const since = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min` : `${Math.round(minutes)} min`);

/** Case and scene on the left; patient status and clock in the middle; sound and End case on the right. */
export function CaseTopBar({
  state,
  onClose,
  complete,
  sound,
}: {
  state: CaseState;
  onClose?: () => void;
  complete?: boolean;
  /** Monitor sound toggle — only offered where there is a monitor. */
  sound?: { on: boolean; toggle: () => void } | null;
}) {
  const tone = complete ? "neutral" : STATUS_TONE[state.patientStatus];
  const alarming = !complete && (state.patientStatus === "deteriorating" || state.patientStatus === "critical");
  const day = Math.floor((state.arrivalMinuteOfDay + state.clock) / 1440);
  const phone = state.track === "phone";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_84%,transparent)] backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
        <Link href="/" aria-label="RamAI — home" className="shrink-0 rounded-lg">
          <LogoTile size={28} />
        </Link>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-[0.02em] tabular">{caseLabel(state.caseNumber)}</span>
          <span className="truncate text-[11.5px] text-fg-2">
            {TRACKS[state.track].label} · {LEVELS[state.level].short}
          </span>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2 text-[12.5px] sm:mx-auto" aria-live="polite">
          <StatusDot tone={complete ? "neutral" : tone === "neutral" ? "success" : tone} pulse={alarming} />
          <span className={alarming ? "font-semibold text-danger" : "font-medium text-fg"}>{complete ? "Complete" : STATUS_LABEL[state.patientStatus]}</span>
          <span className="hidden text-fg-3 sm:inline">·</span>
          <span className="hidden text-fg-2 tabular sm:inline">
            {phone ? (
              <>Call · {callDuration(state.clock)}</>
            ) : (
              <>
                {day > 0 ? `Day ${day + 1}, ` : ""}
                {clockAt(state.arrivalMinuteOfDay, state.clock)}
                {state.track === "emergency" && state.clock > 0 && <span className="text-fg-3"> · {since(state.clock)} since arrival</span>}
              </>
            )}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
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
