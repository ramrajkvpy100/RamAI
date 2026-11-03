"use client";

/**
 * RamAI's motion system: three curves, used everywhere (in CSS as --spring-snappy, --spring-smooth and --ease-out-soft; the
 * global press and hover are in globals.css), and the few pieces that need more than a class. No animation library: browsers
 * run these natively, so motion adds nothing to what a phone downloads. Only transform and opacity move, and everything
 * honours the phone's reduced-motion setting.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/** How long each spring takes to settle (its curve lives in globals.css). */
export const SPRING_SNAPPY_MS = 325;
export const SPRING_SMOOTH_MS = 430;

export type Trend = "better" | "worse" | null;

const NUMBER = /-?\d+(?:\.\d+)?/g;
const decimals = (s: string) => (s.includes(".") ? s.length - s.indexOf(".") - 1 : 0);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
export function AnimatedValue({ value, trend = null, durationMs = 400, className }: { value: string | number; trend?: Trend; durationMs?: number; className?: string }) {
  const target = String(value);
  const [shown, setShown] = useState(target);
  const [flash, setFlash] = useState<{ tone: Trend; n: number }>({ tone: null, n: 0 });
  const last = useRef(target);
  useEffect(() => {
    const from = last.current;
    last.current = target;
    if (from === target) return;
    if (trend) setFlash((f) => ({ tone: trend, n: f.n + 1 }));
    if (reducedMotion() || (from.match(NUMBER)?.length ?? 0) !== (target.match(NUMBER)?.length ?? 0)) {
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
  }, [target, trend, durationMs]);
  return (
    <span className={cn("relative inline-block", className)}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{target}</span>
      {flash.tone && <span key={flash.n} aria-hidden className={cn("vital-flash", flash.tone === "better" ? "vital-flash-better" : "vital-flash-worse")} />}
    </span>
  );
}

/** Where each row's pill last was, so the next one can slide in from there. */
const lastPill = new Map<string, DOMRect>();

/**
 * The background of whichever tab or chip is on: it slides across rather than jumping. One is drawn per row (give them the same
 * id); the new one starts where the old one was. The parent must be `relative isolate`.
 */
export function SlidingPill({ id, className }: { id: string; className?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const to = node.getBoundingClientRect();
    const from = lastPill.get(id);
    lastPill.set(id, to);
    if (from && to.width && from.width && !reducedMotion() && (from.left !== to.left || from.top !== to.top)) {
      node.animate(
        [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` }, { transform: "none" }],
        { duration: SPRING_SMOOTH_MS, easing: getComputedStyle(node).getPropertyValue("--spring-smooth") || "ease-out" },
      );
    }
    return () => {
      const now = node.getBoundingClientRect();
      if (now.width) lastPill.set(id, now);
    };
  }, [id]);
  return <span ref={el} aria-hidden style={{ transformOrigin: "top left" }} className={cn("absolute inset-0 -z-10", className)} />;
}

/** An answer option: gives under the finger, confirms when right, a short shake when wrong. */
export function AnswerButton({ state, picked: _picked, children, className, ...rest }: { state: "idle" | "right" | "wrong" | "other"; picked?: boolean; children: ReactNode } & ComponentProps<"button">) {
  return (
    <button {...rest} className={cn(className, state === "right" && "answer-right", state === "wrong" && "answer-wrong")}>
      {children}
    </button>
  );
}

/** A bar filling from nothing to its value, on the GPU (scale, not width). */
export function FillBar({ value, delay = 0, className }: { value: number; delay?: number; className?: string }) {
  return <div style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})`, animationDelay: `${delay}s` } as CSSProperties} className={cn("fill-bar h-full w-full rounded-full", className)} />;
}
