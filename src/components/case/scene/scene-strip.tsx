"use client";

import { Icon } from "@/components/ui/icon";
import type { CaseState, VitalKey } from "@/engine/types";
import { cn } from "@/lib/cn";

import { MonitorStrip } from "./bedside-monitor";
import { callDuration, CallerAvatar, VoiceBars } from "./call-screen";
import { useScene } from "./context";
import { sceneFor, tokenNumber } from "./scene";

const TONE = { normal: "text-fg", unknown: "text-fg", low: "text-warning", high: "text-warning", critical: "text-danger" } as const;

/** The scene in one line, above the conversation on screens without the side panel. */
export function SceneStrip({ state, className }: { state: CaseState; className?: string }) {
  const { alarm, speaking, openPatient } = useScene();
  const scene = sceneFor(state);
  const value = (k: VitalKey) => state.vitals[k]?.current;

  if (scene === "monitor") {
    return (
      <div className={className}>
        <MonitorStrip state={state} alarm={alarm} onOpen={openPatient} />
      </div>
    );
  }

  if (scene === "phone") {
    const home = (["bp", "hr", "rbs"] as VitalKey[]).filter((k) => value(k)).map((k) => `${k === "bp" ? "BP" : k === "hr" ? "Pulse" : "Sugar"} ${value(k)!.value}`);
    return (
      <button type="button" onClick={openPatient} className={cn("flex w-full items-center gap-3 bg-[#0b1220] px-3 py-2 text-left text-white", className)} aria-label="Open the call details and chart">
        <CallerAvatar state={state} live={state.status === "active"} size={32} badge={false} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium">Family member · on speaker</span>
          <span className="block truncate text-[11.5px] text-white/55 tabular">
            {callDuration(state.clock)} · {home.length ? home.join(" · ") : "No home readings yet"}
          </span>
        </span>
        <VoiceBars active={speaking} />
        <Icon name="chevron-down" size={15} className="shrink-0 text-white/40" />
      </button>
    );
  }

  const keys: { k: VitalKey; label: string }[] = [
    { k: "bp", label: "BP" },
    { k: "hr", label: "Pulse" },
    { k: "temp", label: "Temp" },
    { k: "spo2", label: "SpO₂" },
    { k: "rbs", label: "RBS" },
  ];
  return (
    <button type="button" onClick={openPatient} className={cn("flex w-full items-center gap-3 border-b border-line-2 bg-surface px-3 py-2 text-left", className)} aria-label="Open the outpatient card">
      <span className="shrink-0 rounded-md bg-fg px-2 py-0.5 text-center text-bg">
        <span className="block text-[8.5px] font-medium tracking-[0.14em] uppercase opacity-70">Token</span>
        <span className="block font-mono text-[14px] leading-none font-semibold tabular">{tokenNumber(state)}</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none]">
        <span className="shrink-0 text-[12.5px] text-fg-2">
          {state.patient.age} {state.patient.sex[0]}
        </span>
        {keys.map(({ k, label }) => (
          <span key={k} className="shrink-0 text-[12.5px] tabular">
            <span className="text-fg-3">{label} </span>
            <span className={value(k) ? TONE[value(k)!.flag] : "text-fg-3"}>{value(k)?.value ?? "—"}</span>
          </span>
        ))}
      </span>
      <Icon name="chevron-down" size={15} className="shrink-0 text-fg-3" />
    </button>
  );
}
