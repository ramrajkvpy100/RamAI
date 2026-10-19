import type { PictureType } from "@/engine/types";

/** While a picture is being made: what that machine looks like at work — calm, looping, no progress bar. */
export function ScanAnimation({ type }: { type: PictureType }) {
  if (type === "usg") {
    return (
      <svg viewBox="0 0 200 150" className="h-36 w-48" aria-hidden>
        <defs>
          <radialGradient id="usg-speckle" cx="50%" cy="0%" r="100%">
            <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#64748b" stopOpacity="0.08" />
          </radialGradient>
          <clipPath id="usg-fan">
            <path d="M100 8 L22 140 A120 120 0 0 0 178 140 Z" />
          </clipPath>
        </defs>
        <path d="M100 8 L22 140 A120 120 0 0 0 178 140 Z" fill="url(#usg-speckle)" stroke="#94a3b8" strokeOpacity="0.35" />
        <g clipPath="url(#usg-fan)">
          {/* Echoes surfacing and fading as the beam passes */}
          {[[80, 70, 0], [118, 92, 0.6], [96, 112, 1.2], [130, 60, 1.8], [70, 104, 2.4]].map(([x, y, d], i) => (
            <ellipse key={i} cx={x} cy={y} rx="11" ry="5" fill="#e2e8f0">
              <animate attributeName="opacity" values="0;0.55;0" dur="3s" begin={`${d}s`} repeatCount="indefinite" />
            </ellipse>
          ))}
          <g>
            <path d="M100 8 L92 150 L108 150 Z" fill="#7dd3fc" opacity="0.35" />
            <animateTransform attributeName="transform" type="rotate" values="-32 100 8;32 100 8;-32 100 8" dur="2.6s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" />
          </g>
        </g>
        <rect x="88" y="0" width="24" height="10" rx="4" fill="#475569" />
      </svg>
    );
  }
  if (type === "ct" || type === "mri") {
    return (
      <svg viewBox="0 0 160 160" className="h-36 w-36" aria-hidden>
        <circle cx="80" cy="80" r="62" fill="none" stroke="#334155" strokeWidth="14" />
        <circle cx="80" cy="80" r="62" fill="none" stroke={type === "ct" ? "#38bdf8" : "#a78bfa"} strokeWidth="14" strokeDasharray="60 330" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" values="0 80 80;360 80 80" dur={type === "ct" ? "1.4s" : "3s"} repeatCount="indefinite" />
        </circle>
        {/* The patient's cross-section, filling in slice by slice */}
        <ellipse cx="80" cy="82" rx="30" ry="22" fill="#94a3b8" opacity="0.15" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x="52" y={66 + i * 7} width="56" height="3" rx="1.5" fill="#e2e8f0">
            <animate attributeName="opacity" values="0;0.5;0" dur="2.2s" begin={`${i * 0.35}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </svg>
    );
  }
  if (type === "xray") {
    return (
      <svg viewBox="0 0 160 160" className="h-36 w-36" aria-hidden>
        <rect x="20" y="16" width="120" height="128" rx="8" fill="#0f172a" stroke="#334155" />
        <g fill="none" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round">
          <animate attributeName="opacity" values="0.08;0.7;0.08" dur="2.8s" repeatCount="indefinite" />
          <path d="M80 30 V128" />
          {[46, 60, 74, 88, 102].map((y) => (
            <path key={y} d={`M78 ${y} C60 ${y - 4} 44 ${y + 4} 40 ${y + 14} M82 ${y} C100 ${y - 4} 116 ${y + 4} 120 ${y + 14}`} />
          ))}
        </g>
        <rect x="20" y="16" width="120" height="128" rx="8" fill="#e0f2fe">
          <animate attributeName="opacity" values="0;0.35;0;0" keyTimes="0;0.05;0.2;1" dur="2.8s" repeatCount="indefinite" />
        </rect>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden>
      <circle cx="60" cy="60" r="40" fill="none" stroke="#334155" strokeWidth="2" />
      <circle cx="60" cy="60" r="20" fill="#7dd3fc" opacity="0.25">
        <animate attributeName="r" values="14;34;14" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="60" r="8" fill="#e2e8f0" opacity="0.7" />
    </svg>
  );
}
