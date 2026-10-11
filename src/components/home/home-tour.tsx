"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * A quick tour of the home screen: each stop dims the page around one part
 * of it and says, in a sentence or two, what it's for. Shown once after the
 * first case (the demo), and any time from the account menu.
 */
export interface TourStop {
  /** Matches an element's data-tour attribute. */
  target: string;
  title: string;
  body: string;
}

const SEEN_KEY = "ramai.tour.home";
/** Asked for from elsewhere (the account menu): open it on the home screen. */
export const TOUR_EVENT = "ramai:tour";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {}
}

const elementFor = (stop: TourStop) => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`);
  const r = el?.getBoundingClientRect();
  return el && r && r.width > 0 && r.height > 0 ? el : null;
};

export function HomeTour({ stops, open, onClose }: { stops: TourStop[]; open: boolean; onClose: () => void }) {
  const [live, setLive] = useState<TourStop[]>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const next = useRef<HTMLButtonElement>(null);

  // Only the parts actually on screen for this player.
  useEffect(() => {
    if (!open) return;
    setLive(stops.filter((s) => elementFor(s)));
    setI(0);
  }, [open, stops]);

  const stop = live[i];
  const close = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);
  const go = useCallback((to: number) => (to >= live.length ? close() : setI(Math.max(0, to))), [live.length, close]);

  // Bring the part into view, then follow it while the page scrolls or resizes.
  useEffect(() => {
    if (!open || !stop) return;
    const el = elementFor(stop);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    let raf = 0;
    const track = () => {
      const r = el.getBoundingClientRect();
      setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height ? p : { top: r.top, left: r.left, width: r.width, height: r.height }));
      setView((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      raf = requestAnimationFrame(track);
    };
    track();
    next.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(raf);
  }, [open, stop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, i, go, close]);

  if (!open || !stop || !rect || typeof document === "undefined") return null;

  const pad = 8;
  const phone = view.w < 640;
  const below = view.h - (rect.top + rect.height) > rect.top;
  const cardW = Math.min(360, view.w - 32);
  const left = Math.min(Math.max(16, rect.left), view.w - cardW - 16);
  const last = i === live.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* The page stays visible but can't be clicked while the tour is open. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-[22px] transition-all duration-300 ease-out"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 2px var(--accent), 0 0 0 9999px rgb(6 8 20 / 0.58)",
        }}
      />
      <div
        className={cn("fixed animate-enter rounded-2xl border border-line bg-[var(--surface-solid)] p-4 shadow-xl", phone && "inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))]")}
        style={phone ? undefined : { width: cardW, left, ...(below ? { top: rect.top + rect.height + pad + 12 } : { bottom: view.h - rect.top + pad + 12 }) }}
        key={stop.target}
      >
        <div className="flex items-center gap-2">
          <span className="bg-ai flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white">
            <Icon name="sparkles" size={14} />
          </span>
          <h2 id="tour-title" className="text-[15px] font-semibold">
            {stop.title}
          </h2>
          <span className="ml-auto text-[11.5px] text-fg-3 tabular">
            {i + 1}/{live.length}
          </span>
        </div>
        <p className="mt-2 text-[13.5px] leading-6 text-fg-2">{stop.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={close} className="h-9 rounded-full px-2 text-[13px] font-medium text-fg-3 hover:text-fg">
            Skip tour
          </button>
          <span className="flex-1" />
          {i > 0 && (
            <button type="button" onClick={() => go(i - 1)} className="h-9 rounded-full px-3.5 text-[13px] font-medium text-fg-2 hover:bg-surface-3">
              Back
            </button>
          )}
          <button ref={next} type="button" onClick={() => go(i + 1)} className="bg-ai inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-white shadow-glow">
            {last ? "Done" : "Next"} {!last && <Icon name="arrow-right" size={13} />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
