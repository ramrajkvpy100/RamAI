"use client";

import { useEffect, useState } from "react";

import { AvatarFace } from "@/components/game/avatar-face";
import { useMe } from "@/lib/me-store";

/** Your doctor's look for the level pictures: chosen on the profile, or (until chosen) guessed from your avatar's hair. */
export type Look = "m" | "f";
const KEY = "ramai.doctor.look";
const subs = new Set<() => void>();
export function setLook(l: Look) {
  try { localStorage.setItem(KEY, l); } catch {}
  subs.forEach((f) => f());
}
export function useLook(): Look {
  const me = useMe();
  const guess: Look = me?.avatar && ["long", "bun", "hijab"].includes(me.avatar.hair) ? "f" : "m";
  const [chosen, setChosen] = useState<Look | null>(null);
  useEffect(() => {
    const f = () => { try { const v = localStorage.getItem(KEY); setChosen(v === "f" || v === "m" ? v : null); } catch {} };
    f();
    subs.add(f);
    return () => void subs.delete(f);
  }, []);
  return chosen ?? guess;
}

/** Each level's colour — the ring around your avatar shows how far you've come. */
export const LEVEL_RING = ["#94a3b8", "#60a5fa", "#22d3ee", "#34d399", "#a3e635", "#facc15", "#fb923c", "#f472b6", "#a78bfa", "#fbbf24"];

/**
 * "Your doctor": your own avatar, framed in your level's colour with its number — or, without an avatar, the level's
 * portrait (male or female). `portrait` always shows the portrait (the level ladder).
 */
export function MyDoctor({ tier, size, className, title, portrait = false }: { tier: number; size: number; className?: string; title: string; portrait?: boolean }) {
  const me = useMe();
  const look = useLook();
  const t = Math.max(1, Math.min(10, Math.round(tier)));
  if (!portrait && me?.avatar) {
    const ring = LEVEL_RING[t - 1]!;
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className ?? ""}`} style={{ width: size, height: size, background: `conic-gradient(${ring} ${t * 10}%, rgb(255 255 255 / 0.22) 0)`, padding: Math.max(2, size * 0.05) }} title={title} role="img" aria-label={title}>
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
          <AvatarFace style={me.avatar} size={size * 0.9} tier={t} />
        </span>
        <span className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white tabular" style={{ background: ring, width: size * 0.34, height: size * 0.34, fontSize: Math.max(9, size * 0.17) }}>
          {t}
        </span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={look === "f" ? `/levels/f/${t}.png` : `/levels/${t}.png`} width={size} height={size} alt={title} title={title} className={`${className ?? ""} object-cover object-top`} style={{ width: size, height: size }} draggable={false} />;
}
