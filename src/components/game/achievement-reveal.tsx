"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { DoctorFigure } from "@/components/game/caricature";
import { RankBadge } from "@/components/game/rank-badge";
import { ShareSheet } from "@/components/share/share-sheet";
import { Icon } from "@/components/ui/icon";
import { playSfx } from "@/lib/sfx";

/** What is revealed: a badge, or a new rank. */
export type Prize = { kind: "badge"; id: string; label: string; description: string } | { kind: "rank"; label: string; tier: number };

const BURST = ["#fde047", "#f472b6", "#60a5fa", "#a78bfa", "#34d399", "#fb923c"];

/** A line to share an achievement with, and where it points. */
export function shareText(prize: Prize): string {
  return prize.kind === "rank" ? `I've been promoted to ${prize.label} on RamAI 🩺 — clinical cases where you're the doctor.` : `I unlocked the "${prize.label}" badge on RamAI 🏅 — ${prize.description}`;
}

/**
 * Shares an achievement as a picture — a card drawn on the server, with the doctor's name and
 * record — through the share sheet: as an image to WhatsApp Status, Instagram and the rest, a
 * download, or a link that previews as the card.
 */
export function SharePrize({ prize, open, onClose }: { prize: Prize; open: boolean; onClose: () => void }) {
  return <ShareSheet open={open} onClose={onClose} target={{ kind: "achievement", badge: prize.kind === "badge" ? prize.id : undefined }} title={prize.kind === "rank" ? "Share your promotion" : "Share your achievement"} text={shareText(prize)} />;
}

function PrizeArt({ prize }: { prize: Prize }) {
  return prize.kind === "rank" ? (
    <span className="relative">
      <DoctorFigure tier={prize.tier} size={150} className="rounded-full ring-4 ring-amber-300/80" />
      <RankBadge tier={prize.tier} size={44} className="absolute -right-2 -bottom-1" />
    </span>
  ) : (
    <span className="flex h-36 w-36 items-center justify-center rounded-full bg-[conic-gradient(from_200deg,#fde047,#f472b6,#a78bfa,#60a5fa,#34d399,#fde047)] p-1.5 shadow-[0_0_70px_rgb(253_224_71/0.6)]">
      <span className="flex h-full w-full items-center justify-center rounded-full bg-[#1e1b4b] text-amber-300">
        <Icon name="award" size={66} />
      </span>
    </span>
  );
}

/**
 * New badges and promotions burst onto the screen, Subway Surfers style — no box: light rays turn, the
 * prize flies in with a pop and confetti, a fanfare plays. One at a time; each can be shared.
 * Shown once per case (`storageKey`), or on demand (`prizes` with `storageKey` null, from the achievements page).
 */
export function AchievementReveal({ prizes, storageKey, onDone }: { prizes: Prize[]; storageKey: string | null; onDone?: () => void }) {
  const [index, setIndex] = useState(-1);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (prizes.length === 0) return;
    if (storageKey) {
      try {
        if (localStorage.getItem(storageKey)) return;
      } catch {}
    }
    const t = setTimeout(
      () => {
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, "1");
          } catch {}
        }
        setIndex(0);
      },
      storageKey ? 900 : 0,
    );
    return () => clearTimeout(t);
  }, [prizes.length, storageKey]);

  useEffect(() => {
    if (index < 0 || index >= prizes.length) return;
    setSharing(false);
    playSfx(prizes[index]!.kind === "rank" ? "levelup" : "reveal");
  }, [index, prizes]);

  if (index < 0 || index >= prizes.length) return null;
  const prize = prizes[index]!;
  const close = () => {
    setIndex(prizes.length);
    onDone?.();
  };
  const next = () => (index + 1 < prizes.length ? setIndex(index + 1) : close());

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${prize.kind === "rank" ? "Promoted" : "Badge unlocked"}: ${prize.label}`}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#5b21b6_0%,#1e1b4b_45%,#05030f_100%)] px-4"
      style={{ animation: "fade 220ms ease both" }}
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-[42%] left-1/2 h-[180vmax] w-[180vmax] -translate-x-1/2 -translate-y-1/2 opacity-35"
        style={{ background: "repeating-conic-gradient(from 0deg, rgb(253 224 71 / 0.55) 0deg 8deg, transparent 8deg 22deg)", animation: "mb-rays 16s linear infinite", maskImage: "radial-gradient(circle, black 0%, transparent 60%)" }}
      />
      {prizes.length > 1 && <div className="absolute top-6 text-[13px] font-semibold text-white/60 tabular">{`${index + 1} of ${prizes.length}`}</div>}

      <div key={index} className="relative flex flex-col items-center text-center">
        <span aria-hidden className="absolute top-16 h-40 w-40 rounded-full bg-amber-200" style={{ animation: "mb-burst 750ms ease-out both" }} />
        {BURST.flatMap((c, i) =>
          [0, 1, 2].map((j) => {
            const angle = ((i * 3 + j) / (BURST.length * 3)) * Math.PI * 2;
            return (
              <span
                key={`${i}-${j}`}
                aria-hidden
                className="absolute top-20 h-3 w-3 rounded-sm"
                style={{ background: c, ["--dx" as string]: `${Math.cos(angle) * 240}px`, ["--dy" as string]: `${Math.sin(angle) * 240}px`, ["--rot" as string]: `${(i + j) * 140}deg`, animation: `confetti 1200ms cubic-bezier(.1,.7,.3,1) ${120 + j * 60}ms both` }}
              />
            );
          }),
        )}
        <div style={{ animation: "mb-prize 750ms cubic-bezier(.2,1.5,.4,1) both" }} className="relative">
          <PrizeArt prize={prize} />
        </div>
        <div className="mt-6 text-[12px] font-bold tracking-[0.22em] text-amber-300 uppercase" style={{ animation: "rise 400ms 350ms ease both" }}>
          {prize.kind === "rank" ? "Promoted!" : "Achievement unlocked!"}
        </div>
        <div className="mt-1.5 text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-white" style={{ animation: "rise 400ms 420ms ease both" }}>
          {prize.label}
        </div>
        <p className="mt-2 max-w-xs text-[14.5px] leading-6 text-white/75" style={{ animation: "rise 400ms 480ms ease both" }}>
          {prize.kind === "badge" ? prize.description : "A new rank — earned on your average across recent cases."}
        </p>
      </div>

      <div className="relative mt-8 flex flex-col items-center gap-3" style={{ animation: "rise 400ms 600ms ease both" }}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="flex h-12 items-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-extrabold text-[#3b0764] shadow-[0_6px_0_#b45309] active:translate-y-1 active:shadow-[0_2px_0_#b45309]"
          >
            <Icon name="share-ios" size={16} /> Share card
          </button>
          <button type="button" onClick={next} autoFocus className="h-12 rounded-full bg-white px-6 text-[15px] font-bold text-[#1e1b4b] shadow-[0_6px_0_rgb(255_255_255/0.35)] active:translate-y-1">
            {index + 1 < prizes.length ? "Next" : "Collect"}
          </button>
        </div>
        <p className="text-[12.5px] text-white/60">Share it as a card — for your Status, Story or feed.</p>
      </div>
      <SharePrize prize={prize} open={sharing} onClose={() => setSharing(false)} />
    </div>,
    document.body,
  );
}
