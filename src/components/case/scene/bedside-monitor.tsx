"use client";

import { useMemo, type ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import type { CaseState, VitalKey } from "@/engine/types";
import { cn } from "@/lib/cn";
import { clockAt } from "@/lib/format";
import { beep } from "@/lib/monitor-audio";

import { useLiveMonitorView, type LiveMonitor } from "./live-monitor";
import { MonitorSignal } from "./monitor-signal";
import { MonitorSweep } from "./monitor-sweep";
import { alarmingKeys, monitorSince, vitalNumber } from "./scene";

export interface AlarmState {
  level: "high" | "medium" | null;
  silenced: boolean;
  sound: boolean;
  silence: () => void;
}

const COLOR: Partial<Record<VitalKey, string>> = {
  hr: "text-emerald-400",
  spo2: "text-sky-400",
  bp: "text-white",
  rr: "text-amber-300",
  temp: "text-white",
  rbs: "text-fuchsia-300",
};

const FLASH = "animate-[flash-alarm_1.2s_ease-in-out_infinite]";

/** The encounter's live monitor, or the measured values on a still screen outside one. */
function useMonitor(state: CaseState): LiveMonitor {
  const live = useLiveMonitorView();
  const fallback = useMemo(() => new MonitorSignal(1), []);
  return live ?? { numbers: { hr: vitalNumber(state, "hr"), spo2: vitalNumber(state, "spo2"), rr: vitalNumber(state, "rr") }, signal: fallback, running: false };
}

function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-1 text-[10px] font-medium tracking-[0.1em] text-white/45 uppercase">
      <span>{children}</span>
      {aside && <span className="tracking-normal normal-case text-white/30 tabular">{aside}</span>}
    </div>
  );
}

/** A waveform parameter's number, beside its trace. */
function Live({ state, k, label, unit, value, size, className }: { state: CaseState; k: "hr" | "spo2" | "rr"; label: string; unit?: string; value: number | null; size: string; className?: string }) {
  const measured = !!state.vitals[k];
  return (
    <div className={cn("flex min-h-0 flex-col justify-center rounded-lg px-2", alarmingKeys(state).has(k) && FLASH, className)}>
      <Label aside={measured && !state.monitored ? "spot" : undefined}>{label}</Label>
      <div className={cn("flex items-baseline gap-1 font-mono tabular", measured ? COLOR[k] : "text-white/25")}>
        <span className={cn("leading-none font-medium tracking-[-0.03em]", size)}>{measured && value !== null ? value : "—"}</span>
        {measured && unit && <span className="text-[10px] text-white/35">{unit}</span>}
      </div>
    </div>
  );
}

/** Non-invasive BP: measured by the cuff at a moment in time, with the mean arterial pressure. */
function Nibp({ state }: { state: CaseState }) {
  const r = state.vitals.bp?.current;
  const m = r?.value.match(/^(\d+)\s*\/\s*(\d+)/);
  const map = m ? Math.round(Number(m[2]) + (Number(m[1]) - Number(m[2])) / 3) : null;
  return (
    <div className={cn("min-w-0 rounded-lg px-2 py-1.5", alarmingKeys(state).has("bp") && FLASH)}>
      {/* On the monitor the cuff cycles automatically every 15 minutes; the time is its last reading. */}
      <Label aside={r ? (state.monitored ? `${clockAt(state.arrivalMinuteOfDay, r.at)} · auto` : "spot") : undefined}>NIBP</Label>
      <div className={cn("flex items-baseline gap-1.5 font-mono tabular", r ? COLOR.bp : "text-white/25")}>
        <span className="text-[19px] leading-none font-medium tracking-[-0.03em]">{r ? r.value : "—"}</span>
        {map !== null && <span className="text-[11px] text-white/45">({map})</span>}
      </div>
    </div>
  );
}

function Reading({ state, k, label, unit }: { state: CaseState; k: VitalKey; label: string; unit?: string }) {
  const r = state.vitals[k]?.current;
  return (
    <div className="min-w-0 rounded-lg px-2 py-1.5">
      <Label>{label}</Label>
      <div className={cn("flex items-baseline gap-1 font-mono tabular", r ? COLOR[k] : "text-white/25")}>
        <span className="text-[19px] leading-none font-medium tracking-[-0.03em]">{r ? r.value : "—"}</span>
        {r && unit && <span className="text-[10px] text-white/35">{unit}</span>}
      </div>
    </div>
  );
}

function Header({ state, alarm, children }: { state: CaseState; alarm: AlarmState; children?: ReactNode }) {
  const since = monitorSince(state);
  return (
    <div className="flex items-center justify-between gap-2 px-3 pt-2.5 text-[10px] font-medium tracking-[0.12em] text-white/45 uppercase">
      <span className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", state.monitored ? "animate-breathe bg-emerald-400" : "bg-white/25")} aria-hidden />
        {state.monitored ? `Live${since ? ` · since ${since}` : ""}` : "Monitor not attached"}
      </span>
      {alarm.level ? (
        <span className="flex items-center gap-1.5">
          <span className={cn("rounded px-1.5 py-0.5 tracking-[0.08em]", alarm.level === "high" ? "bg-red-500/90 text-white" : "bg-amber-400/90 text-black")}>Alarm</span>
          {alarm.sound && !alarm.silenced && (
            <button type="button" onClick={alarm.silence} className="flex items-center gap-1 rounded px-1.5 py-0.5 tracking-normal normal-case text-white/70 ring-1 ring-white/15 hover:bg-white/10" aria-label="Silence alarms for 2 minutes">
              <Icon name="bell-off" size={11} /> Silence
            </button>
          )}
        </span>
      ) : (
        children
      )}
    </div>
  );
}

const TRACE_LABEL = "pointer-events-none absolute left-1 text-[9px] font-medium tracking-[0.06em]";

/** The full bedside monitor: each waveform with its number, then the cuff pressure and the slower parameters. */
export function BedsideMonitor({ state, alarm, className }: { state: CaseState; alarm: AlarmState; className?: string }) {
  const { numbers, signal, running } = useMonitor(state);
  return (
    <section aria-label="Bedside monitor" className={cn("overflow-hidden rounded-2xl bg-[#07090d] text-white shadow-[0_18px_40px_-24px_rgb(0_0_0/0.8)] ring-1 ring-white/10", className)}>
      <Header state={state} alarm={alarm} />
      <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-1 px-2 pt-1 pb-1">
        <div className="relative h-[156px]">
          <MonitorSweep signal={signal} running={running} resp onBeat={() => beep(numbers.spo2)} className="absolute inset-0 h-full w-full" />
          <span aria-hidden className={cn(TRACE_LABEL, "top-0.5 text-emerald-300/50")}>II</span>
          <span aria-hidden className={cn(TRACE_LABEL, "top-[46%] text-sky-300/50")}>Pleth</span>
          <span aria-hidden className={cn(TRACE_LABEL, "top-[73%] text-amber-200/50")}>Resp</span>
        </div>
        <div className="flex h-[156px] flex-col">
          <Live state={state} k="hr" label="HR" value={numbers.hr} size="text-[32px]" className="flex-[46]" />
          <Live state={state} k="spo2" label="SpO₂" unit="%" value={numbers.spo2} size="text-[23px]" className="flex-[27]" />
          <Live state={state} k="rr" label="RR" value={numbers.rr} size="text-[21px]" className="flex-[27]" />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] border-t border-white/10 px-1 py-1">
        <Nibp state={state} />
        <Reading state={state} k="temp" label="Temp" unit="°F" />
        <Reading state={state} k="rbs" label="RBS" />
      </div>
    </section>
  );
}

/** The compact monitor strip above the conversation on smaller screens. */
export function MonitorStrip({ state, alarm, onOpen }: { state: CaseState; alarm: AlarmState; onOpen: () => void }) {
  const { numbers, signal, running } = useMonitor(state);
  const alarming = alarmingKeys(state);
  const items: { k: VitalKey; label: string; value: string | number | null | undefined }[] = [
    { k: "hr", label: "HR", value: numbers.hr },
    { k: "spo2", label: "SpO₂", value: numbers.spo2 },
    { k: "rr", label: "RR", value: numbers.rr },
    { k: "bp", label: "BP", value: state.vitals.bp?.current.value },
  ];
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-2.5 bg-[#07090d] px-3 py-2 text-left text-white min-[420px]:gap-3" aria-label="Open the bedside monitor and chart">
      {/* Narrower on small phones so all four numbers fit beside it. */}
      <span className="relative h-8 w-16 shrink-0 overflow-hidden rounded-md bg-white/[0.03] min-[420px]:w-[104px]">
        <MonitorSweep signal={signal} running={running} pleth={false} speed={40} onBeat={() => beep(numbers.spo2)} className="absolute inset-0 h-full w-full" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] min-[420px]:gap-3">
        {items.map(({ k, label, value }) => {
          const shown = state.vitals[k] && value !== null && value !== undefined;
          return (
            <span key={k} className={cn("flex shrink-0 items-baseline gap-1 rounded px-1 font-mono tabular", alarming.has(k) && FLASH)}>
              <span className="text-[9.5px] tracking-[0.08em] text-white/40 uppercase">{label}</span>
              <span className={cn("text-[15px] font-medium", shown ? COLOR[k] : "text-white/25")}>{shown ? value : "—"}</span>
            </span>
          );
        })}
      </span>
      {alarm.level && <span className={cn("h-2 w-2 shrink-0 rounded-full", alarm.level === "high" ? "animate-pulse bg-red-500" : "bg-amber-400")} aria-label="Monitor alarm" />}
      <Icon name="chevron-down" size={15} className="shrink-0 text-white/40" />
    </button>
  );
}
