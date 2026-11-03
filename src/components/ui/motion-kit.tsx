"use client";

/**
 * The app's motion: springs loaded after the page is up (so animation never slows the first paint), and the small
 * pieces every screen shares. Everything honours the phone's reduced-motion setting.
 */
import { LazyMotion, MotionConfig, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

const features = () => import("motion/react").then((x) => x.domMax);

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={features}>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 34 }}>
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

/**
 * An answer option that feels like a real button: lifts on hover, gives under the finger, bounces when right, shakes when
 * wrong, and a small "+1" floats up from a right pick.
 */
export function AnswerButton({ state, picked = false, children, ...rest }: { state: "idle" | "right" | "wrong" | "other"; picked?: boolean; children: ReactNode } & Omit<ComponentProps<typeof m.button>, "children" | "animate">) {
  return (
    <m.button
      {...rest}
      whileHover={state === "idle" ? { y: -2 } : undefined}
      whileTap={state === "idle" ? { scale: 0.97 } : undefined}
      animate={state === "right" ? { scale: [1, 1.03, 1], x: 0 } : state === "wrong" ? { x: [0, -6, 6, -4, 4, 0], scale: 1 } : { scale: 1, x: 0 }}
      transition={state === "right" || state === "wrong" ? { duration: 0.32 } : { type: "spring", stiffness: 500, damping: 30 }}
      style={{ position: "relative", ...rest.style }}
    >
      {children}
      {state === "right" && picked && <span aria-hidden className="float-up absolute -top-2 right-3 rounded-full bg-success px-2 py-0.5 text-[12px] font-semibold text-white">+1 🔥</span>}
    </m.button>
  );
}

/** A number on a page counting up to its value as the page opens. */
export const CountIn = ({ value, className }: { value: string | number; className?: string }) => <AnimatedValue value={value} fromZero durationMs={800} className={className} />;

/** A pulse travelling along the bottom of the header, on every page. */
export function HeartbeatLine() {
  const beat = "h60l6-3 6 3h10l4 2 5-8 5 10 4-4h14l7-3 7 3h60";
  return (
    <svg aria-hidden viewBox="0 0 1200 12" preserveAspectRatio="none" className="heartbeat-line">
      <path d={`M0 7${beat.repeat(6)}`} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The background of whichever tab or chip is on: it slides across rather than jumping. The parent must be `relative`. */
export function SlidingPill({ id, className }: { id: string; className?: string }) {
  return <m.span layoutId={id} aria-hidden className={cn("absolute inset-0 -z-10", className)} transition={{ type: "spring", stiffness: 500, damping: 38 }} />;
}

/** Cards coming in one after another. */
export function Rise({ index = 0, children, className }: { index?: number; children: ReactNode; className?: string }) {
  return (
    <m.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 12) * 0.04 }} className={className}>
      {children}
    </m.div>
  );
}

/** A bar filling from nothing to its value, on the GPU (scale, not width). */
export function FillBar({ value, delay = 0, className }: { value: number; delay?: number; className?: string }) {
  return (
    <m.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
      transition={{ type: "spring", stiffness: 90, damping: 18, delay }}
      style={{ transformOrigin: "left center" }}
      className={cn("h-full w-full rounded-full", className)}
    />
  );
}

/** A clean shimmer of light across a card, for a great result. */
export function ShimmerBurst({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}>
      <m.span initial={{ x: "-120%", opacity: 0.9 }} animate={{ x: "120%", opacity: 0 }} transition={{ duration: 1.1, ease: "easeOut", delay: 0.35 }} className="absolute inset-y-0 w-2/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
    </span>
  );
}
