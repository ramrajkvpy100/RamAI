"use client";

import { useRef, useState } from "react";

import { STATUS_LABEL } from "@/lib/format";
import { success } from "@/lib/haptics";
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
  return (
    <div className="fixed inset-0 z-[60] flex animate-fade items-center justify-center bg-bg/85 px-5 backdrop-blur-xl">
      <div className={`w-full max-w-sm transition-all duration-500 ${breaking ? "scale-105 opacity-0" : ""}`}>
        <div className="relative overflow-hidden rounded-3xl border border-line bg-[linear-gradient(160deg,#fbf6ea,#efe4c8)] p-6 text-[#3b2f16] shadow-2xl dark:bg-[linear-gradient(160deg,#2a2416,#1d1910)] dark:text-[#f1e6c8]">
          <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-[repeating-linear-gradient(90deg,#c9b98f_0_8px,transparent_8px_14px)] opacity-60" />
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase opacity-70">Clinical chart · Case #{d.caseNumber}</p>
          <h2 className="mt-2 text-[22px] font-semibold">{patient}</h2>
          <p className="mt-1 text-[13.5px] opacity-75">Outcome, score and what you missed are inside.</p>
          <div className="relative mx-auto mt-6 flex h-24 w-24 items-center justify-center">
            <span className={`flex h-20 w-20 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#e2564b,#9e1f17)] text-[26px] text-white shadow-[0_6px_18px_rgb(120_20_10/0.45)] ${breaking ? "animate-seal" : ""}`} aria-hidden>
              ✚
            </span>
          </div>
          <p className="mt-2 text-center text-[12px] opacity-70">{STATUS_LABEL[d.finalStatus] ? "Sealed until you open it" : ""}</p>
        </div>
        {/* Slide to break the seal (a tap on the knob works too) */}
        <div ref={track} className="relative mt-4 h-14 overflow-hidden rounded-full bg-surface-3 select-none touch-none" role="slider" aria-label="Slide to break the seal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((x / max()) * 100)} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") && open()}>
          <span className="absolute inset-0 flex items-center justify-center pl-10 text-[14px] font-semibold text-fg-2">Slide to break the seal →</span>
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent/15" style={{ width: x + 56 }} />
          <button
            type="button"
            aria-label="Break the seal"
            onClick={() => x === 0 && open()}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = e.clientX - x; }}
            onPointerMove={(e) => { if (drag.current === null) return; setX(Math.max(0, Math.min(max(), e.clientX - drag.current))); }}
            onPointerUp={() => { drag.current = null; if (x > max() * 0.8) { setX(max()); open(); } else setX(0); }}
            className="absolute top-1 left-1 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[20px] text-on-accent shadow-md transition-[left] duration-75"
            style={{ transform: `translateX(${x}px)` }}
          >
            ✚
          </button>
        </div>
      </div>
    </div>
  );
}
