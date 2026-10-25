"use client";

import { cn } from "@/lib/cn";

/** A short silent animation made with Remotion (video/), looping like a GIF — webm first, mp4 for Safari. */
export function LoopVideo({ name, className, loop = true, label }: { name: string; className?: string; loop?: boolean; label?: string }) {
  return (
    <video autoPlay muted loop={loop} playsInline preload="auto" aria-label={label} aria-hidden={label ? undefined : true} className={cn("pointer-events-none object-cover", className)}>
      <source src={`/anim/${name}.webm`} type="video/webm" />
      <source src={`/anim/${name}.mp4`} type="video/mp4" />
    </video>
  );
}
