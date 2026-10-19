import { BGS, HAIR_COLORS, SKIN, type AvatarStyle } from "@/lib/avatar-style";

/** The doctor's avatar, drawn: a round face, hair, eyes, mouth and one extra, on a coloured disc. */
export function AvatarFace({ style: a, size = 32, className }: { style: AvatarStyle; size?: number; className?: string }) {
  const skin = SKIN[a.skin]!;
  const hair = HAIR_COLORS[a.hairColor]!;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <circle cx="50" cy="50" r="50" fill={BGS[a.bg]} />
      {/* Hair behind the head */}
      {a.hair === "long" && <path d="M22 46 C20 22 80 22 78 46 L80 84 L20 84 Z" fill={hair} />}
      {a.hair === "hijab" && <path d="M18 54 C16 18 84 18 82 54 L86 100 L14 100 Z" fill="#0f766e" />}
      {/* Shoulders */}
      <path d="M18 100 C20 80 34 74 50 74 C66 74 80 80 82 100 Z" fill="#f8fafc" />
      <path d="M44 74 L50 86 L56 74" fill="#cbd5e1" />
      {/* Neck and face */}
      <rect x="43" y="62" width="14" height="14" rx="5" fill={skin} />
      <ellipse cx="50" cy="48" rx="22" ry="24" fill={skin} />
      <ellipse cx="28.5" cy="50" rx="3.5" ry="5" fill={skin} />
      <ellipse cx="71.5" cy="50" rx="3.5" ry="5" fill={skin} />
      {/* Hair on top */}
      {a.hair === "short" && <path d="M28 44 C26 22 74 22 72 44 C66 34 56 31 50 31 C42 31 34 34 28 44 Z" fill={hair} />}
      {a.hair === "side" && <path d="M28 46 C24 20 76 20 72 42 C62 40 50 34 44 28 C40 36 34 40 28 46 Z" fill={hair} />}
      {a.hair === "long" && <path d="M27 48 C24 22 76 22 73 48 C70 34 58 29 50 29 C42 29 30 34 27 48 Z" fill={hair} />}
      {a.hair === "bun" && (
        <>
          <circle cx="50" cy="20" r="9" fill={hair} />
          <path d="M28 44 C26 24 74 24 72 44 C66 35 57 32 50 32 C43 32 34 35 28 44 Z" fill={hair} />
        </>
      )}
      {a.hair === "curly" && [30, 38, 46, 54, 62, 70, 34, 66].map((x, i) => <circle key={i} cx={x} cy={i < 6 ? 30 - Math.abs(x - 50) * 0.12 : 38} r="7.5" fill={hair} />)}
      {a.hair === "hijab" && <path d="M27 50 C26 26 74 26 73 50 C72 36 62 30 50 30 C38 30 28 36 27 50 Z" fill="#14b8a6" />}
      {/* Eyes */}
      {a.eyes === "round" && (
        <>
          <circle cx="41" cy="48" r="3" fill="#1f2937" />
          <circle cx="59" cy="48" r="3" fill="#1f2937" />
        </>
      )}
      {a.eyes === "happy" && <path d="M37 49 Q41 44 45 49 M55 49 Q59 44 63 49" stroke="#1f2937" strokeWidth="2.6" fill="none" strokeLinecap="round" />}
      {a.eyes === "wink" && (
        <>
          <circle cx="41" cy="48" r="3" fill="#1f2937" />
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
