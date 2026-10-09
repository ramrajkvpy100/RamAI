"use client";

import { FamilyFigure } from "@/components/game/caricature";
import { Icon } from "@/components/ui/icon";
import type { CaseState, VitalKey } from "@/engine/types";
import { cn } from "@/lib/cn";

import { figureSeed } from "./figures";

const HOME: { k: VitalKey; label: string; unit: string }[] = [
  { k: "bp", label: "BP", unit: "mmHg" },
  { k: "hr", label: "Pulse", unit: "/min" },
  { k: "rbs", label: "Sugar", unit: "mg/dL" },
  { k: "temp", label: "Temp", unit: "°F" },
  { k: "spo2", label: "SpO₂", unit: "%" },
];

export const callDuration = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
};

export function VoiceBars({ active, className }: { active: boolean; className?: string }) {
  return (
    <span className={cn("flex h-5 items-center gap-[3px]", className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn("h-[18px] w-[3px] scale-y-[0.22] rounded-full bg-emerald-300 transition-transform duration-300", active && "animate-[voice_0.9s_ease-in-out_infinite]")}
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  );
}

/** The caller's face — the same person as on the incoming-call screen. */
export function CallerAvatar({ state, live, size, badge = true }: { state: CaseState; live: boolean; size: number; badge?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0 rounded-full ring-2 ring-emerald-500">
      <FamilyFigure seed={figureSeed(state)} patientStatus={state.patientStatus} onPhone={live} size={size} />
      {badge && (
        <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-[#0b1220]">
          <Icon name="phone" size={12} strokeWidth={2} />
        </span>
      )}
    </span>
  );
}

/** The phone-call scene: who's on the line, for how long, and what they've measured at home. */
export function CallScreen({ state, speaking, className }: { state: CaseState; speaking: boolean; className?: string }) {
  const readings = HOME.filter((h) => state.vitals[h.k]);
  const live = state.status === "active" && state.patientStatus !== "deceased";
  return (
    <section aria-label="Phone call" className={cn("overflow-hidden rounded-2xl bg-[#0b1220] text-white ring-1 ring-white/10", className)}>
      <div className="flex flex-col items-center px-5 pt-6 pb-5 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          {live && <span className="absolute inset-0 animate-[ring-out_2.4s_ease-out_infinite] rounded-full bg-emerald-400/30" />}
          <span className="relative rounded-full shadow-[0_8px_30px_-8px_rgb(16_185_129/0.8)]">
            <CallerAvatar state={state} live={live} size={64} />
          </span>
        </div>
        <div className="mt-3 text-[15px] font-semibold">Family member</div>
        <div className="mt-0.5 text-[12.5px] text-white/55">{live ? `On speaker · ${callDuration(state.clock)}` : "Call ended"}</div>
        <VoiceBars active={speaking && live} className="mt-3" />
      </div>
      <div className="border-t border-white/10 px-4 py-3">
        <div className="text-[10px] font-medium tracking-[0.12em] text-white/45 uppercase">Home readings</div>
        {readings.length === 0 ? (
          <p className="mt-1.5 text-[12.5px] text-white/40">Nothing measured at home yet.</p>
        ) : (
          <dl className="mt-2 grid grid-cols-2 gap-2">
            {readings.map((h) => (
              <div key={h.k} className="rounded-lg bg-white/[0.05] px-2.5 py-2">
                <dt className="text-[10.5px] text-white/45">{h.label}</dt>
                <dd className="font-mono text-[17px] leading-tight text-white tabular">
                  {state.vitals[h.k]!.current.value}
                  <span className="ml-1 font-sans text-[10px] text-white/35">{h.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
