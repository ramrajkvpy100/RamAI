"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * How far along something long probably is: quick at first, slowing as it
 * nears the end — never full until it's actually done, when it fills and fades.
 */
export function useFilling(active: boolean, expectedMs: number, delayMs = 0): { value: number; visible: boolean } {
  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      started.current = Date.now();
      // Quick things finish before the bar would even show.
      const show = window.setTimeout(() => {
        setValue(0.02);
        setVisible(true);
      }, delayMs);
      const timer = window.setInterval(() => {
        const t = (Date.now() - (started.current ?? Date.now())) / expectedMs;
        // 63% at the expected time, 86% at twice it — creeping towards 96%.
        setValue(Math.min(0.96, 1 - Math.exp(-t)));
      }, 120);
      return () => {
        window.clearTimeout(show);
        window.clearInterval(timer);
      };
    }
    if (started.current === null) return;
    started.current = null;
    setValue(1);
    const hide = window.setTimeout(() => {
      setVisible(false);
      setValue(0);
    }, 450);
    return () => window.clearTimeout(hide);
  }, [active, expectedMs, delayMs]);

  return { value, visible };
}

/** A thin bar that fills while something long is happening. */
export function FillingBar({ active, expectedMs = 8000, delayMs = 0, className, label = "Working…", tone = "accent" }: { active: boolean; expectedMs?: number; /** Wait this long before showing (quick work never flashes a bar). */ delayMs?: number; className?: string; label?: string; tone?: "accent" | "light" }) {
  const { value, visible } = useFilling(active, expectedMs, delayMs);
  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={cn("h-1 w-full overflow-hidden rounded-full transition-opacity duration-300", tone === "light" ? "bg-white/15" : "bg-surface-3", value >= 1 && "opacity-0", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-300 ease-out", tone === "light" ? "bg-white/80" : "bg-ai")} style={{ width: `${value * 100}%` }} />
    </div>
  );
}
