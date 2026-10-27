"use client";

import { useEffect, useState } from "react";

/** Café: a hand-drawn café full of quiet workers — the picture drifts very slowly, lamps glow, cups steam. */
export function CafeScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#f6eedd]">
      <picture>
        <source media="(min-aspect-ratio: 1/1)" srcSet="/focus/cafe-wide.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/focus/cafe-tall.webp" alt="" className="cafe-drift absolute inset-0 h-full w-full object-cover object-top" draggable={false} />
      </picture>
      <span className="cafe-glow absolute top-[6%] left-[30%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(255_230_170/0.55),transparent_65%)]" />
      <span className="cafe-glow absolute top-[6%] right-[20%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(255_230_170/0.55),transparent_65%)] [animation-delay:2.5s]" />
      {[16, 40, 66, 92].map((x, i) => (
        <span key={x} className="steam-puff absolute h-3 w-3 rounded-full bg-white" style={{ left: `${x}%`, top: "38%", animationDelay: `${i * 1.4}s`, animationDuration: "6s" }} />
      ))}
    </div>
  );
}

export type StreetView = "cafe" | "tokyo";
export const STREET_VIEWS: Record<StreetView, string> = { cafe: "Café window", tokyo: "Tokyo traffic" };

/**
 * Street: real videos at real speed, filmed through real windows (no drawn frame) — a café window onto a calm street
 * in Dali, or Tokyo's traffic from a window above Shibuya. Both from Pexels (free licence), looped with a crossfade.
 */
export function StreetScene({ view }: { view: StreetView }) {
  // The video made for the screen's shape: wide (laptops, tablets on their side) or tall (phones) — sharp, not a
  // phone clip blown up across a laptop.
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const q = window.matchMedia("(min-aspect-ratio: 1/1)");
    const on = () => setWide(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  const shape = wide ? "wide" : "tall";
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-black">
      {/* The first frame shows at once (a small picture); the video (no sound track, starts as it arrives) takes over. */}
      {wide !== null && (
        <video key={`${view}-${shape}`} autoPlay muted loop playsInline preload="auto" poster={`/focus/street-${view}-${shape}.webp`} className="absolute inset-0 h-full w-full object-cover">
          <source src={`/focus/street-${view}-${shape}.mp4`} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
