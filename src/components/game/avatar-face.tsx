import type React from "react";

import { BGS, HAIR_COLORS, outfitFor, SKIN, type AvatarStyle } from "@/lib/avatar-style";

/** The doctor's avatar, drawn: a round face, hair, eyes, mouth and one extra, on a coloured disc. */
export function AvatarFace({ style: a, size = 32, className, tier }: { style: AvatarStyle; size?: number; className?: string; /** Your rank (1–10): which outfits are unlocked. */ tier?: number }) {
  const skin = SKIN[a.skin]!;
  const outfit = tier ? outfitFor(a, tier) : a.outfit !== undefined && a.outfit >= 0 ? a.outfit : 1;
  // Gradient ids from the avatar itself (no hook: it's also drawn on the server for share cards).
  const id = `av${a.skin}${a.bg}${a.hairColor}${String(a.hair).slice(0, 2)}${outfit}`;
  const hair = HAIR_COLORS[a.hairColor]!;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={`${id}-bg`} cx="35%" cy="25%" r="85%"><stop offset="0" stopColor="#ffffff" stopOpacity="0.35" /><stop offset="0.6" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-face`} cx="42%" cy="38%" r="70%"><stop offset="0" stopColor="#ffffff" stopOpacity="0.22" /><stop offset="0.7" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#000000" stopOpacity="0.12" /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={BGS[a.bg]} />
      <circle cx="50" cy="50" r="50" fill={`url(#${id}-bg)`} />
      {outfit === 9 && <circle cx="50" cy="46" r="34" fill="none" stroke="#fde68a" strokeWidth="5" opacity="0.85" />}
      {/* Hair behind the head */}
      {a.hair === "long" && <path d="M18 48 C14 14 86 14 82 48 L86 90 C70 96 30 96 14 90 Z" fill={hair} />}
      {a.hair === "hijab" && <path d="M16 56 C10 4 90 4 84 56 L88 100 L12 100 Z" fill="#0f766e" />}
      {/* Shoulders: the rank's outfit */}
      <Outfit n={outfit} />
      {/* Neck and face */}
      <rect x="43" y="62" width="14" height="14" rx="5" fill={skin} />
      <ellipse cx="50" cy="48" rx="22" ry="24" fill={skin} />
      <ellipse cx="50" cy="48" rx="22" ry="24" fill={`url(#${id}-face)`} />
      {/* Shadow under the chin, a little nose */}
      <path d="M43 70 Q50 74 57 70" stroke="#000" strokeOpacity="0.12" strokeWidth="3" fill="none" />
      <path d="M50 50 Q47.5 55 50 56.5" stroke="#000" strokeOpacity="0.22" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="28.5" cy="50" rx="3.5" ry="5" fill={skin} />
      <ellipse cx="71.5" cy="50" rx="3.5" ry="5" fill={skin} />
      {/* Hair on top */}
      {a.hair === "short" && <path d="M24 54 C16 8 84 8 76 54 L73 54 C72 44 69 39 64 37 C56 41 44 41 36 37 C31 39 28 44 27 54 Z" fill={hair} />}
      {a.hair === "side" && <path d="M24 56 C14 6 86 6 77 52 L74 52 C72 43 66 39 60 38 C52 37 44 33 40 27 C36 35 31 41 28 56 Z" fill={hair} />}
      {a.hair === "long" && <path d="M23 60 C14 6 86 6 77 60 C74 42 64 35 55 35 C50 39 42 39 36 37 C29 42 26 48 23 60 Z" fill={hair} />}
      {a.hair === "bun" && (
        <>
          <circle cx="50" cy="12" r="12" fill={hair} />
          <path d="M24 54 C16 10 84 10 76 54 L73 54 C71 43 64 38 50 37 C36 38 29 43 27 54 Z" fill={hair} />
        </>
      )}
      {a.hair === "curly" && [[26, 40], [32, 30], [41, 24], [50, 22], [59, 24], [68, 30], [74, 40], [27, 50], [73, 50], [36, 34], [64, 34], [50, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill={hair} />)}
      {a.hair === "hijab" && <path d="M22 62 C14 4 86 4 78 62 C76 40 64 32 50 32 C36 32 24 40 22 62 Z" fill="#14b8a6" />}
      {/* Eyebrows */}
      {a.hair !== "bald" && <path d="M36 41 Q41 38.5 45 40.5 M55 40.5 Q59 38.5 64 41" stroke={hair} strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {/* Hair shine */}
      {["short", "side", "long", "bun"].includes(a.hair) && <path d="M36 22 Q46 16 58 19" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      {/* Eyes */}
      {a.eyes === "round" && (
        <>
          <ellipse cx="41" cy="48" rx="4.2" ry="4" fill="#ffffff" />
          <ellipse cx="59" cy="48" rx="4.2" ry="4" fill="#ffffff" />
          <circle cx="41.4" cy="48.4" r="2.7" fill="#3b2a1f" />
          <circle cx="59.4" cy="48.4" r="2.7" fill="#3b2a1f" />
          <circle cx="42.3" cy="47.4" r="0.9" fill="#ffffff" />
          <circle cx="60.3" cy="47.4" r="0.9" fill="#ffffff" />
        </>
      )}
      {a.eyes === "happy" && <path d="M37 49 Q41 44 45 49 M55 49 Q59 44 63 49" stroke="#1f2937" strokeWidth="2.6" fill="none" strokeLinecap="round" />}
      {a.eyes === "wink" && (
        <>
          <ellipse cx="41" cy="48" rx="4.2" ry="4" fill="#ffffff" />
          <circle cx="41.4" cy="48.4" r="2.7" fill="#3b2a1f" />
          <circle cx="42.3" cy="47.4" r="0.9" fill="#ffffff" />
          <path d="M55 48 Q59 51 63 48" stroke="#1f2937" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      )}
      {a.eyes === "sleepy" && <path d="M37 48 H45 M55 48 H63" stroke="#1f2937" strokeWidth="2.6" strokeLinecap="round" />}
      {/* Cheeks */}
      <circle cx="35" cy="56" r="3.5" fill="#fb7185" opacity="0.25" />
      <circle cx="65" cy="56" r="3.5" fill="#fb7185" opacity="0.25" />
      {/* Mouth (a mask covers it) */}
      {a.extra !== "mask" && a.mouth === "smile" && <path d="M43 59 Q50 65 57 59" stroke="#7f1d1d" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      {a.extra !== "mask" && a.mouth === "grin" && <path d="M41 58 Q50 68 59 58 Z" fill="#7f1d1d" />}
      {a.extra !== "mask" && a.mouth === "calm" && <path d="M45 60 H55" stroke="#7f1d1d" strokeWidth="2.4" strokeLinecap="round" />}
      {a.extra !== "mask" && a.mouth === "open" && <ellipse cx="50" cy="60" rx="4" ry="4.5" fill="#7f1d1d" />}
      {/* The extra */}
      {a.extra === "glasses" && (
        <g stroke="#111827" strokeWidth="2" fill="rgb(255 255 255 / 0.25)">
          <circle cx="41" cy="48" r="7" />
          <circle cx="59" cy="48" r="7" />
          <path d="M48 48 H52" />
        </g>
      )}
      {a.extra === "stethoscope" && <path d="M38 76 C36 88 48 92 50 84 M62 76 C64 88 52 92 50 84 M50 84 V92" stroke="#334155" strokeWidth="2.6" fill="none" strokeLinecap="round" />}
      {a.extra === "stethoscope" && <circle cx="50" cy="94" r="3.5" fill="#64748b" />}
      {a.extra === "cap" && <path d="M27 38 C28 20 72 20 73 38 Z" fill="#0ea5e9" />}
      {a.extra === "mask" && <path d="M33 54 Q50 52 67 54 L64 66 Q50 72 36 66 Z" fill="#7dd3fc" stroke="#0284c7" strokeWidth="1" />}
      {a.extra === "headlight" && (
        <>
          <path d="M27 36 Q50 26 73 36" stroke="#334155" strokeWidth="3" fill="none" />
          <circle cx="50" cy="29" r="5.5" fill="#fde68a" stroke="#334155" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

const BODY = "M18 100 C20 80 34 74 50 74 C66 74 80 80 82 100 Z";
const LEFT_LAPEL = "M34 77 L46 100 L30 100 C24 92 26 82 34 77 Z";
const RIGHT_LAPEL = "M66 77 L54 100 L70 100 C76 92 74 82 66 77 Z";

/** The ten rank outfits, drawn on the shoulders (the same clothes as the rank pictures). */
function Outfit({ n }: { n: number }) {
  const coat = (shirt: string, extra?: React.ReactNode, trim?: string) => (
    <>
      <path d={BODY} fill={shirt} />
      <path d={LEFT_LAPEL} fill="#ffffff" stroke={trim ?? "#e2e8f0"} strokeWidth={trim ? 1.6 : 0.8} />
      <path d={RIGHT_LAPEL} fill="#ffffff" stroke={trim ?? "#e2e8f0"} strokeWidth={trim ? 1.6 : 0.8} />
      <path d="M18 100 C20 80 30 76 34 77 L30 100 Z M82 100 C80 80 70 76 66 77 L70 100 Z" fill="#ffffff" />
      {extra}
    </>
  );
  const tie = (c: string) => <path d="M48 78 L52 78 L53.5 92 L50 97 L46.5 92 Z" fill={c} />;
  switch (n) {
    case 0: // Student
      return (
        <>
          <path d={BODY} fill="#60a5fa" />
          <path d="M43 75 L50 83 L57 75" fill="#93c5fd" />
          <path d="M40 76 L48 92 M60 76 L52 92" stroke="#1d4ed8" strokeWidth="1.6" />
          <rect x="45" y="91" width="10" height="8" rx="1.5" fill="#f8fafc" stroke="#1d4ed8" strokeWidth="1" />
        </>
      );
    case 1: // Intern
      return coat("#bfdbfe", <path d="M44 75 L50 84 L56 75" fill="#93c5fd" />);
    case 2: // Junior Resident — scrubs
      return (
        <>
          <path d={BODY} fill="#14b8a6" />
          <path d="M42 75 L50 88 L58 75" fill="#0f766e" />
          <path d="M28 92 H38" stroke="#0f766e" strokeWidth="1.4" />
        </>
      );
    case 3: // Senior Resident — coat over navy scrubs
      return coat("#1e3a8a", <path d="M44 75 L50 86 L56 75" fill="#172554" />);
    case 4: // Assistant Professor — shirt & tie
      return coat("#bfdbfe", tie("#1e3a8a"));
    case 5: // Associate Professor — tie and a name badge
      return coat("#dbeafe", <>{tie("#7f1d1d")}<rect x="60" y="86" width="9" height="5" rx="1" fill="#2563eb" /></>);
    case 6: // Professor — pens in the pocket
      return coat("#e0e7ff", <>{tie("#334155")}<rect x="59" y="88" width="10" height="7" rx="1" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" /><path d="M61 84 V89 M64 83 V89 M67 85 V89" stroke="#2563eb" strokeWidth="1.4" /></>);
    case 7: // Head of Department — suit under the coat
      return coat("#1f2937", <><path d="M42 76 L50 90 L58 76" fill="#f8fafc" />{tie("#991b1b")}</>);
    case 8: // Dean — navy blazer & tie
      return (
        <>
          <path d={BODY} fill="#1e3a8a" />
          <path d="M42 76 L50 90 L58 76" fill="#f8fafc" />
          {tie("#b91c1c")}
          <path d="M34 77 L46 100 M66 77 L54 100" stroke="#172554" strokeWidth="1.6" />
          <circle cx="62" cy="88" r="1.6" fill="#fbbf24" />
        </>
      );
    default: // Master Clinician — gold-trimmed coat
      return coat("#dbeafe", <>{tie("#b45309")}<path d="M38 80 C36 90 48 94 50 87 M62 80 C64 90 52 94 50 87" stroke="#d97706" strokeWidth="2.2" fill="none" /></>, "#f59e0b");
  }
}
