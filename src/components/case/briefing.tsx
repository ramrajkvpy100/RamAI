"use client";

import Link from "next/link";
import { useEffect, type CSSProperties } from "react";

import { LogoTile } from "@/components/brand/wordmark";
import { FamilyFigure, PatientFigure } from "@/components/game/caricature";
import { Icon } from "@/components/ui/icon";
import { levelMeta, trackLabel } from "@/engine/levels";
import type { CaseState } from "@/engine/types";
import { cn } from "@/lib/cn";
import { caseLabel, clockAt } from "@/lib/format";

import { LangToggle } from "./lang-toggle";
import { figureSeed } from "./scene/figures";
import { tokenNumber } from "./scene/scene";

const RULES: Record<CaseState["track"], string> = {
  opd: "Everything you need is behind your own questions, examinations and orders. Nothing will be suggested.",
  phone: "You can't examine the patient or run tests on a call. Ask, advise, and decide where they should go.",
  emergency: "Everything you need is behind your own questions, examinations and orders. The clock is running.",
};

const KICKER: Record<CaseState["track"], string> = {
  opd: "Outpatient department",
  phone: "Incoming call",
  emergency: "Emergency department",
};

const CTA: Record<CaseState["track"], string> = {
  opd: "Call the patient in",
  phone: "Answer the call",
  emergency: "See the patient",
};

function Visual({ state }: { state: CaseState }) {
  const seed = figureSeed(state);
  if (state.track === "phone") {
    return (
      <div className="relative mx-auto flex h-28 w-28 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 animate-[ring-out_2.2s_ease-out_infinite] rounded-full bg-emerald-400/30" />
        <span className="absolute inset-0 animate-[ring-out_2.2s_ease-out_1.1s_infinite] rounded-full bg-emerald-400/20" />
        <span className="relative animate-[wiggle_1.1s_ease-in-out_infinite] rounded-full bg-surface shadow-[0_12px_40px_-12px_rgb(16_185_129/0.8)] ring-4 ring-emerald-500">
          <FamilyFigure seed={seed} patientStatus={state.patientStatus} onPhone size={84} />
        </span>
        <span className="absolute -right-1 bottom-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-bg">
          <Icon name="phone" size={15} strokeWidth={2} />
        </span>
      </div>
    );
  }
  if (state.track === "opd") {
    return (
      <div className="mx-auto flex items-center justify-center gap-4" aria-hidden>
        <span className="rounded-full bg-surface p-1 shadow-md ring-1 ring-line">
          <PatientFigure patient={state.patient} status={state.patientStatus} seed={seed} size={76} />
        </span>
        <div className="inline-flex flex-col items-center rounded-2xl bg-[#0b0f17] px-6 py-3.5 ring-1 ring-black/10">
          <span className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.2em] text-amber-300/80 uppercase">
            <span className="h-1.5 w-1.5 animate-[blink_1s_steps(2,start)_infinite] rounded-full bg-amber-300" />
            Now calling
          </span>
          <span className="mt-1 font-mono text-[48px] leading-none font-semibold tracking-[0.06em] text-amber-300 tabular [text-shadow:0_0_18px_rgb(252_211_77/0.45)]">
            {String(tokenNumber(state)).padStart(3, "0")}
          </span>
          <span className="mt-1 text-[10.5px] font-medium tracking-[0.18em] text-white/45 uppercase">Token</span>
        </div>
      </div>
    );
  }
  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center" aria-hidden>
      <span className="absolute inset-1 animate-[siren-on_1.2s_linear_infinite] rounded-full shadow-[0_0_0_10px_rgb(239_68_68/0.28),0_0_46px_6px_rgb(239_68_68/0.45)]" />
      <span className="absolute inset-1 animate-[siren-off_1.2s_linear_infinite] rounded-full shadow-[0_0_0_10px_rgb(59_130_246/0.28),0_0_46px_6px_rgb(59_130_246/0.45)]" />
      <span className="relative rounded-full bg-surface ring-1 ring-line">
        <PatientFigure patient={state.patient} status={state.patientStatus} seed={seed} size={92} />
      </span>
    </div>
  );
}

/** A short, mode-specific arrival before the encounter. Enter begins. Follows the light/dark theme. */
export function Briefing({ state, onBegin }: { state: CaseState; onBegin: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) onBegin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBegin]);

  const glow =
    state.track === "phone"
      ? "radial-gradient(60% 50% at 50% 34%, rgb(16 185 129 / 0.2), transparent 70%)"
      : state.track === "opd"
        ? "radial-gradient(60% 50% at 50% 34%, rgb(37 99 235 / 0.18), transparent 70%), radial-gradient(40% 40% at 80% 90%, rgb(6 182 212 / 0.12), transparent 70%)"
        : "radial-gradient(45% 40% at 32% 28%, rgb(239 68 68 / 0.16), transparent 70%), radial-gradient(45% 40% at 68% 28%, rgb(59 130 246 / 0.16), transparent 70%)";

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-bg text-fg">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: glow }} />
      <div aria-hidden className="grid-fade pointer-events-none absolute inset-0 -z-10" />

      <header className="flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="RamAI — home" className="rounded-lg">
          <LogoTile size={28} />
        </Link>
        <div className="flex min-w-0 items-center gap-2 truncate text-[12.5px] text-fg-2">
          <span className="font-semibold text-fg tabular">{caseLabel(state.caseNumber)}</span>
          <span>·</span>
          <span>{trackLabel(state.track, state.country)}</span>
          <span className="hidden sm:inline">· {levelMeta(state.level, state.country).label}</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <div className="w-full max-w-xl animate-rise text-center">
          <Visual state={state} />
          {state.guided && (
            <p className="mx-auto mt-7 flex w-fit animate-pop items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-semibold text-accent-text">
              <Icon name="sparkles" size={14} /> Guided case — tips will walk you through it
            </p>
          )}
          <p className={cn("text-[12px] font-semibold tracking-[0.16em] text-fg-3 uppercase", state.guided ? "mt-4" : "mt-8")}>
            <span className="tabular">{clockAt(state.arrivalMinuteOfDay, 0)}</span> · {KICKER[state.track]}
          </p>
          <h1 className="mt-3 text-[25px] leading-[1.3] font-semibold tracking-[-0.02em] text-balance sm:text-[31px]">{state.briefing.replace(/^\d{1,2}:\d{2}\.\s*/, "")}</h1>
          <p className="mx-auto mt-4 max-w-md text-[14px] leading-6 text-fg-2">{RULES[state.track]}</p>
          <button
            type="button"
            onClick={onBegin}
            autoFocus
            className={cn(
              "mt-9 inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-transform active:scale-[0.98]",
              state.track === "phone" ? "bg-emerald-500 text-white shadow-[0_12px_36px_-12px_rgb(16_185_129/0.9)] hover:bg-emerald-400" : "bg-fg text-bg hover:opacity-90",
            )}
          >
            {CTA[state.track]}
            <Icon name="arrow-right" size={16} />
          </button>
          <div className="mt-5 flex items-center justify-center gap-2 text-[12.5px] text-fg-3">
            <span>{state.track === "phone" ? "The family speaks" : "The patient speaks"}</span>
            <LangToggle value={state.lang} country={state.country} />
          </div>
        </div>
      </main>

      {state.track === "emergency" && (
        <svg viewBox="0 0 1200 60" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-8 h-14 w-full opacity-60" aria-hidden>
          <path
            d="M0 34 H120 l8 -6 8 6 H170 l6 8 10 -36 10 44 8 -16 H260 l10 -8 10 8 H420 l8 -6 8 6 H470 l6 8 10 -36 10 44 8 -16 H560 l10 -8 10 8 H720 l8 -6 8 6 H770 l6 8 10 -36 10 44 8 -16 H860 l10 -8 10 8 H1020 l8 -6 8 6 H1070 l6 8 10 -36 10 44 8 -16 H1160 l10 -8 10 8 H1200"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="1500"
            className="animate-[trace_3.2s_linear_infinite]"
            style={{ "--len": 1500 } as CSSProperties}
          />
        </svg>
      )}
    </div>
  );
}
