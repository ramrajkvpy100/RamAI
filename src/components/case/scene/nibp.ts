"use client";

/**
 * The cuff measurement on the bedside monitor. A new NIBP reading isn't just
 * shown: the cuff pumps up past systolic, bleeds down in steps until the
 * oscillations fade below diastolic, and only then does the number appear —
 * about seven seconds, like a real monitor. Every view of the monitor shows
 * the same measurement in step.
 */
import { useEffect, useState } from "react";

import type { CaseState } from "@/engine/types";
import { nibpDone } from "@/lib/monitor-audio";

const INFLATE_MS = 2200;
const DEFLATE_MS = 5000;
const STEP_MMHG = 6;

/** When each reading started measuring on this device (performance.now). */
const started = new Map<string, number>();
/** Sessions whose monitor has been on screen: readings that arrive after that are measured live. */
const shown = new Set<string>();

export interface NibpView {
  measuring: boolean;
  /** Cuff pressure while measuring, mmHg. */
  cuff: number | null;
  /** "inflating" | "deflating" while measuring. */
  phase: "inflating" | "deflating" | null;
}

const IDLE: NibpView = { measuring: false, cuff: null, phase: null };

function parse(value: string | undefined) {
  const m = value?.match(/^(\d+)\s*\/\s*(\d+)/);
  return m ? { sys: Number(m[1]), dia: Number(m[2]) } : null;
}

function viewAt(elapsed: number, sys: number, dia: number): NibpView {
  const peak = Math.min(250, Math.max(150, sys + 30));
  if (elapsed < INFLATE_MS) {
    const t = elapsed / INFLATE_MS;
    return { measuring: true, phase: "inflating", cuff: Math.round(peak * (1 - (1 - t) ** 2)) };
  }
  const t = Math.min(1, (elapsed - INFLATE_MS) / DEFLATE_MS);
  const floor = Math.max(20, dia - 15);
  const raw = peak - (peak - floor) * t;
  return { measuring: true, phase: "deflating", cuff: Math.max(floor, Math.round(raw / STEP_MMHG) * STEP_MMHG) };
}

export function useNibp(state: CaseState): NibpView {
  const reading = state.vitals.bp?.current;
  const bp = parse(reading?.value);
  const key = reading && state.monitored ? `${state.sessionId}:${reading.at}:${reading.value}` : null;
  const [, tick] = useState(0);

  if (key && !started.has(key)) {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A reading already there when the monitor first appears is complete (no replay on reload); later ones are measured live.
    started.set(key, shown.has(state.sessionId) && !reduce ? performance.now() : -Infinity);
  }
  const sid = state.sessionId;
  useEffect(() => {
    shown.add(sid);
  }, [sid]);

  const start = key ? started.get(key)! : -Infinity;
  const elapsed = Number.isFinite(start) ? performance.now() - start : Infinity;
  const running = !!bp && elapsed < INFLATE_MS + DEFLATE_MS;

  useEffect(() => {
    if (!running || !key) return;
    let raf = 0;
    const loop = () => {
      tick((n) => n + 1);
      if (performance.now() - start < INFLATE_MS + DEFLATE_MS) raf = requestAnimationFrame(loop);
      else nibpDone(key);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, key, start]);

  return running && bp ? viewAt(elapsed, bp.sys, bp.dia) : IDLE;
}
