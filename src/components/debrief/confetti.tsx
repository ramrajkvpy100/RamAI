"use client";

import { useMemo, type CSSProperties } from "react";

import { prngFrom } from "@/lib/prng";

const COLORS = ["#7c3aed", "#2563eb", "#06b6d4", "#f97316", "#fbbf24", "#10b981", "#ec4899"];

/** A one-shot CSS confetti burst — skipped entirely under reduced motion. */
export function Confetti({ seed }: { seed: number }) {
  const pieces = useMemo(() => {
    const rnd = prngFrom(seed);
    return Array.from({ length: 44 }, (_, i) => {
      const angle = rnd() * Math.PI * 2;
      const dist = 140 + rnd() * 260;
      return {
        i,
        left: 50 + (rnd() - 0.5) * 18,
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist * 0.75 + 120}px`,
        rot: `${(rnd() - 0.5) * 900}deg`,
        delay: `${rnd() * 160}ms`,
        color: COLORS[i % COLORS.length],
        w: 6 + rnd() * 5,
        h: 9 + rnd() * 7,
      };
    });
  }, [seed]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0 motion-reduce:hidden">
      {pieces.map((p) => (
        <span
          key={p.i}
          className="absolute top-0 rounded-[2px] opacity-0"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              "--dx": p.dx,
              "--dy": p.dy,
              "--rot": p.rot,
              animation: `confetti 1600ms cubic-bezier(0.2, 0.7, 0.3, 1) ${p.delay} both`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
