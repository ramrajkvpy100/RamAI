/**
 * Caricatures — small, friendly SVG busts.
 *
 *   PatientFigure  the patient; their face follows their condition
 *   FamilyFigure   the attendant or caller; worries when the patient does
 *   NurseFigure    the nurse, calm or alert
 *   DoctorFigure   you — the outfit grows with your rank
 *
 * Expressions only ever reflect what the player can already see (the
 * patient's status, measured vitals) — never hidden case information.
 */
"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

import type { PatientIdentity, PatientStatus } from "@/engine/types";
import { cn } from "@/lib/cn";

export type Mood = "well" | "ok" | "uneasy" | "unwell" | "critical" | "gone" | "worried" | "alert";

export function moodFor(status: PatientStatus): Mood {
  switch (status) {
    case "recovered":
    case "improving":
      return "well";
    case "stable":
      return "ok";
    case "guarded":
      return "uneasy";
    case "deteriorating":
      return "unwell";
    case "critical":
      return "critical";
    case "deceased":
      return "gone";
  }
}

const SKINS = ["#c68642", "#b5763a", "#a86b3c", "#9a5f33", "#d29b6c"];
const CLOTHES = ["#2563eb", "#0d9488", "#b45309", "#7c3aed", "#be123c", "#0369a1", "#4d7c0f", "#a21caf"];
const INK = "#1f1b18";

function hashOf(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)} ${c((n >> 8) & 255)} ${c(n & 255)})`;
}

const BG: Record<Mood, string> = {
  well: "rgb(16 185 129 / 0.2)",
  ok: "rgb(56 189 248 / 0.18)",
  uneasy: "rgb(245 158 11 / 0.2)",
  unwell: "rgb(249 115 22 / 0.24)",
  critical: "rgb(239 68 68 / 0.26)",
  gone: "rgb(148 163 184 / 0.22)",
  worried: "rgb(245 158 11 / 0.18)",
  alert: "rgb(239 68 68 / 0.18)",
};

type HairStyle = "short" | "receding" | "long" | "bun" | "neat" | "none";

interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  clothes: string;
  moustache?: boolean;
  glasses?: boolean;
  wrinkles?: boolean;
  earrings?: boolean;
}

function Hair({ style, color, back }: { style: HairStyle; color: string; back: boolean }) {
  if (back) {
    if (style === "long") return <path d="M30 46C28 28 40 20 50 20s22 8 20 26l2 28c-8 4-36 4-44 0Z" fill={color} />;
    if (style === "bun") return <circle cx="50" cy="21" r="7.5" fill={color} />;
    return null;
  }
  switch (style) {
    case "short":
      return <path d="M33 45c-1.5-16 8-23 17-23s18.5 7 17 23c-2-8-8-13.5-17-13.5S35 37 33 45Z" fill={color} />;
    case "receding":
      return <path d="M33.5 46c0-9 2-13 4-15 2 4 3 6 2 12-2 0-4 1-6 3Zm33 0c0-9-2-13-4-15-2 4-3 6-2 12 2 0 4 1 6 3Z" fill={color} />;
    case "long":
    case "bun":
      return <path d="M33 43c1-13 9-18.5 17-18.5S66 30 67 43c-4-7-10-10-17-8.5C43 33 37 36 33 43Z" fill={color} />;
    case "neat":
      return <path d="M33 45c-1-16 8-23.5 17.5-23.5 9 0 18 7 16.5 23.5-1.5-6-5-10-10-11.5-6 3-15 3.5-21 2.5-1.5 2.5-2.5 5.5-3 9Z" fill={color} />;
    default:
      return null;
  }
}

function Face({ mood, look }: { mood: Mood; look: Look }) {
  const dark = shade(look.skin, 0.72);
  const sad = mood === "unwell" || mood === "critical" || mood === "worried";
  const brows =
    mood === "gone" ? null : sad ? (
      <g stroke={look.hair === "#e6e2dc" ? "#8a8580" : INK} strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M40 41.8 46 39.6" />
        <path d="M54 39.6 60 41.8" />
      </g>
    ) : (
      <g stroke={look.hair === "#e6e2dc" ? "#8a8580" : INK} strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d={mood === "alert" ? "M40 39.5q3-2.5 6-0.5" : "M40 40.6q3-1.8 6 0"} />
        <path d={mood === "alert" ? "M54 39q3-2 6 0.5" : "M54 40.6q3-1.8 6 0"} />
      </g>
    );

  let eyes: ReactNode;
  if (mood === "well") {
    eyes = (
      <g stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M40.6 46.6q2.4-2.6 4.8 0" />
        <path d="M54.6 46.6q2.4-2.6 4.8 0" />
      </g>
    );
  } else if (mood === "gone") {
    eyes = (
      <g stroke={INK} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M40.6 46.4q2.4 1.4 4.8 0" />
        <path d="M54.6 46.4q2.4 1.4 4.8 0" />
      </g>
    );
  } else if (mood === "critical" || mood === "unwell") {
    eyes = (
      <g>
        <g className="fig-blink">
          <circle cx="43" cy="46.8" r={mood === "critical" ? 1.4 : 1.7} fill={INK} />
          <circle cx="57" cy="46.8" r={mood === "critical" ? 1.4 : 1.7} fill={INK} />
        </g>
        <g stroke={dark} strokeWidth={mood === "critical" ? 2.2 : 1.4} strokeLinecap="round">
          <path d="M40.4 45.2h5.2" />
          <path d="M54.4 45.2h5.2" />
        </g>
      </g>
    );
  } else {
    eyes = (
      <g className="fig-blink">
        <circle cx="43" cy="46.4" r={mood === "alert" ? 2.2 : 1.9} fill={INK} />
        <circle cx="57" cy="46.4" r={mood === "alert" ? 2.2 : 1.9} fill={INK} />
        <circle cx="43.6" cy="45.8" r="0.55" fill="#fff" />
        <circle cx="57.6" cy="45.8" r="0.55" fill="#fff" />
      </g>
    );
  }

  const mouth =
    mood === "well" ? (
      <path d="M44 55.6q6 5.2 12 0" stroke={shade(look.skin, 0.45)} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    ) : mood === "ok" ? (
      <path d="M45.5 56.4q4.5 2.6 9 0" stroke={shade(look.skin, 0.45)} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    ) : mood === "uneasy" || mood === "worried" ? (
      <path d="M46 57.2q4 -0.8 8 0" stroke={shade(look.skin, 0.45)} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    ) : mood === "unwell" ? (
      <path d="M45 58.6q5-3.6 10 0" stroke={shade(look.skin, 0.45)} strokeWidth="1.7" strokeLinecap="round" fill="none" />
    ) : mood === "critical" ? (
      <ellipse cx="50" cy="57.6" rx="2.6" ry="3.2" fill="#5b2b2b" />
    ) : mood === "alert" ? (
      <ellipse cx="50" cy="57.4" rx="2" ry="2.4" fill="#5b2b2b" />
    ) : (
      <path d="M46.5 57.4h7" stroke={shade(look.skin, 0.45)} strokeWidth="1.3" strokeLinecap="round" />
    );

  return (
    <g>
      {brows}
      {eyes}
      <path d="M50 47.5q-1.6 4 .4 5" stroke={dark} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {look.moustache && <path d="M44.6 52.8q2.7-2.2 5.4-0.4 2.7-1.8 5.4.4-2.7 1.6-5.4.6-2.7 1-5.4-.6Z" fill={look.hair} />}
      {mouth}
    </g>
  );
}

function Bust({
  look,
  mood,
  size,
  className,
  title,
  outfit,
  extras,
  fever,
  breathless,
  ring,
}: {
  look: Look;
  mood: Mood;
  size: number;
  className?: string;
  title: string;
  /** Clothing drawn over the base torso (coats, scrubs, stethoscopes). */
  outfit?: ReactNode;
  /** Anything drawn last (phone, cap, sparkles). */
  extras?: ReactNode;
  fever?: boolean;
  breathless?: boolean;
  ring?: string;
}) {
  const clip = `fig-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const gone = mood === "gone";
  const breath = mood === "critical" ? "1.3s" : mood === "unwell" ? "2s" : mood === "uneasy" ? "3s" : "4.2s";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title} className={cn("shrink-0", className)} style={{ "--breath": breath } as CSSProperties}>
      <circle cx="50" cy="50" r="50" fill={BG[mood]} />
      {ring && <circle cx="50" cy="50" r="48.5" fill="none" stroke={ring} strokeWidth="3" />}
      <g style={gone ? { filter: "grayscale(1)", opacity: 0.75 } : undefined}>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <Hair style={look.hairStyle} color={look.hair} back />
          <g className={gone ? undefined : "fig-breathe"}>
            <path d="M44 58h12v15H44Z" fill={shade(look.skin, 0.85)} />
            <path d="M11 104c0-20 15-31 39-31s39 11 39 31Z" fill={look.clothes} />
            <path d="M43 73.5 50 82l7-8.5" fill="none" stroke={shade(look.clothes.startsWith("#") ? look.clothes : "#888888", 0.7)} strokeWidth="1.6" strokeLinejoin="round" />
            {outfit}
          </g>
        </g>
        <ellipse cx="33.4" cy="47" rx="3" ry="4.6" fill={shade(look.skin, 0.9)} />
        <ellipse cx="66.6" cy="47" rx="3" ry="4.6" fill={shade(look.skin, 0.9)} />
        {look.earrings && (
          <g fill="#f5c542">
            <circle cx="33.2" cy="52.6" r="1.3" />
            <circle cx="66.8" cy="52.6" r="1.3" />
          </g>
        )}
        <ellipse cx="50" cy="45" rx="17" ry="20" fill={look.skin} />
        {mood === "critical" && <ellipse cx="50" cy="45" rx="17" ry="20" fill="#94a3b8" opacity="0.28" />}
        {(mood === "well" || fever) && (
          <g fill={fever ? "#ef4444" : "#f472b6"} opacity={fever ? 0.42 : 0.3}>
            <ellipse cx="40.5" cy="52" rx="3.4" ry="2" />
            <ellipse cx="59.5" cy="52" rx="3.4" ry="2" />
          </g>
        )}
        {look.wrinkles && <path d="M44 33.6q6-1.6 12 0M45.5 36.4q4.5-1 9 0" stroke={shade(look.skin, 0.7)} strokeWidth="0.9" fill="none" opacity="0.7" />}
        <Hair style={look.hairStyle} color={look.hair} back={false} />
        <Face mood={mood} look={look} />
        {look.glasses && (
          <g stroke="#334155" strokeWidth="1.2" fill="rgb(255 255 255 / 0.12)">
            <rect x="38.2" y="42.6" width="9.6" height="7.4" rx="2.6" />
            <rect x="52.2" y="42.6" width="9.6" height="7.4" rx="2.6" />
            <path d="M47.8 45.6h4.4" fill="none" />
          </g>
        )}
        {(mood === "unwell" || mood === "critical") && <path className="fig-sweat" d="M66 33.5q2.4 3.4 0 5.6-2.4-2.2 0-5.6Z" fill="#7dd3fc" />}
        {(breathless || mood === "critical") && (
          <g className="fig-puff" stroke="#94a3b8" strokeWidth="1.3" strokeLinecap="round" fill="none">
            <path d="M58.5 60.5q3-1.2 5.2 0.8" />
            <path d="M59.5 64q3-1.2 5.2 0.8" />
          </g>
        )}
        {extras}
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

function patientLook(p: PatientIdentity, seed: string): Look {
  const h = hashOf(seed);
  const female = p.sex === "Female";
  const old = p.age >= 60;
  const middle = p.age >= 42;
  return {
    skin: SKINS[h % SKINS.length]!,
    hair: old ? "#e6e2dc" : middle ? "#3a3530" : "#1f1b18",
    hairStyle: female ? (old || h % 3 === 0 ? "bun" : "long") : old && h % 2 === 0 ? "receding" : "short",
    clothes: CLOTHES[(h >>> 3) % CLOTHES.length]!,
    moustache: !female && p.age >= 24 && (h >>> 5) % 2 === 0,
    glasses: p.age >= 45 && (h >>> 7) % 3 === 0,
    wrinkles: old,
    earrings: female && (h >>> 9) % 2 === 0,
  };
}

export function PatientFigure({
  patient,
  status,
  seed,
  size = 56,
  fever,
  breathless,
  className,
}: {
  patient: PatientIdentity;
  status: PatientStatus;
  seed: string;
  size?: number;
  fever?: boolean;
  breathless?: boolean;
  className?: string;
}) {
  const mood = moodFor(status);
  return <Bust look={patientLook(patient, seed)} mood={mood} size={size} fever={fever} breathless={breathless} className={className} title={`Patient — looks ${mood === "gone" ? "lifeless" : mood}`} />;
}

export function FamilyFigure({ seed, patientStatus, onPhone = false, size = 32, className }: { seed: string; patientStatus: PatientStatus; onPhone?: boolean; size?: number; className?: string }) {
  const h = hashOf(`${seed}:family`);
  const m = moodFor(patientStatus);
  // Relatives relax only once the patient does; anyone ringing a doctor is worried.
  const mood: Mood = m === "well" ? "well" : m === "ok" && !onPhone ? "ok" : "worried";
  const look: Look = { skin: SKINS[(h + 2) % SKINS.length]!, hair: "#1f1b18", hairStyle: "short", clothes: CLOTHES[(h >>> 4) % CLOTHES.length]! };
  return (
    <Bust
      look={look}
      mood={mood}
      size={size}
      className={className}
      title={onPhone ? "Caller" : "Family member"}
      extras={
        onPhone ? (
          <g>
            <rect x="65" y="38" width="7" height="14" rx="2" fill="#0f172a" />
            <rect x="66" y="39.6" width="5" height="9" rx="1" fill="#38bdf8" />
          </g>
        ) : undefined
      }
    />
  );
}

export function NurseFigure({ alert = false, size = 24, className }: { alert?: boolean; size?: number; className?: string }) {
  const look: Look = { skin: "#b5763a", hair: "#1f1b18", hairStyle: "bun", clothes: "#14b8a6" };
  return (
    <Bust
      look={look}
      mood={alert ? "alert" : "ok"}
      size={size}
      className={className}
      title="Nurse"
      extras={
        <g>
          <path d="M37 30.5h26l-2.5-8.5h-21Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
          <path d="M38 27.4h24" stroke="#38bdf8" strokeWidth="1.6" />
        </g>
      }
    />
  );
}

/* Doctor: the outfit grows with the rank tier (1–10). ---------------------- */

function Stethoscope({ gold = false }: { gold?: boolean }) {
  const c = gold ? "#f5c542" : "#475569";
  return (
    <g fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M40.5 73.5c-3 10 3 18 9.5 18s12.5-8 9.5-18" />
      <circle cx="50" cy="93.5" r="2.6" fill={gold ? "#fde68a" : "#94a3b8"} />
    </g>
  );
}

function WhiteCoat({ shirt, tie }: { shirt: string; tie?: "tie" | "bow" }) {
  return (
    <g>
      <path d="M11 104c0-20 15-31 39-31s39 11 39 31Z" fill="#f8fafc" />
      <path d="M41 73.5h18L50 92Z" fill={shirt} />
      <path d="M41 73.5 50 92l-5 12M59 73.5 50 92l5 12" fill="none" stroke="#cbd5e1" strokeWidth="1.4" />
      {tie === "tie" && <path d="M48.4 77.5h3.2l1 13-2.6 3-2.6-3Z" fill="#1e3a8a" />}
      {tie === "bow" && <path d="M45.5 77l4.5 2.6 4.5-2.6v5.2l-4.5-2.6-4.5 2.6Z" fill="#7f1d1d" />}
    </g>
  );
}

export const DOCTOR_NEXT: Record<number, string> = {
  1: "your first stethoscope",
  2: "hospital scrubs",
  3: "the senior resident's coat",
  4: "a shirt, tie and glasses",
  5: "your faculty badge",
  6: "the professor's bow tie",
  7: "the HOD pin",
  8: "the Dean's suit",
  9: "the golden stethoscope",
};

/**
 * A doctor dressed for their rank. With a `seed` (a player id) each doctor
 * gets their own face — skin tone, hair, glasses — for leaderboards; without
 * one it's "your doctor".
 */
export function DoctorFigure({ tier, size = 72, className, seed, title = "Your doctor" }: { tier: number; size?: number; className?: string; seed?: string; title?: string }) {
  const t = Math.max(1, Math.min(10, Math.round(tier)));
  const senior = t >= 7;
  const h = seed ? hashOf(seed) : 0;
  const styles: HairStyle[] = senior ? ["neat", "receding", "bun", "short"] : ["neat", "short", "bun", "long"];
  const hairStyle: HairStyle = seed ? styles[(h >>> 3) % styles.length]! : "neat";
  const look: Look = {
    skin: seed ? SKINS[h % SKINS.length]! : "#b97a48",
    hair: t >= 8 ? "#8f8a85" : senior ? "#3a3530" : "#1f1b18",
    hairStyle,
    clothes: t === 1 ? "#6366f1" : t === 3 || t === 4 ? "#0f766e" : "#e2e8f0",
    glasses: t >= 5 || (!!seed && (h >>> 7) % 4 === 0),
    earrings: !!seed && (hairStyle === "bun" || hairStyle === "long") && (h >>> 9) % 2 === 0,
  };

  let outfit: ReactNode = null;
  if (t === 1) {
    outfit = (
      <g>
        <path d="M27 79 31 104M73 79 69 104" stroke="#1e1b4b" strokeWidth="4" strokeLinecap="round" />
        <path d="M46 74 50 86 54 74" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
        <rect x="46.5" y="86" width="7" height="9" rx="1.2" fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.8" />
      </g>
    );
  } else if (t === 2) {
    outfit = (
      <g>
        <WhiteCoat shirt="#93c5fd" />
        <Stethoscope />
      </g>
    );
  } else if (t === 3) {
    outfit = <Stethoscope />;
  } else if (t === 4) {
    outfit = (
      <g>
        <path d="M11 104c0-20 15-31 39-31s39 11 39 31Z" fill="#f8fafc" />
        <path d="M41 73.5h18L50 92Z" fill="#0f766e" />
        <path d="M41 73.5 50 92l-5 12M59 73.5 50 92l5 12" fill="none" stroke="#cbd5e1" strokeWidth="1.4" />
        <Stethoscope />
        <path d="M66 86v8" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  } else if (t <= 6) {
    outfit = (
      <g>
        <WhiteCoat shirt="#bfdbfe" tie="tie" />
        <Stethoscope />
        {t === 6 && <rect x="61" y="86" width="9" height="5" rx="1" fill="#2563eb" />}
      </g>
    );
  } else if (t <= 8) {
    outfit = (
      <g>
        <WhiteCoat shirt="#e0f2fe" tie="bow" />
        <Stethoscope />
        {t === 8 && <circle cx="65" cy="88" r="2.6" fill="#f5c542" stroke="#b45309" strokeWidth="0.8" />}
      </g>
    );
  } else if (t === 9) {
    outfit = (
      <g>
        <path d="M11 104c0-20 15-31 39-31s39 11 39 31Z" fill="#1e293b" />
        <path d="M41 73.5h18L50 92Z" fill="#f8fafc" />
        <path d="M48.4 77.5h3.2l1 13-2.6 3-2.6-3Z" fill="#7f1d1d" />
        <path d="M41 73.5 50 92l-6 12M59 73.5 50 92l6 12" fill="none" stroke="#334155" strokeWidth="1.4" />
        <circle cx="64" cy="87" r="2.8" fill="#f5c542" />
      </g>
    );
  } else {
    outfit = (
      <g>
        <WhiteCoat shirt="#fef3c7" tie="bow" />
        <Stethoscope gold />
      </g>
    );
  }

  return (
    <Bust
      look={look}
      mood="well"
      size={size}
      className={className}
      title={title}
      outfit={outfit}
      ring={t === 10 ? "#f5c542" : undefined}
      extras={
        t === 10 ? (
          <g fill="#f5c542">
            <path d="m20 24 1.6 3.6 3.6 1.6-3.6 1.6L20 34.4l-1.6-3.6-3.6-1.6 3.6-1.6Z" />
            <path d="m80 30 1.2 2.6 2.6 1.2-2.6 1.2L80 37.6l-1.2-2.6-2.6-1.2 2.6-1.2Z" />
          </g>
        ) : undefined
      }
    />
  );
}
