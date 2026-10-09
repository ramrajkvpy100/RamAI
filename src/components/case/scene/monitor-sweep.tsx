"use client";

/**
 * A bedside-monitor sweep on canvas: lead II ECG, SpO₂ pleth and respiration,
 * drawn left to right with an erase bar from the encounter's live signal, so a
 * change in rate shows from the next beat — never as a restart. Pauses
 * off-screen; a still trace under reduced motion.
 */
import { useEffect, useRef } from "react";

import { MonitorSignal } from "./monitor-signal";

const COLORS = { ecg: "#4ade80", pleth: "#38bdf8", resp: "#fcd34d" } as const;
type LaneKind = keyof typeof COLORS;

/** Share of the height for each trace: the ECG gets the most. */
const SHARE: Record<LaneKind, number> = { ecg: 0.46, pleth: 0.27, resp: 0.27 };

interface Lane {
  kind: LaneKind;
  top: number;
  height: number;
}

const sample = (signal: MonitorSignal, kind: LaneKind, t: number) => (kind === "ecg" ? signal.ecg(t) : kind === "pleth" ? signal.pleth(t) : signal.resp(t));

function yOf(lane: Lane, v: number) {
  if (lane.kind === "ecg") return lane.top + lane.height * 0.6 - v * lane.height * 0.38;
  if (lane.kind === "pleth") return lane.top + lane.height - 3 - v * (lane.height - 6) * 0.82;
  return lane.top + lane.height - 4 - v * (lane.height - 8) * 0.8;
}

export function MonitorSweep({
  signal,
  running,
  pleth = true,
  resp = false,
  speed = 56,
  onBeat,
  className,
}: {
  signal: MonitorSignal;
  /** False when the monitor isn't attached: flat, dim lines. */
  running: boolean;
  pleth?: boolean;
  resp?: boolean;
  /** Pixels per second. */
  speed?: number;
  onBeat?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const beatRef = useRef(onBeat);
  beatRef.current = onBeat;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kinds: LaneKind[] = ["ecg", ...(pleth ? (["pleth"] as const) : []), ...(resp ? (["resp"] as const) : [])];
    let lanes: Lane[] = [];
    let w = 0;
    let h = 0;
    let x = 0;
    let prev: number[] | null = null;
    let last = performance.now();
    let raf = 0;
    let visible = true;

    const layout = () => {
      const total = kinds.reduce((sum, k) => sum + SHARE[k], 0);
      let top = 0;
      lanes = kinds.map((kind) => {
        const height = (h * SHARE[kind]) / total;
        const lane = { kind, top, height };
        top += height;
        return lane;
      });
    };

    const flat = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const lane of lanes) {
        const y = yOf(lane, 0);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    };

    // A monitor screen is never blank: a screenful of trace at the current rates, then the sweep writes over it.
    const still = () => {
      ctx.clearRect(0, 0, w, h);
      const ghost = signal.preview(w / speed);
      for (const lane of lanes) {
        ctx.strokeStyle = COLORS[lane.kind];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let px = 0; px <= w; px++) {
          const y = yOf(lane, sample(ghost, lane.kind, px / speed));
          if (px === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
      }
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      x = 0;
      prev = null;
      if (running) still();
      else flat();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // One shared clock: every view of the monitor shows the same beats.
      const t1 = now / 1000;
      const t0 = t1 - dt;
      signal.advanceTo(t1);
      if (beatRef.current) for (let n = signal.qrsBetween(t0, t1); n > 0; n--) beatRef.current();
      const dx = dt * speed;
      ctx.clearRect(x, 0, dx + 14, h);
      if (x + dx > w) ctx.clearRect(0, 0, x + dx - w + 14, h);
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      const steps = Math.max(1, Math.ceil(dx));
      lanes.forEach((lane, i) => {
        ctx.strokeStyle = COLORS[lane.kind];
        ctx.beginPath();
        let started = false;
        if (prev) {
          ctx.moveTo(x, prev[i]!);
          started = true;
        }
        for (let s = 1; s <= steps; s++) {
          const px = x + (dx * s) / steps;
          if (px > w) break;
          const y = yOf(lane, sample(signal, lane.kind, t0 + (dt * s) / steps));
          if (!started) {
            ctx.moveTo(px, y);
            started = true;
          } else ctx.lineTo(px, y);
        }
        ctx.stroke();
      });
      x += dx;
      if (x > w) {
        x = 0;
        prev = null;
      } else {
        prev = lanes.map((lane) => yOf(lane, sample(signal, lane.kind, t1)));
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf && running && !reduce) {
        last = performance.now();
        prev = null;
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) start();
    });
    io.observe(canvas);
    const onVis = () => !document.hidden && start();
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [signal, running, pleth, resp, speed]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
