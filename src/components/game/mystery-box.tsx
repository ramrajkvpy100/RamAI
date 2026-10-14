"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { DoctorFigure } from "@/components/game/caricature";
import { RankBadge } from "@/components/game/rank-badge";
import { Icon } from "@/components/ui/icon";

/** What comes out of a box: a badge, or a new rank. */
export type Prize = { kind: "badge"; label: string; description: string } | { kind: "rank"; label: string; tier: number };

type Step = "drop" | "ready" | "opening" | "open";

const BURST = ["#fde047", "#f472b6", "#60a5fa", "#a78bfa", "#34d399", "#fb923c"];

/** The box itself: purple with a gold ribbon and a big "?" — its lid comes off separately. */
function Box({ lidOff }: { lidOff: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible drop-shadow-[0_24px_30px_rgb(0_0_0/0.45)]" aria-hidden>
      <defs>
        <linearGradient id="mb-body" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="mb-side" x1="0" x2="1">
          <stop offset="0" stopColor="#6d28d9" />
          <stop offset="1" stopColor="#3b0764" />
        </linearGradient>
        <linearGradient id="mb-gold" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Body */}
      <rect x="34" y="82" width="132" height="104" rx="10" fill="url(#mb-body)" />
      <rect x="34" y="82" width="22" height="104" rx="8" fill="url(#mb-side)" opacity="0.55" />
      <rect x="90" y="82" width="20" height="104" fill="url(#mb-gold)" />
      <text x="100" y="152" textAnchor="middle" fontSize="58" fontWeight="900" fill="#fff" stroke="#3b0764" strokeWidth="3" paintOrder="stroke" fontFamily="system-ui, sans-serif">
        ?
      </text>
      {/* Lid */}
      <g style={lidOff ? { animation: "mb-lid 650ms cubic-bezier(.2,.8,.3,1) both", transformOrigin: "100px 70px" } : undefined}>
        <rect x="26" y="62" width="148" height="28" rx="8" fill="url(#mb-body)" stroke="#3b0764" strokeOpacity="0.35" />
        <rect x="90" y="62" width="20" height="28" fill="url(#mb-gold)" />
        <path d="M100 62 C 80 30, 52 40, 66 58 C 74 66, 92 64, 100 62 Z" fill="url(#mb-gold)" stroke="#b45309" strokeWidth="2" />
        <path d="M100 62 C 120 30, 148 40, 134 58 C 126 66, 108 64, 100 62 Z" fill="url(#mb-gold)" stroke="#b45309" strokeWidth="2" />
        <circle cx="100" cy="61" r="7" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
      </g>
    </svg>
  );
}

function PrizeView({ prize }: { prize: Prize }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ animation: "mb-prize 700ms cubic-bezier(.2,1.4,.4,1) both" }}>
      {prize.kind === "rank" ? (
        <span className="relative">
          <DoctorFigure tier={prize.tier} size={132} className="rounded-full ring-4 ring-amber-300/70" />
          <RankBadge tier={prize.tier} size={40} className="absolute -right-2 -bottom-1" />
        </span>
      ) : (
        <span className="flex h-32 w-32 items-center justify-center rounded-full bg-[conic-gradient(from_200deg,#fde047,#f472b6,#a78bfa,#60a5fa,#34d399,#fde047)] p-1.5 shadow-[0_0_60px_rgb(253_224_71/0.55)]">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#1e1b4b] text-amber-300">
            <Icon name="award" size={58} />
          </span>
        </span>
      )}
      <div className="mt-5 text-[12px] font-bold tracking-[0.22em] text-amber-300 uppercase">{prize.kind === "rank" ? "Promoted!" : "Badge unlocked!"}</div>
      <div className="mt-1.5 text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-white">{prize.label}</div>
      {prize.kind === "badge" && <p className="mt-2 max-w-xs text-[14.5px] leading-6 text-white/75">{prize.description}</p>}
      {prize.kind === "rank" && <p className="mt-2 max-w-xs text-[14.5px] leading-6 text-white/75">A new rank — earned on your average across recent cases.</p>}
    </div>
  );
}

/**
 * New badges and promotions arrive in a mystery box, Subway Surfers style: it
 * drops in, shakes until tapped, bursts open, and the prize rises out. One box
 * per prize. Shown once per case (remembered under `storageKey`).
 */
export function MysteryBox({ prizes, storageKey }: { prizes: Prize[]; storageKey: string }) {
  const [index, setIndex] = useState(-1);
  const [step, setStep] = useState<Step>("drop");

  useEffect(() => {
    if (prizes.length === 0) return;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {}
    // A beat after the debrief appears, so the box lands on a settled page. Remembered once it's shown.
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {}
      setIndex(0);
    }, 900);
    return () => clearTimeout(t);
  }, [prizes.length, storageKey]);

  useEffect(() => {
    if (index < 0 || step !== "drop") return;
    const t = setTimeout(() => setStep("ready"), 900);
    return () => clearTimeout(t);
  }, [index, step]);

  useEffect(() => {
    if (step !== "opening") return;
    const t = setTimeout(() => setStep("open"), 620);
    return () => clearTimeout(t);
  }, [step]);

  if (index < 0 || index >= prizes.length) return null;
  const prize = prizes[index]!;
  const open = () => step === "ready" && setStep("opening");
  const next = () => {
    setStep("drop");
    setIndex((i) => i + 1);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={step === "open" ? `${prize.kind === "rank" ? "Promoted" : "Badge unlocked"}: ${prize.label}` : "A mystery box — tap to open"}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#4c1d95_0%,#1e1b4b_45%,#05030f_100%)] px-4"
      style={{ animation: "fade 240ms ease both" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setIndex(prizes.length);
      }}
    >
      {/* Light rays behind the box, turning. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[180vmax] w-[180vmax] -translate-x-1/2 -translate-y-1/2 opacity-30"
        style={{ background: "repeating-conic-gradient(from 0deg, rgb(253 224 71 / 0.55) 0deg 8deg, transparent 8deg 22deg)", animation: "mb-rays 18s linear infinite", maskImage: "radial-gradient(circle, black 0%, transparent 60%)" }}
      />
      {prizes.length > 1 && <div className="absolute top-6 text-[13px] font-semibold text-white/60 tabular">{`${index + 1} of ${prizes.length}`}</div>}

      <div className="relative flex h-[340px] w-full max-w-sm items-center justify-center">
        {step === "open" || step === "opening" ? (
          <>
            <span aria-hidden className="absolute h-40 w-40 rounded-full bg-amber-200" style={{ animation: "mb-burst 700ms ease-out both" }} />
            {BURST.flatMap((c, i) =>
              [0, 1, 2].map((j) => {
                const angle = ((i * 3 + j) / (BURST.length * 3)) * Math.PI * 2;
                return (
                  <span
                    key={`${i}-${j}`}
                    aria-hidden
                    className="absolute h-3 w-3 rounded-sm"
                    style={{ background: c, ["--dx" as string]: `${Math.cos(angle) * 220}px`, ["--dy" as string]: `${Math.sin(angle) * 220}px`, ["--rot" as string]: `${(i + j) * 140}deg`, animation: `confetti 1100ms cubic-bezier(.1,.7,.3,1) ${j * 60}ms both` }}
                  />
                );
              }),
            )}
            {step === "open" ? (
              <PrizeView prize={prize} />
            ) : (
              <div className="h-56 w-56" style={{ animation: "mb-charge 620ms ease-in both" }}>
                <Box lidOff />
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={open}
            disabled={step !== "ready"}
            aria-label="Open the mystery box"
            className="relative h-56 w-56 cursor-pointer outline-none"
            style={{ animation: step === "drop" ? "mb-drop 900ms cubic-bezier(.3,1.2,.5,1) both" : "mb-shake 1.1s ease-in-out infinite" }}
          >
            <span aria-hidden className="absolute inset-6 rounded-full bg-violet-400/40 blur-2xl" style={{ animation: "mb-glow 1.6s ease-in-out infinite" }} />
            <span className="relative block h-full w-full">
              <Box lidOff={false} />
            </span>
          </button>
        )}
      </div>

      <div className="relative mt-6 flex h-14 items-center justify-center">
        {step === "ready" && (
          <button type="button" onClick={open} className="animate-pulse rounded-full bg-amber-400 px-7 py-3 text-[16px] font-extrabold tracking-wide text-[#3b0764] shadow-[0_6px_0_#b45309] active:translate-y-1 active:shadow-[0_2px_0_#b45309]">
            TAP TO OPEN
          </button>
        )}
        {step === "open" && (
          <button type="button" onClick={next} autoFocus className="animate-enter rounded-full bg-white px-7 py-3 text-[15px] font-bold text-[#1e1b4b] shadow-[0_6px_0_rgb(255_255_255/0.35)] active:translate-y-1">
            {index + 1 < prizes.length ? "Next box" : "Collect"}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
