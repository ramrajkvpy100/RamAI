"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { isPersona, personaParts, PERSONAS, PHOTO, type PersonaChoice } from "@/lib/avatar-style";

type Art = typeof import("./avatar-personas").PersonaArt;

// The drawings are their own small download, fetched the first time a page shows a persona; a disc in its colour holds the place.
let art: Art | null = null;
let pending: Promise<void> | null = null;
const waiting = new Set<() => void>();
const load = () => {
  pending ??= import("./avatar-personas")
    .then((m) => {
      art = m.PersonaArt;
      waiting.forEach((f) => f());
    })
    .catch(() => {
      pending = null;
    });
};
const subscribe = (f: () => void) => {
  waiting.add(f);
  load();
  return () => void waiting.delete(f);
};

function Drawn({ persona: choice, size, className }: { persona: PersonaChoice; size: number; className?: string }) {
  const { id: persona, sex } = personaParts(choice);
  const Loaded = useSyncExternalStore(subscribe, () => art, () => null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (Loaded) return <Loaded persona={persona} sex={sex} size={size} uid={uid} className={className} />;
  const tint = PERSONAS.find((p) => p.id === persona)!.tint;
  return <span aria-hidden className={cn("block", className)} style={{ width: size, height: size, background: `radial-gradient(circle at 50% 32%, color-mix(in srgb, ${tint} 45%, #fff), ${tint})` }} />;
}

/** Google's address ends with the size it should send: twice what's drawn, for sharp phones. */
const sized = (photo: string, size: number) => photo.replace(/=s\d+(-c)?$/, `=s${Math.min(512, Math.ceil(size) * 2)}-c`);

/**
 * A doctor's chosen avatar: one of the personas, or their Google photo. `persona` and `photo` are what the API sends as
 * `avatar` on a row (PublicAvatar). With nothing to show (or a photo that won't load) it draws `fallback`.
 */
export function PersonaAvatar({ persona, photo, size = 40, className, title, fallback = null }: { persona?: string | null; photo?: string | null; size?: number; className?: string; title?: string; fallback?: ReactNode }) {
  const [broken, setBroken] = useState(false);
  const label = title ? { role: "img", "aria-label": title, title } : { "aria-hidden": true };
  if (persona === PHOTO && photo && !broken) {
    return (
      <span {...label} className={cn("inline-block shrink-0 overflow-hidden rounded-full bg-surface-3", className)} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Google's own small picture; it refuses requests that carry a referrer. */}
        <img src={sized(photo, size)} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => setBroken(true)} className="h-full w-full object-cover" />
      </span>
    );
  }
  if (!isPersona(persona)) return <>{fallback}</>;
  return (
    <span {...label} className={cn("inline-block shrink-0 overflow-hidden rounded-full", className)} style={{ width: size, height: size }}>
      <Drawn persona={persona} size={size} />
    </span>
  );
}
