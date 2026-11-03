"use client";

/**
 * RamAI's motion system: three curves, used everywhere, and the few pieces that need more than CSS (the global press and
 * hover are in globals.css). Springs load after the page is up, so motion never slows the first paint; only transform and
 * opacity move; everything honours the phone's reduced-motion setting.
 */
import { LazyMotion, MotionConfig, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Buttons, answer options, chips, toggles, nav icons. */
export const SPRING_SNAPPY = { type: "spring", stiffness: 500, damping: 32, mass: 0.8 } as const;
/** Sliding pills, drawers, sheets, cards changing place. */
export const SPRING_SMOOTH = { type: "spring", stiffness: 320, damping: 28, mass: 0.9 } as const;
/** Page changes, chat bubbles, reports, modals. (The same curve is --ease-out-soft in CSS.) */
export const EASE_OUT_EXPO = { duration: 0.22, ease: [0.16, 1, 0.3, 1] } as const;

// (layoutId needs domMax rather than domAnimation; it's loaded in its own chunk, after the page is interactive.)
const features = () => import("motion/react").then((x) => x.domMax);

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={features}>
      <MotionConfig reducedMotion="user" transition={SPRING_SMOOTH}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

export type Trend = "better" | "worse" | null;

const NUMBER = /-?\d+(?:\.\d+)?/g;
const decimals = (s: string) => (s.includes(".") ? s.length - s.indexOf(".") - 1 : 0);

/** Text with its numbers rolled part of the way from one value to another: "90/60" → "118/74". */
function rolled(from: string, to: string, t: number): string {
  const was = from.match(NUMBER) ?? [];
  let i = 0;
  return to.replace(NUMBER, (now) => {
    const start = was[i++];
    if (start === undefined) return now;
    return (Number(start) + (Number(now) - Number(start)) * t).toFixed(decimals(now));
  });
}

/**
 * A number that rolls from its old value to its new one (400 ms), with a brief flash: emerald for better, amber for worse.
 * Handles "120/80" and "98.6". Screen readers get the final value only.
 */
export function AnimatedValue({ value, trend = null, durationMs = 400, fromZero = false, className }: { value: string | number; trend?: Trend; durationMs?: number; fromZero?: boolean; className?: string }) {
  const target = String(value);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const [flash, setFlash] = useState<{ tone: Trend; n: number }>({ tone: null, n: 0 });
  // (Counting up from nothing starts after the first paint, so the server's copy and the phone's match.)
  const last = useRef(fromZero ? target.replace(NUMBER, "0") : target);
  useEffect(() => {
    const from = last.current;
    last.current = target;
    if (from === target) return;
    if (trend) setFlash((f) => ({ tone: trend, n: f.n + 1 }));
    if (reduced || (from.match(NUMBER)?.length ?? 0) !== (target.match(NUMBER)?.length ?? 0)) {
      setShown(target);
      return;
    }
    let raf = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / durationMs);
      setShown(t >= 1 ? target : rolled(from, target, 1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, trend, durationMs, reduced]);
  return (
    <span className={cn("relative inline-block", className)}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{target}</span>
      {flash.tone && <span key={flash.n} aria-hidden className={cn("vital-flash", flash.tone === "better" ? "vital-flash-better" : "vital-flash-worse")} />}
    </span>
  );
}

/** An answer option: gives under the finger, confirms when right, a short shake when wrong. */
export function AnswerButton({ state, picked: _picked, children, ...rest }: { state: "idle" | "right" | "wrong" | "other"; picked?: boolean; children: ReactNode } & Omit<ComponentProps<typeof m.button>, "children" | "animate">) {
  return (
    <m.button
      {...rest}
      animate={state === "right" ? { scale: [1, 1.02, 1], x: 0 } : state === "wrong" ? { x: [0, -5, 5, -3, 3, 0], scale: 1 } : { scale: 1, x: 0 }}
      transition={state === "right" || state === "wrong" ? { duration: 0.28, ease: [0.16, 1, 0.3, 1] } : SPRING_SNAPPY}
    >
      {children}
    </m.button>
  );
}

/** The background of whichever tab or chip is on: it slides across rather than jumping. The parent must be `relative isolate`. */
export function SlidingPill({ id, className }: { id: string; className?: string }) {
  return <m.span layoutId={id} aria-hidden className={cn("absolute inset-0 -z-10", className)} transition={SPRING_SMOOTH} />;
}

/** A bar filling from nothing to its value, on the GPU (scale, not width). */
export function FillBar({ value, delay = 0, className }: { value: number; delay?: number; className?: string }) {
  return (
    <m.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
      transition={{ ...SPRING_SMOOTH, delay }}
      style={{ transformOrigin: "left center" }}
      className={cn("h-full w-full rounded-full", className)}
    />
  );
}

