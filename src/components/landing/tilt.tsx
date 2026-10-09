"use client";

import { useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Pointer-driven 3D tilt. Sets --rx/--ry on the wrapper; children opt in with
 * `[transform:rotateX(var(--rx))_rotateY(var(--ry))]`. Mouse only — touch
 * devices keep a still, readable layout.
 */
export function Tilt({ children, className, max = 10 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const set = (rx: number, ry: number) => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    });
  };
  return (
    <div
      ref={ref}
      className={cn("[perspective:1200px]", className)}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        set(-((e.clientY - r.top) / r.height - 0.5) * max, ((e.clientX - r.left) / r.width - 0.5) * max);
      }}
      onPointerLeave={() => set(0, 0)}
    >
      {children}
    </div>
  );
}
