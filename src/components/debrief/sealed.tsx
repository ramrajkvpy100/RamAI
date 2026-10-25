"use client";

import { useRef, useState } from "react";

import { success, tap } from "@/lib/haptics";
import { playSfx } from "@/lib/sfx";
import type { CaseDebrief } from "@/engine/types";

/** The tier a score earns — plain clinical grades, not game ranks. */
export function tierFor(score: number) {
  return score >= 90 ? { label: "Consultant level", tone: "from-amber-300 to-yellow-500" } : score >= 75 ? { label: "Registrar level", tone: "from-sky-400 to-indigo-500" } : score >= 60 ? { label: "Resident level", tone: "from-emerald-400 to-teal-500" } : { label: "Intern level", tone: "from-slate-400 to-slate-500" };
}

/**
 * The debrief arrives as a sealed patient chart: slide to break the seal, and the result is revealed — with a
 * gentle sound and a haptic tap. Opened once per case.
 */
export function SealedDebrief({ d, patient, onOpen }: { d: CaseDebrief; patient: string; onOpen: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [breaking, setBreaking] = useState(false);
  const drag = useRef<number | null>(null);
  const max = () => (track.current ? track.current.clientWidth - 56 : 240);
  const open = () => {
    setBreaking(true);
    success();
    playSfx("reveal");
    window.setTimeout(onOpen, 480);
  };
  const initials = patient.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="fixed inset-0 z-[60] flex animate-fade items-center justify-center bg-[radial-gradient(120%_80%_at_50%_30%,#2b2112_0%,#0b0906_70%)] px-5">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/4 mx-auto h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
      <div className={`relative w-full max-w-sm transition-all duration-500 ${breaking ? "scale-[1.04] opacity-0 blur-sm" : "animate-rise"}`}>
        {/* A tap anywhere on the chart opens it too — never stuck if the slide doesn't take on a phone. */}
        <button type="button" aria-label="Open the debrief" onClick={() => !breaking && open()} className="absolute inset-x-0 top-0 bottom-24 z-10" />
        {/* The folder tab */}
        <div className="ml-6 h-7 w-32 rounded-t-xl bg-[#d9b979] shadow-inner" />
        <div className="relative overflow-hidden rounded-[22px] rounded-tl-none bg-[linear-gradient(165deg,#e8cf95_0%,#d4b06a_55%,#c49a52_100%)] p-6 text-[#3a2a10] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.5)]">
          <div aria-hidden className="absolute inset-0 opacity-[0.12] [background:repeating-linear-gradient(115deg,#000_0_1px,transparent_1px_6px)]" />
          <div aria-hidden className="shine-sweep pointer-events-none absolute inset-0" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10.5px] font-bold tracking-[0.28em] uppercase opacity-70">Confidential · Patient chart</p>
              <h2 className="mt-2 text-[24px] leading-tight font-semibold">{patient}</h2>
              <p className="mt-0.5 text-[13px] opacity-75">Case #{d.caseNumber} · {d.specialty}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#3a2a10]/40 text-[14px] font-bold">{initials}</span>
          </div>
          <div className="relative mt-5 space-y-1.5 opacity-60" aria-hidden>
            {[90, 72, 84, 60].map((w, i) => <div key={i} className="h-2 rounded-full bg-[#3a2a10]/25" style={{ width: `${w}%` }} />)}
          </div>
          {/* The wax seal */}
          <div className="relative mx-auto mt-6 flex h-28 w-28 items-center justify-center">
            <span aria-hidden className="absolute inset-0 animate-breathe rounded-full bg-red-700/30 blur-xl" />
            <span className={`relative flex h-24 w-24 items-center justify-center rounded-[46%_54%_50%_50%/52%_48%_52%_48%] bg-[radial-gradient(circle_at_35%_30%,#e2564b,#8e1a12_70%)] shadow-[0_8px_20px_rgba(110,15,5,0.55),inset_0_-4px_8px_rgba(0,0,0,0.35),inset_0_3px_6px_rgba(255,255,255,0.25)] ${breaking ? "animate-seal" : ""}`} aria-hidden>
              <svg viewBox="0 0 48 48" className="h-12 w-12 text-[#ffd9cf]/90" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M24 6v36" /><path d="M17 13c0-3 3-5 7-5s7 2 7 5-3 5-7 5-7 2-7 5 3 5 7 5 7 2 7 5-3 5-7 5" /><path d="M14 8l-4-3M34 8l4-3" />
              </svg>
            </span>
          </div>
          <p className="relative mt-3 text-center text-[12.5px] font-medium opacity-70">Your score, the outcome and what you missed — slide or tap</p>
        </div>
        {/* Slide to break the seal (a tap on the knob works too) */}
        <div ref={track} className="relative mt-5 h-16 overflow-hidden rounded-full border border-amber-200/20 bg-white/5 select-none touch-none" role="slider" aria-label="Slide to break the seal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((x / max()) * 100)} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") && open()}>
          <span className="shine-text absolute inset-0 flex items-center justify-center pl-12 text-[14.5px] font-semibold text-amber-100/80">Slide to break the seal</span>
          <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400/40 to-amber-300/10" style={{ width: x + 60 }} />
          <button
            type="button"
            aria-label="Break the seal"
            onClick={() => x === 0 && open()}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = e.clientX - x; tap(); }}
            onPointerMove={(e) => { if (drag.current === null) return; setX(Math.max(0, Math.min(max(), e.clientX - drag.current))); }}
            onPointerUp={() => { drag.current = null; if (x > max() * 0.6) { setX(max()); open(); } else setX(0); }}
            onPointerCancel={() => { drag.current = null; if (x > max() * 0.4) { setX(max()); open(); } else setX(0); }}
            className="absolute top-1.5 left-1.5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[linear-gradient(145deg,#f6d98a,#c9962f)] text-[22px] text-[#3a2a10] shadow-[0_6px_16px_rgba(201,150,47,0.5)] transition-[left] duration-75"
            style={{ transform: `translateX(${x}px)` }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
